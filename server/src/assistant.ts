import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import { z } from 'zod';

import { HttpError, RefusalError } from './errors.js';
import { formatStudyContext, MODE_INSTRUCTIONS, PERSONA } from './prompts.js';
import type { AssistantMode, AssistantRequest, AssistantResponse, MCQ } from './types.js';

type MessageParam = Anthropic.Beta.BetaMessageParam;
type TextBlockParam = Anthropic.Beta.BetaTextBlockParam;
type CreateParams = Anthropic.Beta.Messages.MessageCreateParamsNonStreaming;
type Effort = 'low' | 'medium';

export const MODEL = 'claude-opus-5-5';
export const MAX_TOKENS = 16_000;
/** Beta that enables `fallbacks: 'default'` (server-side retry on another model after a policy decline). */
export const FALLBACK_BETA = 'server-side-fallback-2026-07-01';
export const MAX_MCQS = 10;

/** Thinking is always on for this model; effort is the knob for depth, latency and cost. */
export const EFFORT_BY_MODE: Readonly<Record<AssistantMode, Effort>> = {
  chat: 'low',
  explain: 'low',
  summarize: 'low',
  plan: 'medium',
  mcq: 'medium',
};

const CACHE_BREAKPOINT = { type: 'ephemeral' } as const;

/**
 * Wire schema for structured MCQ output. Deliberately lenient (no length or
 * range constraints) so one malformed question can't fail the whole parse;
 * `sanitizeMcqs` enforces the real rules afterwards.
 */
const McqSetSchema = z.object({
  intro: z.string().describe('One or two short, encouraging sentences introducing the questions. Plain text.'),
  questions: z
    .array(
      z.object({
        question: z.string().describe('The question stem.'),
        options: z.array(z.string()).describe('Exactly four answer options, answer text only (no "A)" prefixes).'),
        answerIndex: z.number().describe('0-based index (0 to 3) of the single correct option.'),
        explanation: z.string().describe('One or two sentences on why the correct option is right.'),
      }),
    )
    .describe('The practice questions (at most 10). Empty if the request is too vague to answer accurately.'),
});

const ValidMcqSchema = z.object({
  question: z.string().trim().min(1),
  options: z
    .array(z.string().trim().min(1))
    .length(4)
    .refine((options) => new Set(options.map((option) => option.toLowerCase())).size === 4, 'options must be distinct'),
  answerIndex: z.number().int().min(0).max(3),
  explanation: z.string().trim(),
});

export interface AssistantCallMeta {
  /** Model that produced the answer (differs from MODEL when a fallback served it). */
  model: string;
  stopReason: string | null;
  servedByFallback: boolean;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  droppedMcqs?: number;
}

export interface AssistantResult {
  response: AssistantResponse;
  meta: AssistantCallMeta;
}

export interface Assistant {
  respond(request: AssistantRequest, options: { signal: AbortSignal }): Promise<AssistantResult>;
}

/**
 * Stable persona + mode instructions. The breakpoint on the last block caches
 * the whole system prompt per mode, shared by every student.
 */
export function buildSystem(mode: AssistantMode): TextBlockParam[] {
  return [
    { type: 'text', text: PERSONA },
    { type: 'text', text: MODE_INSTRUCTIONS[mode], cache_control: CACHE_BREAKPOINT },
  ];
}

/**
 * Builds API messages from a validated, normalized request (first turn is the
 * user's, roles alternate, last turn is the user's).
 *
 * The volatile study context is prepended to the latest user turn only. The
 * turn before it gets a cache breakpoint: that prefix is exactly what the next
 * request in the conversation resends, so follow-ups read it from the cache
 * while the per-request tail (context + new question) stays uncached.
 */
export function buildMessages(request: AssistantRequest): MessageParam[] {
  const history = request.messages.slice(0, -1);
  const latest = request.messages.at(-1);
  if (!latest || latest.role !== 'user') {
    throw new Error('buildMessages expects a normalized request ending with a user message');
  }

  const messages: MessageParam[] = history.map((message, index) =>
    index === history.length - 1
      ? { role: message.role, content: [{ type: 'text', text: message.content, cache_control: CACHE_BREAKPOINT }] }
      : { role: message.role, content: message.content },
  );

  messages.push({
    role: 'user',
    content: request.context
      ? [
          { type: 'text', text: formatStudyContext(request.context) },
          { type: 'text', text: latest.content },
        ]
      : latest.content,
  });
  return messages;
}

/** Keeps only well-formed questions (4 distinct options, answerIndex 0–3), trimmed and capped at MAX_MCQS. */
export function sanitizeMcqs(questions: readonly unknown[]): { mcqs: MCQ[]; dropped: number } {
  const mcqs: MCQ[] = [];
  for (const candidate of questions) {
    const result = ValidMcqSchema.safeParse(candidate);
    if (result.success) mcqs.push(result.data);
  }
  const kept = mcqs.slice(0, MAX_MCQS);
  return { mcqs: kept, dropped: questions.length - kept.length };
}

/** Concatenates the answer's text blocks, ignoring thinking and fallback marker blocks. */
export function extractText(content: readonly Anthropic.Beta.BetaContentBlock[]): string {
  return content
    .flatMap((block) => (block.type === 'text' ? [block.text] : []))
    .join('')
    .trim();
}

function describeCall(message: Anthropic.Beta.BetaMessage): AssistantCallMeta {
  const { usage } = message;
  return {
    model: message.model,
    stopReason: message.stop_reason,
    // A `fallback_message` iteration is the reliable served-by signal (sticky turns carry no fallback block).
    servedByFallback: (usage.iterations ?? []).some((iteration) => iteration.type === 'fallback_message'),
    inputTokens: usage.input_tokens,
    outputTokens: usage.output_tokens,
    cacheReadTokens: usage.cache_read_input_tokens ?? 0,
    cacheWriteTokens: usage.cache_creation_input_tokens ?? 0,
  };
}

function assertNotRefused(message: Anthropic.Beta.BetaMessage): void {
  // Branch on stop_reason (stop_details is informational and may be null).
  if (message.stop_reason === 'refusal') {
    throw new RefusalError(message.stop_details?.category ?? null);
  }
}

const emptyAnswerError = () =>
  new HttpError(502, 'upstream_error', 'The study buddy returned an empty answer. Please try again.');

/** Talks to Claude through the official SDK. All calls go through the beta namespace for server-side refusal fallback. */
export function createAssistant(client: Anthropic): Assistant {
  const baseParams = (request: AssistantRequest) =>
    ({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      betas: [FALLBACK_BETA],
      fallbacks: 'default',
      // Adaptive is this model's default (and only) thinking mode; sent explicitly so a fallback model
      // behaves the same. Reasoning is never shown to students, so skip the summaries.
      thinking: { type: 'adaptive', display: 'omitted' },
      system: buildSystem(request.mode),
      messages: buildMessages(request),
    }) satisfies Omit<CreateParams, 'output_config'>;

  async function respondWithText(request: AssistantRequest, signal: AbortSignal): Promise<AssistantResult> {
    const message = await client.beta.messages.create(
      { ...baseParams(request), output_config: { effort: EFFORT_BY_MODE[request.mode] } },
      { signal },
    );
    assertNotRefused(message);
    const meta = describeCall(message);
    const text = extractText(message.content);
    if (!text) throw emptyAnswerError();
    const truncated = message.stop_reason === 'max_tokens';
    return {
      response: { text: truncated ? `${text}\n\n(That answer was cut short. Ask me to continue.)` : text },
      meta,
    };
  }

  async function respondWithMcqs(request: AssistantRequest, signal: AbortSignal): Promise<AssistantResult> {
    const message = await client.beta.messages.parse(
      {
        ...baseParams(request),
        output_config: { effort: EFFORT_BY_MODE.mcq, format: betaZodOutputFormat(McqSetSchema) },
      },
      { signal },
    );
    assertNotRefused(message);
    const parsed = message.parsed_output;
    if (!parsed) throw emptyAnswerError();

    const { mcqs, dropped } = sanitizeMcqs(parsed.questions);
    const intro = parsed.intro.trim();
    const text =
      intro ||
      (mcqs.length > 0
        ? `Here are ${mcqs.length} practice questions. Take your time and good luck!`
        : "I couldn't write good questions for that yet. Tell me the topic, or paste the notes you'd like to be tested on.");
    return {
      response: mcqs.length > 0 ? { text, mcqs } : { text },
      meta: { ...describeCall(message), droppedMcqs: dropped },
    };
  }

  return {
    respond: (request, { signal }) =>
      request.mode === 'mcq' ? respondWithMcqs(request, signal) : respondWithText(request, signal),
  };
}

/** SDK client; credentials come from ANTHROPIC_API_KEY in the environment. */
export function createAnthropicClient({ timeoutMs }: { timeoutMs: number }): Anthropic {
  return new Anthropic({ timeout: timeoutMs, maxRetries: 2 });
}

import { AI_APP_TOKEN, AI_PROXY_URL } from '@/config';
import type { AssistantRequest, AssistantResponse, ChatMessage, MCQ } from '@/types';

export const CLOUD_TIMEOUT_MS = 45_000;
/** How many chat messages (including the new prompt) are sent as conversation history. */
export const MAX_HISTORY_MESSAGES = 12;

export type AssistantCloudErrorKind = 'not-configured' | 'timeout' | 'aborted' | 'network' | 'http' | 'invalid-response';

/** Typed failure from the cloud assistant; `askAssistant` turns any of these into an offline reply. */
export class AssistantCloudError extends Error {
  readonly kind: AssistantCloudErrorKind;
  /** HTTP status for `kind === 'http'`. */
  readonly status?: number;

  constructor(kind: AssistantCloudErrorKind, message: string, status?: number) {
    super(message);
    this.name = 'AssistantCloudError';
    this.kind = kind;
    this.status = status;
    // Keep `instanceof` reliable when classes are down-levelled.
    Object.setPrototypeOf(this, AssistantCloudError.prototype);
  }
}

export function isAssistantCloudError(error: unknown): error is AssistantCloudError {
  return error instanceof AssistantCloudError;
}

export function isCloudAIConfigured(): boolean {
  return AI_PROXY_URL.trim().length > 0;
}

export function getAssistantEndpoint(baseUrl: string = AI_PROXY_URL): string {
  return `${baseUrl.trim().replace(/\/+$/, '')}/v1/assistant`;
}

/**
 * Chat history → API messages: the last `MAX_HISTORY_MESSAGES` usable turns, oldest first,
 * always starting with a user turn and ending with the new prompt.
 */
export function buildAssistantMessages(history: ChatMessage[], prompt: string): AssistantRequest['messages'] {
  const text = prompt.trim();
  const turns = history
    .filter((message) => !message.error && message.text.trim().length > 0)
    .map((message) => ({ role: message.role, content: message.text }));

  const last = turns[turns.length - 1];
  if (text && !(last?.role === 'user' && last.content.trim() === text)) {
    turns.push({ role: 'user', content: text });
  }

  const recent = turns.slice(-MAX_HISTORY_MESSAGES);
  while (recent.length > 0 && recent[0].role !== 'user') recent.shift();
  return recent;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseMcq(value: unknown, index: number): MCQ {
  const invalid = (why: string) => new AssistantCloudError('invalid-response', `MCQ ${index + 1}: ${why}`);
  if (!isRecord(value)) throw invalid('not an object');
  const { question, options, answerIndex, explanation } = value;
  if (typeof question !== 'string' || !question.trim()) throw invalid('missing question');
  const isOption = (option: unknown): option is string => typeof option === 'string' && option.trim().length > 0;
  if (!Array.isArray(options) || options.length !== 4 || !options.every(isOption)) {
    throw invalid('expected exactly 4 text options');
  }
  if (typeof answerIndex !== 'number' || !Number.isInteger(answerIndex) || answerIndex < 0 || answerIndex >= 4) {
    throw invalid('answerIndex out of range');
  }
  if (explanation !== undefined && typeof explanation !== 'string') throw invalid('explanation must be text');
  return { question: question.trim(), options, answerIndex, explanation: explanation ?? '' };
}

/** Validates an unknown JSON body as an `AssistantResponse`; throws `invalid-response` otherwise. */
export function parseAssistantResponse(data: unknown): AssistantResponse {
  if (!isRecord(data) || typeof data.text !== 'string') {
    throw new AssistantCloudError('invalid-response', 'Response is missing a text field.');
  }
  const { text, mcqs } = data;
  if (mcqs === undefined || mcqs === null) {
    if (!text.trim()) throw new AssistantCloudError('invalid-response', 'Response text is empty.');
    return { text };
  }
  if (!Array.isArray(mcqs)) throw new AssistantCloudError('invalid-response', 'mcqs must be an array.');
  const parsed = mcqs.map(parseMcq);
  if (!text.trim() && parsed.length === 0) {
    throw new AssistantCloudError('invalid-response', 'Response is empty.');
  }
  return { text, mcqs: parsed };
}

async function readErrorMessage(response: Response): Promise<string> {
  try {
    const body: unknown = await response.json();
    if (isRecord(body)) {
      if (typeof body.error === 'string') return body.error;
      if (isRecord(body.error) && typeof body.error.message === 'string') return body.error.message;
      if (typeof body.message === 'string') return body.message;
    }
  } catch {
    // Non-JSON error body.
  }
  return `Request failed with status ${response.status}.`;
}

export interface CloudRequestOptions {
  signal?: AbortSignal;
  timeoutMs?: number;
}

/**
 * POSTs to `${AI_PROXY_URL}/v1/assistant` and returns the validated response.
 * Throws `AssistantCloudError` on timeout, network, HTTP or shape errors.
 */
export async function requestCloudAssistant(
  request: AssistantRequest,
  { signal, timeoutMs = CLOUD_TIMEOUT_MS }: CloudRequestOptions = {},
): Promise<AssistantResponse> {
  if (!isCloudAIConfigured()) {
    throw new AssistantCloudError('not-configured', 'EXPO_PUBLIC_AI_PROXY_URL is not set.');
  }

  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  const forwardAbort = () => controller.abort();
  if (signal?.aborted) controller.abort();
  signal?.addEventListener('abort', forwardAbort);

  const headers: Record<string, string> = { 'Content-Type': 'application/json', Accept: 'application/json' };
  const token = AI_APP_TOKEN.trim();
  if (token) headers['x-app-token'] = token;

  try {
    let response: Response;
    try {
      response = await fetch(getAssistantEndpoint(), {
        method: 'POST',
        headers,
        body: JSON.stringify(request),
        signal: controller.signal,
      });
    } catch (error) {
      if (timedOut) throw new AssistantCloudError('timeout', 'The study buddy took too long to answer.');
      if (signal?.aborted) throw new AssistantCloudError('aborted', 'Request cancelled.');
      throw new AssistantCloudError('network', error instanceof Error ? error.message : 'Network request failed.');
    }

    if (!response.ok) {
      throw new AssistantCloudError('http', await readErrorMessage(response), response.status);
    }

    let body: unknown;
    try {
      body = await response.json();
    } catch {
      if (timedOut) throw new AssistantCloudError('timeout', 'The study buddy took too long to answer.');
      throw new AssistantCloudError('invalid-response', 'Response was not valid JSON.');
    }
    return parseAssistantResponse(body);
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', forwardAbort);
  }
}

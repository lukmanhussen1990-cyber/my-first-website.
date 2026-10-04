import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import Anthropic from '@anthropic-ai/sdk';

import {
  buildMessages,
  buildSystem,
  createAssistant,
  EFFORT_BY_MODE,
  extractText,
  FALLBACK_BETA,
  MAX_MCQS,
  MAX_TOKENS,
  MODEL,
  sanitizeMcqs,
} from './assistant.js';
import { HttpError, RefusalError } from './errors.js';
import { formatStudyContext, MODE_INSTRUCTIONS, PERSONA } from './prompts.js';
import type { AssistantRequest, StudyContext } from './types.js';

const context: StudyContext = {
  studentName: 'Aisha',
  today: '2026-10-04',
  examDate: '2026-10-12T03:30:00.000Z',
  subjects: [
    { name: 'Databases', progress: 0.85, remainingChapters: ['Normalization', 'Transaction\nManagement'] },
    { name: 'Theory', progress: 1, examDate: '2026-10-10T04:00:00.000Z', remainingChapters: [] },
  ],
};

const validMcq = {
  question: 'Which normal form removes partial dependencies?',
  options: ['1NF', '2NF', '3NF', 'BCNF'],
  answerIndex: 1,
  explanation: '2NF removes partial dependencies on a composite key.',
};

describe('buildSystem', () => {
  it('is the frozen persona plus the mode block, with one cache breakpoint at the end', () => {
    const system = buildSystem('explain');
    assert.deepEqual(system, [
      { type: 'text', text: PERSONA },
      { type: 'text', text: MODE_INSTRUCTIONS.explain, cache_control: { type: 'ephemeral' } },
    ]);
    assert.equal(JSON.stringify(buildSystem('explain')), JSON.stringify(system));
  });

  it('has instructions for every mode and no volatile values', () => {
    for (const mode of ['chat', 'explain', 'mcq', 'summarize', 'plan'] as const) {
      const text = buildSystem(mode)
        .map((block) => block.text)
        .join('\n');
      assert.match(text, /Current mode:/);
      assert.doesNotMatch(text, /\d{4}-\d{2}-\d{2}/);
    }
  });
});

describe('formatStudyContext', () => {
  it('renders a deterministic, line-safe snapshot', () => {
    const rendered = formatStudyContext(context);
    assert.equal(rendered, formatStudyContext(structuredClone(context)));
    assert.equal(
      rendered,
      [
        '<study_context>',
        'Student: Aisha',
        'Today: Sunday 4 October 2026 (2026-10-04)',
        'Main exam: 2026-10-12T03:30:00.000Z (about 8 days from today)',
        'Subjects:',
        '• Databases: 85% done, remaining chapters (2): Normalization; Transaction Management',
        '• Theory: 100% done, exam 2026-10-10T04:00:00.000Z (about 6 days from today), all chapters done',
        '</study_context>',
      ].join('\n'),
    );
  });

  it('handles an empty plan and past or same-day exams', () => {
    const rendered = formatStudyContext({ today: '2026-10-12', examDate: '2026-10-12T03:30:00.000Z', subjects: [] });
    assert.match(rendered, /Main exam: .* \(today\)/);
    assert.match(rendered, /Subjects: none added yet/);
    assert.doesNotMatch(rendered, /Student:/);
    assert.match(formatStudyContext({ today: '2026-10-20', examDate: '2026-10-12T03:30:00.000Z', subjects: [] }), /already past/);
  });
});

describe('buildMessages', () => {
  it('sends a lone question as plain content without a message breakpoint', () => {
    assert.deepEqual(buildMessages({ mode: 'chat', messages: [{ role: 'user', content: 'Hi' }] }), [
      { role: 'user', content: 'Hi' },
    ]);
  });

  it('puts the study context in the latest user turn and caches the history before it', () => {
    const request: AssistantRequest = {
      mode: 'chat',
      context,
      messages: [
        { role: 'user', content: 'Q1' },
        { role: 'assistant', content: 'A1' },
        { role: 'user', content: 'Q2' },
        { role: 'assistant', content: 'A2' },
        { role: 'user', content: 'Q3' },
      ],
    };
    assert.deepEqual(buildMessages(request), [
      { role: 'user', content: 'Q1' },
      { role: 'assistant', content: 'A1' },
      { role: 'user', content: 'Q2' },
      { role: 'assistant', content: [{ type: 'text', text: 'A2', cache_control: { type: 'ephemeral' } }] },
      {
        role: 'user',
        content: [
          { type: 'text', text: formatStudyContext(context) },
          { type: 'text', text: 'Q3' },
        ],
      },
    ]);
  });

  it('refuses a request that does not end with the user', () => {
    assert.throws(() => buildMessages({ mode: 'chat', messages: [{ role: 'assistant', content: 'Hi' }] }));
  });
});

describe('sanitizeMcqs', () => {
  it('keeps well-formed questions and trims them', () => {
    const { mcqs, dropped } = sanitizeMcqs([{ ...validMcq, question: '  Which NF?  ', options: [' 1NF', '2NF ', '3NF', 'BCNF'] }]);
    assert.equal(dropped, 0);
    assert.deepEqual(mcqs, [{ ...validMcq, question: 'Which NF?' }]);
  });

  it('drops malformed questions', () => {
    const malformed = [
      { ...validMcq, options: ['1NF', '2NF', '3NF'] },
      { ...validMcq, options: ['1NF', '2NF', '3NF', 'BCNF', '4NF'] },
      { ...validMcq, options: ['1NF', '2nf', '2NF', 'BCNF'] },
      { ...validMcq, options: ['1NF', '', '3NF', 'BCNF'] },
      { ...validMcq, answerIndex: 4 },
      { ...validMcq, answerIndex: -1 },
      { ...validMcq, answerIndex: 1.5 },
      { ...validMcq, question: '   ' },
      { question: 'Missing fields' },
      null,
      'not an object',
    ];
    const { mcqs, dropped } = sanitizeMcqs([validMcq, ...malformed]);
    assert.deepEqual(mcqs, [validMcq]);
    assert.equal(dropped, malformed.length);
  });

  it(`caps the set at ${MAX_MCQS} questions`, () => {
    const { mcqs, dropped } = sanitizeMcqs(Array.from({ length: MAX_MCQS + 2 }, () => validMcq));
    assert.equal(mcqs.length, MAX_MCQS);
    assert.equal(dropped, 2);
  });
});

describe('extractText', () => {
  it('joins text blocks and ignores thinking and fallback blocks', () => {
    const content = [
      { type: 'thinking', thinking: '', signature: 'sig' },
      { type: 'text', text: 'Hello ', citations: null },
      { type: 'text', text: 'there.\n', citations: null },
    ] as unknown as Anthropic.Beta.BetaContentBlock[];
    assert.equal(extractText(content), 'Hello there.');
  });
});

/* ------------------------------------------------------------------ */
/* createAssistant — real SDK client, fake transport (no network).     */
/* ------------------------------------------------------------------ */

interface CapturedRequest {
  url: string;
  headers: Headers;
  body: Record<string, unknown>;
}

function message(overrides: Record<string, unknown> = {}) {
  return {
    id: 'msg_test',
    type: 'message',
    role: 'assistant',
    model: MODEL,
    content: [
      { type: 'thinking', thinking: '', signature: 'sig' },
      { type: 'text', text: 'Normalization reduces redundancy.', citations: null },
    ],
    stop_reason: 'end_turn',
    stop_sequence: null,
    stop_details: null,
    usage: {
      input_tokens: 12,
      output_tokens: 34,
      cache_read_input_tokens: 900,
      cache_creation_input_tokens: 0,
      iterations: null,
    },
    ...overrides,
  };
}

function fakeClient(respond: () => Response): { client: Anthropic; requests: CapturedRequest[] } {
  const requests: CapturedRequest[] = [];
  const fetch = async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    requests.push({
      url: String(input),
      headers: new Headers(init?.headers),
      body: JSON.parse(String(init?.body)) as Record<string, unknown>,
    });
    return respond();
  };
  return { client: new Anthropic({ apiKey: 'test-key', maxRetries: 0, fetch }), requests };
}

const jsonResponse = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } });

const signal = () => new AbortController().signal;

describe('createAssistant', () => {
  it('sends text modes through the beta API with fallback, adaptive thinking and per-mode effort', async () => {
    const { client, requests } = fakeClient(() => jsonResponse(message()));
    const result = await createAssistant(client).respond(
      { mode: 'explain', messages: [{ role: 'user', content: 'Explain normalization' }], context },
      { signal: signal() },
    );

    assert.deepEqual(result.response, { text: 'Normalization reduces redundancy.' });
    assert.equal(result.meta.cacheReadTokens, 900);
    assert.equal(result.meta.servedByFallback, false);

    const [request] = requests;
    assert.ok(request);
    assert.match(request.url, /\/v1\/messages\?beta=true$/);
    assert.equal(request.headers.get('anthropic-beta'), FALLBACK_BETA);
    assert.equal(request.body.model, 'claude-opus-5-5');
    assert.equal(request.body.max_tokens, MAX_TOKENS);
    assert.equal(request.body.fallbacks, 'default');
    assert.deepEqual(request.body.thinking, { type: 'adaptive', display: 'omitted' });
    assert.deepEqual(request.body.output_config, { effort: EFFORT_BY_MODE.explain });
    assert.equal(request.body.cache_control, undefined);
    assert.equal(request.body.stream, undefined);
    assert.deepEqual(request.body.system, buildSystem('explain'));
  });

  it('uses low effort for chat, explain and summarize and medium for plan and mcq', () => {
    assert.deepEqual(EFFORT_BY_MODE, { chat: 'low', explain: 'low', summarize: 'low', plan: 'medium', mcq: 'medium' });
  });

  it('reports a fallback-served answer', async () => {
    const { client } = fakeClient(() =>
      jsonResponse(
        message({
          model: 'claude-opus-4-8',
          content: [
            { type: 'fallback', from: { model: MODEL }, to: { model: 'claude-opus-4-8' }, trigger: { type: 'refusal' } },
            { type: 'text', text: 'Here you go.', citations: null },
          ],
          usage: { ...message().usage, iterations: [{ type: 'fallback_message', input_tokens: 1, output_tokens: 2 }] },
        }),
      ),
    );
    const result = await createAssistant(client).respond(
      { mode: 'chat', messages: [{ role: 'user', content: 'Hi' }] },
      { signal: signal() },
    );
    assert.equal(result.response.text, 'Here you go.');
    assert.equal(result.meta.servedByFallback, true);
    assert.equal(result.meta.model, 'claude-opus-4-8');
  });

  it('turns a refusal into a RefusalError before reading content', async () => {
    const { client } = fakeClient(() =>
      jsonResponse(
        message({
          content: [],
          stop_reason: 'refusal',
          stop_details: { type: 'refusal', category: 'bio', explanation: null },
        }),
      ),
    );
    await assert.rejects(
      createAssistant(client).respond({ mode: 'chat', messages: [{ role: 'user', content: 'Hi' }] }, { signal: signal() }),
      (error: unknown) => error instanceof RefusalError && error.status === 422 && error.category === 'bio',
    );
  });

  it('flags a truncated answer and rejects an empty one', async () => {
    const truncated = fakeClient(() => jsonResponse(message({ stop_reason: 'max_tokens' })));
    const result = await createAssistant(truncated.client).respond(
      { mode: 'summarize', messages: [{ role: 'user', content: 'notes' }] },
      { signal: signal() },
    );
    assert.match(result.response.text, /cut short/);

    const empty = fakeClient(() => jsonResponse(message({ content: [{ type: 'thinking', thinking: '', signature: 's' }] })));
    await assert.rejects(
      createAssistant(empty.client).respond({ mode: 'chat', messages: [{ role: 'user', content: 'Hi' }] }, { signal: signal() }),
      (error: unknown) => error instanceof HttpError && error.code === 'upstream_error',
    );
  });

  it('requests structured output for MCQs and drops malformed questions', async () => {
    const output = {
      intro: 'Five quick ones on normal forms.',
      questions: [validMcq, { ...validMcq, options: ['A', 'B'] }, { ...validMcq, answerIndex: 7 }],
    };
    const { client, requests } = fakeClient(() =>
      jsonResponse(message({ content: [{ type: 'text', text: JSON.stringify(output), citations: null }] })),
    );
    const result = await createAssistant(client).respond(
      { mode: 'mcq', messages: [{ role: 'user', content: 'Quiz me on normalization' }] },
      { signal: signal() },
    );

    assert.deepEqual(result.response, { text: output.intro, mcqs: [validMcq] });
    assert.equal(result.meta.droppedMcqs, 2);

    const body = requests[0]?.body;
    assert.ok(body);
    assert.equal(body.fallbacks, 'default');
    const outputConfig = body.output_config as { effort: string; format: { type: string; schema: Record<string, unknown> } };
    assert.equal(outputConfig.effort, 'medium');
    assert.equal(outputConfig.format.type, 'json_schema');
    assert.deepEqual((outputConfig.format.schema as { required: string[] }).required, ['intro', 'questions']);
  });

  it('answers an MCQ request with no usable questions as text only', async () => {
    const output = { intro: '', questions: [{ ...validMcq, options: [] }] };
    const { client } = fakeClient(() =>
      jsonResponse(message({ content: [{ type: 'text', text: JSON.stringify(output), citations: null }] })),
    );
    const result = await createAssistant(client).respond(
      { mode: 'mcq', messages: [{ role: 'user', content: 'Quiz me' }] },
      { signal: signal() },
    );
    assert.equal(result.response.mcqs, undefined);
    assert.match(result.response.text, /Tell me the topic/);
  });

  it('surfaces typed SDK errors', async () => {
    const { client } = fakeClient(() =>
      jsonResponse({ type: 'error', error: { type: 'rate_limit_error', message: 'slow down' } }, 429, { 'retry-after': '7' }),
    );
    await assert.rejects(
      createAssistant(client).respond({ mode: 'chat', messages: [{ role: 'user', content: 'Hi' }] }, { signal: signal() }),
      Anthropic.RateLimitError,
    );
  });
});

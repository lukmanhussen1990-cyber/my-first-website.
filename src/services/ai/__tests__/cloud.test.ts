import type { AssistantRequest, ChatMessage } from '@/types';

import {
  AssistantCloudError,
  buildAssistantMessages,
  getAssistantEndpoint,
  MAX_HISTORY_MESSAGES,
  parseAssistantResponse,
  requestCloudAssistant,
} from '../cloud';

// `jest.mock` factories may only reference variables prefixed with `mock`.
const mockConfig = { url: 'https://proxy.test/', token: 'app-secret' };
jest.mock('@/config', () => ({
  get AI_PROXY_URL() {
    return mockConfig.url;
  },
  get AI_APP_TOKEN() {
    return mockConfig.token;
  },
}));

const message = (role: ChatMessage['role'], text: string, extra: Partial<ChatMessage> = {}): ChatMessage => ({
  id: `${role}-${text}`,
  role,
  text,
  mode: 'chat',
  createdAt: '2026-10-05T10:00:00.000Z',
  ...extra,
});

const MCQ = {
  question: 'Which normal form removes transitive dependencies?',
  options: ['1NF', '2NF', '3NF', 'BCNF'],
  answerIndex: 2,
  explanation: '3NF removes transitive dependencies between non-key attributes.',
};

const REQUEST: AssistantRequest = {
  mode: 'chat',
  messages: [{ role: 'user', content: 'Explain deadlocks' }],
};

/** Minimal stand-in for the parts of `Response` the client reads. */
function fakeResponse(status: number, body: unknown, { invalidJson = false } = {}): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => (invalidJson ? Promise.reject(new SyntaxError('Unexpected token <')) : Promise.resolve(body)),
  } as unknown as Response;
}

type FetchArgs = Parameters<typeof fetch>;
const fetchMock = jest.fn<Promise<Response>, FetchArgs>();
const originalFetch = globalThis.fetch;

beforeEach(() => {
  mockConfig.url = 'https://proxy.test/';
  mockConfig.token = 'app-secret';
  fetchMock.mockReset();
  globalThis.fetch = fetchMock as typeof fetch;
});

afterAll(() => {
  globalThis.fetch = originalFetch;
});

/** Resolves to the error `promise` rejects with (fails the test if it resolves). */
async function rejectionOf(promise: Promise<unknown>): Promise<AssistantCloudError> {
  try {
    await promise;
  } catch (error) {
    expect(error).toBeInstanceOf(AssistantCloudError);
    return error as AssistantCloudError;
  }
  throw new Error('Expected the request to reject.');
}

describe('buildAssistantMessages', () => {
  it('maps history, drops errors/empties and appends the new prompt', () => {
    const history = [
      message('user', 'What is paging?'),
      message('assistant', 'Paging splits memory into fixed-size pages.'),
      message('assistant', 'Something went wrong', { error: true }),
      message('user', '   '),
    ];
    expect(buildAssistantMessages(history, '  And segmentation? ')).toEqual([
      { role: 'user', content: 'What is paging?' },
      { role: 'assistant', content: 'Paging splits memory into fixed-size pages.' },
      { role: 'user', content: 'And segmentation?' },
    ]);
  });

  it('does not duplicate a prompt already at the end of the history', () => {
    const history = [message('user', 'Make me a plan')];
    expect(buildAssistantMessages(history, 'Make me a plan')).toEqual([{ role: 'user', content: 'Make me a plan' }]);
  });

  it('keeps only the most recent turns and always starts with a user turn', () => {
    const history = Array.from({ length: 20 }, (_, i) => message(i % 2 === 0 ? 'user' : 'assistant', `turn ${i}`));
    const messages = buildAssistantMessages(history, 'latest question');
    expect(messages.length).toBeLessThanOrEqual(MAX_HISTORY_MESSAGES);
    expect(messages[0].role).toBe('user');
    expect(messages[messages.length - 1]).toEqual({ role: 'user', content: 'latest question' });
  });

  it('drops a leading assistant greeting', () => {
    const history = [message('assistant', 'Hi! I am your study buddy.')];
    expect(buildAssistantMessages(history, 'Hello')).toEqual([{ role: 'user', content: 'Hello' }]);
  });
});

describe('parseAssistantResponse', () => {
  it('accepts a plain text reply', () => {
    expect(parseAssistantResponse({ text: 'Deadlocks need four conditions.' })).toEqual({
      text: 'Deadlocks need four conditions.',
    });
  });

  it('accepts MCQs and defaults a missing explanation', () => {
    const { explanation: _omit, ...withoutExplanation } = MCQ;
    expect(parseAssistantResponse({ text: 'Quiz time', mcqs: [MCQ, withoutExplanation] })).toEqual({
      text: 'Quiz time',
      mcqs: [MCQ, { ...withoutExplanation, explanation: '' }],
    });
  });

  it.each([
    ['a non-object body', 'oops'],
    ['a missing text field', { mcqs: [] }],
    ['empty text without MCQs', { text: '  ' }],
    ['mcqs that are not an array', { text: 'x', mcqs: {} }],
    ['an MCQ with three options', { text: 'x', mcqs: [{ ...MCQ, options: ['a', 'b', 'c'] }] }],
    ['an MCQ with an out-of-range answer', { text: 'x', mcqs: [{ ...MCQ, answerIndex: 4 }] }],
    ['an MCQ without a question', { text: 'x', mcqs: [{ ...MCQ, question: '' }] }],
  ])('rejects %s', async (_label, body) => {
    const error = await rejectionOf(Promise.resolve().then(() => parseAssistantResponse(body)));
    expect(error.kind).toBe('invalid-response');
  });
});

describe('requestCloudAssistant', () => {
  it('builds the endpoint without doubled slashes', () => {
    expect(getAssistantEndpoint('https://proxy.test///')).toBe('https://proxy.test/v1/assistant');
  });

  it('POSTs the request with the app token and returns the parsed reply', async () => {
    fetchMock.mockResolvedValue(fakeResponse(200, { text: 'Here you go.' }));

    await expect(requestCloudAssistant(REQUEST)).resolves.toEqual({ text: 'Here you go.' });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://proxy.test/v1/assistant');
    expect(init?.method).toBe('POST');
    expect(init?.headers).toMatchObject({ 'Content-Type': 'application/json', 'x-app-token': 'app-secret' });
    expect(JSON.parse(String(init?.body))).toEqual(REQUEST);
  });

  it('omits the token header when no token is configured', async () => {
    mockConfig.token = '';
    fetchMock.mockResolvedValue(fakeResponse(200, { text: 'ok' }));
    await requestCloudAssistant(REQUEST);
    expect(fetchMock.mock.calls[0][1]?.headers).not.toHaveProperty('x-app-token');
  });

  it('fails fast with not-configured when no proxy URL is set', async () => {
    mockConfig.url = '  ';
    const error = await rejectionOf(requestCloudAssistant(REQUEST));
    expect(error.kind).toBe('not-configured');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('maps HTTP errors to kind "http" with the status and server message', async () => {
    fetchMock.mockResolvedValue(
      fakeResponse(429, { error: { code: 'rate_limited', message: 'Slow down a little.' } }),
    );
    const error = await rejectionOf(requestCloudAssistant(REQUEST));
    expect(error).toMatchObject({ kind: 'http', status: 429, message: 'Slow down a little.' });
  });

  it('falls back to a generic message for non-JSON HTTP errors', async () => {
    fetchMock.mockResolvedValue(fakeResponse(502, null, { invalidJson: true }));
    const error = await rejectionOf(requestCloudAssistant(REQUEST));
    expect(error).toMatchObject({ kind: 'http', status: 502, message: 'Request failed with status 502.' });
  });

  it('maps a rejected fetch to kind "network"', async () => {
    fetchMock.mockRejectedValue(new TypeError('Network request failed'));
    const error = await rejectionOf(requestCloudAssistant(REQUEST));
    expect(error).toMatchObject({ kind: 'network', message: 'Network request failed' });
  });

  it('maps a malformed 200 body to kind "invalid-response"', async () => {
    fetchMock.mockResolvedValue(fakeResponse(200, null, { invalidJson: true }));
    expect((await rejectionOf(requestCloudAssistant(REQUEST))).kind).toBe('invalid-response');

    fetchMock.mockResolvedValue(fakeResponse(200, { answer: 'wrong shape' }));
    expect((await rejectionOf(requestCloudAssistant(REQUEST))).kind).toBe('invalid-response');
  });

  describe('aborts', () => {
    /** A fetch that never settles until its signal aborts, like a hung connection. */
    const hangUntilAborted = (_url: FetchArgs[0], init?: FetchArgs[1]) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new Error('The operation was aborted.')));
      });

    beforeEach(() => jest.useFakeTimers());
    afterEach(() => jest.useRealTimers());

    it('maps the timeout to kind "timeout"', async () => {
      fetchMock.mockImplementation(hangUntilAborted);
      const pending = rejectionOf(requestCloudAssistant(REQUEST, { timeoutMs: 1_000 }));
      jest.advanceTimersByTime(1_000);
      expect((await pending).kind).toBe('timeout');
    });

    it('maps a caller abort to kind "aborted"', async () => {
      fetchMock.mockImplementation(hangUntilAborted);
      const controller = new AbortController();
      const pending = rejectionOf(requestCloudAssistant(REQUEST, { signal: controller.signal }));
      controller.abort();
      expect((await pending).kind).toBe('aborted');
    });
  });
});

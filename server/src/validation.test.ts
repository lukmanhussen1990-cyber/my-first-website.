import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { MAX_MESSAGE_CHARS, MAX_MESSAGES, normalizeMessages, parseAssistantRequest } from './validation.js';

const userMessage = (content = 'Explain normalization') => ({ role: 'user' as const, content });

const validContext = {
  studentName: '  Aisha ',
  today: '2026-10-04',
  examDate: '2026-10-12T03:30:00.000Z',
  subjects: [{ name: 'Databases', progress: 0.85, remainingChapters: ['Normalization', 'Transactions'] }],
};

function expectInvalid(body: unknown, fragment: string): void {
  const result = parseAssistantRequest(body);
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.message, new RegExp(fragment));
}

describe('parseAssistantRequest', () => {
  it('accepts a minimal request', () => {
    const result = parseAssistantRequest({ mode: 'chat', messages: [userMessage()] });
    assert.deepEqual(result, { ok: true, value: { mode: 'chat', messages: [userMessage()] } });
  });

  it('accepts every mode', () => {
    for (const mode of ['chat', 'explain', 'mcq', 'summarize', 'plan']) {
      assert.equal(parseAssistantRequest({ mode, messages: [userMessage()] }).ok, true, mode);
    }
  });

  it('rejects bodies that are not request objects', () => {
    expectInvalid(null, '.');
    expectInvalid([], '.');
    expectInvalid('hello', '.');
    expectInvalid({ messages: [userMessage()] }, 'mode');
    expectInvalid({ mode: 'chat' }, 'messages');
  });

  it('rejects an unknown mode', () => {
    expectInvalid({ mode: 'essay', messages: [userMessage()] }, 'mode');
  });

  it(`rejects more than ${MAX_MESSAGES} messages`, () => {
    const messages = Array.from({ length: MAX_MESSAGES + 1 }, (_, index) => ({
      role: index % 2 === 0 ? 'user' : 'assistant',
      content: `message ${index}`,
    }));
    expectInvalid({ mode: 'chat', messages }, `at most ${MAX_MESSAGES} messages`);
  });

  it('accepts exactly the maximum number of messages', () => {
    const messages = Array.from({ length: MAX_MESSAGES }, (_, index) => ({
      role: index % 2 === 0 ? 'assistant' : 'user',
      content: `message ${index}`,
    }));
    assert.equal(parseAssistantRequest({ mode: 'chat', messages }).ok, true);
  });

  it('rejects empty conversations', () => {
    expectInvalid({ mode: 'chat', messages: [] }, 'at least one message');
  });

  it(`rejects messages longer than ${MAX_MESSAGE_CHARS} characters`, () => {
    expectInvalid(
      { mode: 'summarize', messages: [userMessage('x'.repeat(MAX_MESSAGE_CHARS + 1))] },
      `messages.0.content: must be at most ${MAX_MESSAGE_CHARS}`,
    );
    assert.equal(parseAssistantRequest({ mode: 'summarize', messages: [userMessage('x'.repeat(MAX_MESSAGE_CHARS))] }).ok, true);
  });

  it('rejects blank messages and unknown roles', () => {
    expectInvalid({ mode: 'chat', messages: [userMessage('   \n ')] }, 'must not be empty');
    expectInvalid({ mode: 'chat', messages: [{ role: 'system', content: 'hi' }] }, 'role');
  });

  it('requires the last message to come from the user', () => {
    expectInvalid(
      { mode: 'chat', messages: [userMessage(), { role: 'assistant', content: 'Sure!' }] },
      'last message must be from the user',
    );
  });

  it('normalizes the conversation', () => {
    const result = parseAssistantRequest({
      mode: 'chat',
      messages: [
        { role: 'assistant', content: "Hey! I'm your AI Study Buddy." },
        userMessage('First'),
        userMessage('Second'),
      ],
    });
    assert.ok(result.ok);
    assert.deepEqual(result.value.messages, [{ role: 'user', content: 'First\n\nSecond' }]);
  });

  it('strips unknown fields', () => {
    const result = parseAssistantRequest({
      mode: 'chat',
      messages: [{ ...userMessage(), id: 'm1' }],
      apiKey: 'nope',
    });
    assert.ok(result.ok);
    assert.deepEqual(Object.keys(result.value), ['mode', 'messages']);
    assert.deepEqual(Object.keys(result.value.messages[0] ?? {}), ['role', 'content']);
  });

  describe('context', () => {
    it('accepts and tidies a study context', () => {
      const result = parseAssistantRequest({
        mode: 'plan',
        messages: [userMessage('Make a revision plan')],
        context: {
          ...validContext,
          subjects: [
            { name: ' Networking ', progress: 1.0000001, remainingChapters: ['  TCP  ', '', '   '] },
            { name: 'Theory', progress: -0.2, examDate: '2026-10-10T04:00:00.000Z', remainingChapters: [] },
          ],
        },
      });
      assert.ok(result.ok);
      assert.deepEqual(result.value.context, {
        studentName: 'Aisha',
        today: '2026-10-04',
        examDate: '2026-10-12T03:30:00.000Z',
        subjects: [
          { name: 'Networking', progress: 1, remainingChapters: ['TCP'] },
          { name: 'Theory', progress: 0, examDate: '2026-10-10T04:00:00.000Z', remainingChapters: [] },
        ],
      });
    });

    it('drops a blank student name', () => {
      const result = parseAssistantRequest({
        mode: 'chat',
        messages: [userMessage()],
        context: { ...validContext, studentName: '   ' },
      });
      assert.ok(result.ok);
      assert.equal(result.value.context?.studentName, undefined);
    });

    it('rejects malformed dates', () => {
      expectInvalid({ mode: 'plan', messages: [userMessage()], context: { ...validContext, today: '04/10/2026' } }, 'context.today');
      expectInvalid({ mode: 'plan', messages: [userMessage()], context: { ...validContext, today: '2026-13-45' } }, 'context.today');
      expectInvalid({ mode: 'plan', messages: [userMessage()], context: { ...validContext, examDate: 'soon' } }, 'context.examDate');
    });

    it('rejects structurally invalid subjects', () => {
      expectInvalid(
        { mode: 'plan', messages: [userMessage()], context: { ...validContext, subjects: [{ name: 'DB', progress: '85%' }] } },
        'context.subjects.0',
      );
      expectInvalid(
        {
          mode: 'plan',
          messages: [userMessage()],
          context: { ...validContext, subjects: [{ name: '  ', progress: 0.5, remainingChapters: [] }] },
        },
        'context.subjects.0.name',
      );
    });
  });
});

describe('normalizeMessages', () => {
  it('drops leading assistant turns and merges consecutive roles', () => {
    assert.deepEqual(
      normalizeMessages([
        { role: 'assistant', content: 'Hi!' },
        { role: 'assistant', content: 'Ask me anything.' },
        { role: 'user', content: 'Q1' },
        { role: 'assistant', content: 'A1' },
        { role: 'assistant', content: 'A1 continued' },
        { role: 'user', content: 'Q2' },
      ]),
      [
        { role: 'user', content: 'Q1' },
        { role: 'assistant', content: 'A1\n\nA1 continued' },
        { role: 'user', content: 'Q2' },
      ],
    );
  });

  it('does not mutate its input', () => {
    const input = [
      { role: 'user' as const, content: 'a' },
      { role: 'user' as const, content: 'b' },
    ];
    normalizeMessages(input);
    assert.deepEqual(input, [
      { role: 'user', content: 'a' },
      { role: 'user', content: 'b' },
    ]);
  });

  it('returns nothing when there is no user turn', () => {
    assert.deepEqual(normalizeMessages([{ role: 'assistant', content: 'Hi!' }]), []);
  });
});

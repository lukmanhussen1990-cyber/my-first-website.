import { z } from 'zod';

import { ASSISTANT_MODES } from './types.js';
import type { AssistantRequest, AssistantRequestMessage, StudyContext } from './types.js';

export const MAX_MESSAGES = 30;
export const MAX_MESSAGE_CHARS = 8000;

const MAX_SUBJECTS = 40;
const MAX_CHAPTERS_PER_SUBJECT = 200;
const MAX_LABEL_CHARS = 200;

/** Trims and truncates free-text labels in the study context instead of rejecting the whole request. */
const label = (maxChars: number) => z.string().transform((value) => value.trim().slice(0, maxChars));

const dateTimeString = z
  .string()
  .trim()
  .max(64)
  .refine((value) => !Number.isNaN(Date.parse(value)), 'must be an ISO-8601 date-time');

const dayKey = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'must be a YYYY-MM-DD day')
  .refine((value) => !Number.isNaN(Date.parse(`${value}T00:00:00Z`)), 'must be a real calendar day');

const MessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z
    .string()
    .max(MAX_MESSAGE_CHARS, `must be at most ${MAX_MESSAGE_CHARS} characters`)
    .refine((value) => value.trim().length > 0, 'must not be empty'),
});

const SubjectSchema = z.object({
  name: label(120).pipe(z.string().min(1, 'must not be empty')),
  // Clamp rather than reject: progress is computed client-side and may drift by a rounding error.
  progress: z
    .number()
    .refine(Number.isFinite, 'must be a number')
    .transform((value) => Math.min(1, Math.max(0, value))),
  examDate: dateTimeString.optional(),
  remainingChapters: z
    .array(label(MAX_LABEL_CHARS))
    .transform((chapters) => chapters.filter(Boolean).slice(0, MAX_CHAPTERS_PER_SUBJECT)),
});

const ContextSchema = z.object({
  studentName: label(80)
    .optional()
    .transform((value) => value || undefined),
  today: dayKey,
  examDate: dateTimeString,
  subjects: z.array(SubjectSchema).transform((subjects) => subjects.slice(0, MAX_SUBJECTS)),
});

export const AssistantRequestSchema = z.object({
  mode: z.enum(ASSISTANT_MODES),
  messages: z
    .array(MessageSchema)
    .min(1, 'must contain at least one message')
    .max(MAX_MESSAGES, `must contain at most ${MAX_MESSAGES} messages`)
    .refine((messages) => messages.at(-1)?.role === 'user', 'the last message must be from the user'),
  context: ContextSchema.optional(),
});

/**
 * Shapes a client transcript into what the Messages API expects: the first
 * turn must be the user's (a leading assistant greeting is dropped) and
 * consecutive same-role turns are merged. Deterministic, so a growing
 * conversation keeps a byte-identical prefix for prompt caching.
 */
export function normalizeMessages(messages: readonly AssistantRequestMessage[]): AssistantRequestMessage[] {
  const firstUser = messages.findIndex((message) => message.role === 'user');
  if (firstUser === -1) return [];
  const normalized: AssistantRequestMessage[] = [];
  for (const message of messages.slice(firstUser)) {
    const previous = normalized.at(-1);
    if (previous && previous.role === message.role) {
      previous.content = `${previous.content}\n\n${message.content}`;
    } else {
      normalized.push({ role: message.role, content: message.content });
    }
  }
  return normalized;
}

export type ValidationResult = { ok: true; value: AssistantRequest } | { ok: false; message: string };

function formatIssues(error: z.ZodError): string {
  return error.issues
    .slice(0, 3)
    .map((issue) => (issue.path.length > 0 ? `${issue.path.join('.')}: ${issue.message}` : issue.message))
    .join('; ');
}

/** Validates an untrusted request body and returns a normalized AssistantRequest. */
export function parseAssistantRequest(body: unknown): ValidationResult {
  const result = AssistantRequestSchema.safeParse(body);
  if (!result.success) return { ok: false, message: formatIssues(result.error) };

  const { mode, messages, context } = result.data;
  const value: AssistantRequest = { mode, messages: normalizeMessages(messages) };
  if (context) value.context = context satisfies StudyContext;
  return { ok: true, value };
}

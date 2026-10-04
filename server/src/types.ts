/**
 * Wire types shared with the app. Mirrors the AI section of `src/types/index.ts`
 * in the app — keep both in sync when the contract changes.
 */

export const ASSISTANT_MODES = ['chat', 'explain', 'mcq', 'summarize', 'plan'] as const;

export type AssistantMode = (typeof ASSISTANT_MODES)[number];

export interface MCQ {
  question: string;
  /** Exactly four options. */
  options: string[];
  answerIndex: number;
  explanation: string;
}

/** Snapshot of the student's plan sent to the assistant for personalised answers. */
export interface StudyContext {
  studentName?: string;
  /** Local day key ("YYYY-MM-DD") for "today". */
  today: string;
  /** ISO-8601 timestamp of the main exam. */
  examDate: string;
  subjects: {
    name: string;
    progress: number; // 0–1
    examDate?: string;
    remainingChapters: string[];
  }[];
}

export interface AssistantRequestMessage {
  role: 'user' | 'assistant';
  content: string;
}

/** Request body for POST /v1/assistant. */
export interface AssistantRequest {
  mode: AssistantMode;
  /** Conversation so far, oldest first; the last item is the new user message. */
  messages: AssistantRequestMessage[];
  context?: StudyContext;
}

/** Response body for POST /v1/assistant. */
export interface AssistantResponse {
  text: string;
  mcqs?: MCQ[];
}

/** Stable, machine-readable error codes returned in `{ error: { code, message } }`. */
export type ErrorCode =
  | 'invalid_request'
  | 'invalid_json'
  | 'unsupported_media_type'
  | 'payload_too_large'
  | 'unauthorized'
  | 'forbidden_origin'
  | 'not_found'
  | 'method_not_allowed'
  | 'rate_limited'
  | 'not_configured'
  | 'refused'
  | 'timeout'
  | 'upstream_auth'
  | 'upstream_rate_limited'
  | 'upstream_unavailable'
  | 'upstream_timeout'
  | 'upstream_error'
  | 'shutting_down'
  | 'internal_error';

/** Every non-2xx response body. */
export interface ErrorBody {
  error: {
    code: ErrorCode;
    message: string;
  };
}

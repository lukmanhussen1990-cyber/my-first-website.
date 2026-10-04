import Anthropic from '@anthropic-ai/sdk';

import type { ErrorBody, ErrorCode } from './types.js';

/** An error that is safe to show to API clients: `message` never contains secrets or internals. */
export class HttpError extends Error {
  readonly status: number;
  readonly code: ErrorCode;
  readonly headers: Readonly<Record<string, string>>;

  constructor(
    status: number,
    code: ErrorCode,
    message: string,
    options: { headers?: Record<string, string>; cause?: unknown } = {},
  ) {
    super(message, { cause: options.cause });
    this.name = 'HttpError';
    this.status = status;
    this.code = code;
    this.headers = options.headers ?? {};
  }

  toBody(): ErrorBody {
    return { error: { code: this.code, message: this.message } };
  }
}

/** The model (and its server-side fallback) declined the request. */
export class RefusalError extends HttpError {
  readonly category: string | null;

  constructor(category: string | null) {
    super(
      422,
      'refused',
      "The study buddy can't help with that request. Try rephrasing it or asking about a different topic.",
    );
    this.name = 'RefusalError';
    this.category = category;
  }
}

/** Upstream `retry-after` in whole seconds, if the API sent a usable one. */
function retryAfterHeader(error: InstanceType<typeof Anthropic.APIError>): Record<string, string> {
  const value = error.headers?.get('retry-after');
  const seconds = value ? Number.parseInt(value, 10) : Number.NaN;
  return Number.isFinite(seconds) && seconds >= 0 ? { 'Retry-After': String(seconds) } : {};
}

/**
 * Maps anything thrown while serving a request to a client-safe HttpError.
 * SDK messages are never forwarded — they can echo request details — and the
 * original error is kept as `cause` for server-side logging only.
 */
export function toHttpError(error: unknown, options: { timedOut?: boolean } = {}): HttpError {
  if (error instanceof HttpError) return error;

  // Our own deadline aborts the SDK call; report it as a timeout, not a client abort.
  if (error instanceof Anthropic.APIUserAbortError) {
    return options.timedOut
      ? new HttpError(504, 'timeout', 'The study buddy took too long to answer. Please try again.', { cause: error })
      : new HttpError(499, 'timeout', 'The request was cancelled.', { cause: error });
  }
  if (error instanceof Anthropic.APIConnectionTimeoutError) {
    return new HttpError(504, 'upstream_timeout', 'The AI service took too long to respond. Please try again.', {
      cause: error,
    });
  }
  if (error instanceof Anthropic.APIConnectionError) {
    return new HttpError(502, 'upstream_unavailable', 'Could not reach the AI service. Please try again shortly.', {
      cause: error,
    });
  }
  if (error instanceof Anthropic.AuthenticationError || error instanceof Anthropic.PermissionDeniedError) {
    return new HttpError(502, 'upstream_auth', 'The AI service is not configured correctly on the server.', {
      cause: error,
    });
  }
  if (error instanceof Anthropic.RateLimitError) {
    return new HttpError(503, 'upstream_rate_limited', 'The AI service is busy right now. Please try again shortly.', {
      cause: error,
      headers: retryAfterHeader(error),
    });
  }
  if (error instanceof Anthropic.BadRequestError || error instanceof Anthropic.UnprocessableEntityError) {
    return new HttpError(502, 'upstream_error', 'The AI service rejected the request.', { cause: error });
  }
  if (error instanceof Anthropic.InternalServerError) {
    // Includes 529 "overloaded".
    return new HttpError(503, 'upstream_unavailable', 'The AI service is temporarily unavailable. Please try again shortly.', {
      cause: error,
      headers: retryAfterHeader(error),
    });
  }
  if (error instanceof Anthropic.APIError) {
    return new HttpError(502, 'upstream_error', 'The AI service returned an unexpected error.', { cause: error });
  }
  if (error instanceof Anthropic.AnthropicError) {
    // e.g. structured output that failed to parse.
    return new HttpError(502, 'upstream_error', 'The AI service returned an unreadable answer. Please try again.', {
      cause: error,
    });
  }
  return new HttpError(500, 'internal_error', 'Something went wrong on the server.', { cause: error });
}

/** Log-safe summary of an error: class, status and API request id — never the message body or stack. */
export function describeError(error: unknown): Record<string, string | number | null> {
  const root = error instanceof HttpError && error.cause !== undefined ? error.cause : error;
  if (root instanceof Anthropic.APIError) {
    return {
      errorClass: root.constructor.name,
      upstreamStatus: root.status ?? null,
      upstreamType: root.type ?? null,
      upstreamRequestId: root.requestID ?? null,
    };
  }
  return { errorClass: root instanceof Error ? root.constructor.name : typeof root };
}

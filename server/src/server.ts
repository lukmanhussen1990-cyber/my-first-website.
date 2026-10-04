import { randomBytes, randomUUID } from 'node:crypto';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';

import { MODEL, type Assistant, type AssistantCallMeta } from './assistant.js';
import { BODY_LIMIT_BYTES, type Config } from './config.js';
import { describeError, HttpError, toHttpError, type AbortReason } from './errors.js';
import {
  applyCors,
  clientIp,
  CORS_ALLOWED_HEADERS,
  createIpHasher,
  isJsonContentType,
  readJsonBody,
  sendJson,
  tokensMatch,
} from './http.js';
import type { LogFields, Logger } from './logger.js';
import type { TokenBucketRateLimiter } from './rateLimit.js';
import { parseAssistantRequest } from './validation.js';

export interface AppDeps {
  config: Config;
  /** Null when no API key is configured: /v1/assistant then answers 503 `not_configured`. */
  assistant: Assistant | null;
  rateLimiter: TokenBucketRateLimiter;
  logger: Logger;
}

export interface App {
  server: Server;
  /** Stops accepting work, lets in-flight requests finish for up to `graceMs`, then cuts them off. */
  close(graceMs: number): Promise<void>;
}

const ROUTES: Readonly<Record<string, readonly string[]>> = {
  '/health': ['GET', 'HEAD'],
  '/v1/assistant': ['POST'],
};

const RATE_LIMIT_SWEEP_MS = 60_000;

/** Per-request facts gathered for the single access-log line. Never holds message content. */
type RequestLog = LogFields;

function metaFields(meta: AssistantCallMeta): LogFields {
  return {
    model: meta.model,
    stopReason: meta.stopReason,
    servedByFallback: meta.servedByFallback,
    inputTokens: meta.inputTokens,
    outputTokens: meta.outputTokens,
    cacheReadTokens: meta.cacheReadTokens,
    cacheWriteTokens: meta.cacheWriteTokens,
    droppedMcqs: meta.droppedMcqs,
  };
}

export function createApp({ config, assistant, rateLimiter, logger }: AppDeps): App {
  const hashIp = createIpHasher(randomBytes(16).toString('hex'));
  const inFlight = new Set<(reason: AbortReason) => void>();
  let shuttingDown = false;
  let closing: Promise<void> | undefined;

  async function handleAssistant(req: IncomingMessage, res: ServerResponse, log: RequestLog): Promise<void> {
    const ip = clientIp(req, config.trustProxyHops);
    log.client = hashIp(ip);

    const decision = rateLimiter.take(ip);
    res.setHeader('RateLimit-Limit', String(decision.limit));
    res.setHeader('RateLimit-Remaining', String(decision.remaining));
    if (!decision.allowed) {
      throw new HttpError(429, 'rate_limited', 'Too many requests. Take a short break and try again in a moment.', {
        headers: { 'Retry-After': String(Math.max(1, Math.ceil(decision.retryAfterMs / 1000))) },
      });
    }

    if (config.appToken !== undefined) {
      const provided = req.headers['x-app-token'];
      if (!tokensMatch(typeof provided === 'string' ? provided : undefined, config.appToken)) {
        throw new HttpError(401, 'unauthorized', 'Missing or invalid app token.');
      }
    }

    if (!isJsonContentType(req.headers['content-type'])) {
      throw new HttpError(415, 'unsupported_media_type', 'Content-Type must be application/json.');
    }
    const body = await readJsonBody(req, BODY_LIMIT_BYTES);
    const parsed = parseAssistantRequest(body);
    if (!parsed.ok) throw new HttpError(400, 'invalid_request', parsed.message);

    const request = parsed.value;
    log.mode = request.mode;
    log.messages = request.messages.length;
    log.hasContext = request.context !== undefined;

    if (!assistant) {
      throw new HttpError(503, 'not_configured', 'The AI service is not configured on this server.');
    }

    // Abort the upstream call on our deadline, on client disconnect, or when shutdown runs out of grace.
    const controller = new AbortController();
    let abortReason: AbortReason | undefined;
    const abort = (reason: AbortReason) => {
      abortReason ??= reason;
      controller.abort();
    };
    const deadline = setTimeout(() => abort('timeout'), config.requestTimeoutMs);
    const onClose = () => {
      if (!res.writableEnded) abort('client');
    };
    res.once('close', onClose);
    inFlight.add(abort);
    try {
      const result = await assistant.respond(request, { signal: controller.signal });
      Object.assign(log, metaFields(result.meta));
      sendJson(res, 200, result.response);
    } catch (error) {
      throw toHttpError(error, { abortReason });
    } finally {
      clearTimeout(deadline);
      inFlight.delete(abort);
      res.off('close', onClose);
    }
  }

  async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const startedAt = performance.now();
    const requestId = randomUUID();
    const path = (req.url ?? '/').split('?')[0] ?? '/';
    const method = req.method ?? 'GET';
    const log: RequestLog = { requestId, method, path };

    res.setHeader('X-Request-Id', requestId);
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    if (shuttingDown) res.setHeader('Connection', 'close');

    res.once('finish', () => {
      log.status = res.statusCode;
      log.durationMs = Math.round(performance.now() - startedAt);
      if (res.statusCode >= 500) logger.error('request', log);
      else if (res.statusCode >= 400) logger.warn('request', log);
      else logger.info('request', log);
    });

    try {
      const cors = applyCors(req, res, config.allowedOrigins);
      if (cors === 'forbidden') throw new HttpError(403, 'forbidden_origin', 'This origin is not allowed.');

      const allowedMethods = ROUTES[path];
      if (!allowedMethods) throw new HttpError(404, 'not_found', 'Not found.');

      if (method === 'OPTIONS') {
        res.writeHead(204, {
          'Access-Control-Allow-Methods': [...allowedMethods, 'OPTIONS'].join(', '),
          'Access-Control-Allow-Headers': CORS_ALLOWED_HEADERS,
          'Access-Control-Max-Age': '600',
        });
        res.end();
        return;
      }
      if (!allowedMethods.includes(method)) {
        throw new HttpError(405, 'method_not_allowed', `Use ${allowedMethods.join(' or ')} for ${path}.`, {
          headers: { Allow: [...allowedMethods, 'OPTIONS'].join(', ') },
        });
      }

      if (path === '/health') {
        sendJson(
          res,
          shuttingDown ? 503 : 200,
          { status: shuttingDown ? 'shutting_down' : 'ok', aiConfigured: assistant !== null, model: MODEL },
        );
        return;
      }

      if (shuttingDown) throw new HttpError(503, 'shutting_down', 'The server is restarting. Please try again.');
      await handleAssistant(req, res, log);
    } catch (error) {
      const httpError = toHttpError(error);
      log.errorCode = httpError.code;
      if (httpError.status >= 500) Object.assign(log, describeError(httpError));
      if (res.destroyed) {
        // The client went away; there is nobody to answer, so log here ('finish' won't fire).
        logger.info('request_aborted', { ...log, durationMs: Math.round(performance.now() - startedAt) });
        return;
      }
      if (res.headersSent) {
        res.destroy();
        return;
      }
      sendJson(res, httpError.status, httpError.toBody(), httpError.headers);
    }
  }

  const server = createServer((req, res) => {
    handle(req, res).catch((error: unknown) => {
      logger.error('unhandled_request_error', describeError(error));
      if (!res.headersSent) sendJson(res, 500, toHttpError(error).toBody());
      else res.destroy();
    });
  });
  // Bound how long a client may take to send headers / the whole request body.
  server.headersTimeout = 15_000;
  server.requestTimeout = 30_000;

  const sweeper = setInterval(() => rateLimiter.sweep(), RATE_LIMIT_SWEEP_MS);
  sweeper.unref();

  function close(graceMs: number): Promise<void> {
    closing ??= new Promise<void>((resolve) => {
      shuttingDown = true;
      clearInterval(sweeper);
      server.close(() => resolve());
      server.closeIdleConnections();
      const force = setTimeout(() => {
        for (const abort of inFlight) abort('shutdown');
        server.closeAllConnections();
      }, graceMs);
      force.unref();
    });
    return closing;
  }

  return { server, close };
}

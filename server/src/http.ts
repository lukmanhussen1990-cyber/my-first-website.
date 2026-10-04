import { createHash, timingSafeEqual } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';

import { HttpError } from './errors.js';

export const CORS_ALLOWED_HEADERS = 'Content-Type, X-App-Token';
export const CORS_EXPOSED_HEADERS = 'Retry-After, X-Request-Id, RateLimit-Limit, RateLimit-Remaining';

export function sendJson(
  res: ServerResponse,
  status: number,
  body: unknown,
  headers: Readonly<Record<string, string>> = {},
): void {
  if (res.headersSent) return;
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    ...headers,
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(payload),
  });
  res.end(payload);
}

/** Reads and JSON-parses the request body, enforcing `limitBytes` without buffering anything past it. */
export function readJsonBody(req: IncomingMessage, limitBytes: number): Promise<unknown> {
  const tooLarge = () =>
    new HttpError(413, 'payload_too_large', `Request body must be at most ${Math.floor(limitBytes / 1024)} KB.`, {
      headers: { Connection: 'close' },
    });

  const declared = Number(req.headers['content-length']);
  if (Number.isFinite(declared) && declared > limitBytes) return Promise.reject(tooLarge());

  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    let settled = false;
    const fail = (error: unknown) => {
      if (settled) return;
      settled = true;
      chunks.length = 0;
      reject(error);
    };

    req.on('data', (chunk: Buffer) => {
      if (settled) return; // keep draining, discard
      size += chunk.length;
      if (size > limitBytes) fail(tooLarge());
      else chunks.push(chunk);
    });
    req.on('error', fail);
    req.on('end', () => {
      if (settled) return;
      settled = true;
      const raw = Buffer.concat(chunks).toString('utf8');
      if (raw.trim() === '') {
        reject(new HttpError(400, 'invalid_json', 'Request body must be a JSON object.'));
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new HttpError(400, 'invalid_json', 'Request body is not valid JSON.'));
      }
    });
  });
}

/** True for a missing Content-Type (lenient) or any JSON media type. */
export function isJsonContentType(header: string | undefined): boolean {
  if (!header) return true;
  const mediaType = header.split(';')[0]?.trim().toLowerCase() ?? '';
  return mediaType === 'application/json' || mediaType.endsWith('+json');
}

/**
 * Client address for rate limiting. With `trustProxyHops` = n, the n nearest
 * hops are trusted proxies and the address they report in X-Forwarded-For is
 * used (same semantics as Express' numeric `trust proxy`). Entries a client
 * adds itself sit further left and are ignored.
 */
export function clientIp(req: IncomingMessage, trustProxyHops: number): string {
  const socketIp = req.socket.remoteAddress ?? 'unknown';
  if (trustProxyHops <= 0) return socketIp;
  const header = req.headers['x-forwarded-for'];
  const forwarded = (Array.isArray(header) ? header.join(',') : (header ?? ''))
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
  // Nearest first: the socket peer, then X-Forwarded-For from right to left.
  const chain = [socketIp, ...forwarded.reverse()];
  return chain[Math.min(trustProxyHops, chain.length - 1)] ?? socketIp;
}

export type CorsOutcome = 'no-origin' | 'allowed' | 'forbidden';

/** Sets CORS response headers for the request's Origin. Native apps send no Origin and are unaffected. */
export function applyCors(req: IncomingMessage, res: ServerResponse, allowedOrigins: '*' | readonly string[]): CorsOutcome {
  const origin = req.headers.origin;
  if (allowedOrigins === '*') {
    res.setHeader('Access-Control-Allow-Origin', '*');
  } else {
    res.setHeader('Vary', 'Origin');
  }
  if (!origin) return 'no-origin';
  if (allowedOrigins !== '*') {
    if (!allowedOrigins.includes(origin)) return 'forbidden';
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Expose-Headers', CORS_EXPOSED_HEADERS);
  return 'allowed';
}

/** Constant-time comparison; hashing first means the token length isn't leaked either. */
export function tokensMatch(provided: string | undefined, expected: string): boolean {
  if (provided === undefined) return false;
  const digest = (value: string) => createHash('sha256').update(value, 'utf8').digest();
  return timingSafeEqual(digest(provided), digest(expected));
}

/** Short, salted, non-reversible client fingerprint for log correlation (raw IPs are never logged). */
export function createIpHasher(salt: string): (ip: string) => string {
  return (ip) => createHash('sha256').update(salt).update(ip).digest('hex').slice(0, 12);
}

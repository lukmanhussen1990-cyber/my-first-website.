import assert from 'node:assert/strict';
import type { IncomingMessage } from 'node:http';
import type { AddressInfo } from 'node:net';
import { after, describe, it } from 'node:test';

import Anthropic from '@anthropic-ai/sdk';

import type { Assistant, AssistantResult } from './assistant.js';
import type { Config } from './config.js';
import { RefusalError } from './errors.js';
import { clientIp, isJsonContentType, tokensMatch } from './http.js';
import { silentLogger } from './logger.js';
import { TokenBucketRateLimiter } from './rateLimit.js';
import { createApp, type App } from './server.js';
import type { AssistantRequest } from './types.js';

const baseConfig: Config = {
  port: 0,
  host: '127.0.0.1',
  aiConfigured: true,
  appToken: undefined,
  allowedOrigins: '*',
  rateLimit: { max: 100, windowMs: 60_000 },
  requestTimeoutMs: 5_000,
  trustProxyHops: 0,
  logLevel: 'error',
};

const okResult: AssistantResult = {
  response: { text: 'You got this.' },
  meta: {
    model: 'claude-opus-5-5',
    stopReason: 'end_turn',
    servedByFallback: false,
    inputTokens: 1,
    outputTokens: 1,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
  },
};

const validBody = { mode: 'chat', messages: [{ role: 'user', content: 'How do I stay focused?' }] };

interface TestServer {
  url: string;
  received: AssistantRequest[];
  app: App;
}

const servers: App[] = [];
after(async () => {
  await Promise.all(servers.map((app) => app.close(0)));
});

async function start(
  overrides: Partial<Config> = {},
  respond: Assistant['respond'] | null = async () => okResult,
): Promise<TestServer> {
  const config = { ...baseConfig, ...overrides };
  const received: AssistantRequest[] = [];
  const assistant: Assistant | null = respond
    ? {
        respond: (request, options) => {
          received.push(request);
          return respond(request, options);
        },
      }
    : null;
  const app = createApp({
    config,
    assistant,
    rateLimiter: new TokenBucketRateLimiter({ capacity: config.rateLimit.max, windowMs: config.rateLimit.windowMs }),
    logger: silentLogger,
  });
  servers.push(app);
  await new Promise<void>((resolve) => app.server.listen(0, '127.0.0.1', resolve));
  const { port } = app.server.address() as AddressInfo;
  return { url: `http://127.0.0.1:${port}`, received, app };
}

function post(url: string, body: unknown, headers: Record<string, string> = {}): Promise<Response> {
  return fetch(`${url}/v1/assistant`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

async function expectError(response: Response, status: number, code: string): Promise<string> {
  assert.equal(response.status, status);
  const body = (await response.json()) as { error: { code: string; message: string } };
  assert.equal(body.error.code, code);
  assert.equal(typeof body.error.message, 'string');
  return body.error.message;
}

describe('HTTP server', () => {
  it('serves /health', async () => {
    const { url } = await start();
    const response = await fetch(`${url}/health`);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { status: 'ok', aiConfigured: true, model: 'claude-opus-5-5' });
    assert.ok(response.headers.get('x-request-id'));
    assert.equal(response.headers.get('cache-control'), 'no-store');
  });

  it('answers a valid request with the assistant response', async () => {
    const { url, received } = await start();
    const response = await post(url, {
      ...validBody,
      messages: [{ role: 'assistant', content: 'Hey!' }, ...validBody.messages],
    });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), okResult.response);
    assert.equal(response.headers.get('ratelimit-limit'), '100');
    // Normalized before it reaches the assistant: the leading greeting is dropped.
    assert.deepEqual(received[0]?.messages, validBody.messages);
  });

  it('rejects invalid requests with 400', async () => {
    const { url, received } = await start();
    const message = await expectError(await post(url, { mode: 'poem', messages: [] }), 400, 'invalid_request');
    assert.match(message, /mode/);
    await expectError(await post(url, '{not json'), 400, 'invalid_json');
    await expectError(await post(url, ''), 400, 'invalid_json');
    assert.equal(received.length, 0);
  });

  it('answers 503 not_configured when no API key is set, after validating input', async () => {
    const { url } = await start({ aiConfigured: false }, null);
    await expectError(await post(url, { mode: 'chat' }), 400, 'invalid_request');
    await expectError(await post(url, validBody), 503, 'not_configured');
    const health = await fetch(`${url}/health`);
    assert.equal(((await health.json()) as { aiConfigured: boolean }).aiConfigured, false);
  });

  it('enforces the 64 KB body limit', async () => {
    const { url } = await start();
    const huge = JSON.stringify({ ...validBody, padding: 'x'.repeat(70 * 1024) });
    await expectError(await post(url, huge), 413, 'payload_too_large');
  });

  it('requires a JSON content type when one is sent', async () => {
    const { url } = await start();
    await expectError(await post(url, validBody, { 'content-type': 'text/plain' }), 415, 'unsupported_media_type');
  });

  it('requires the app token when configured', async () => {
    const { url } = await start({ appToken: 's3cret-token' });
    await expectError(await post(url, validBody), 401, 'unauthorized');
    await expectError(await post(url, validBody, { 'x-app-token': 's3cret-tokeN' }), 401, 'unauthorized');
    assert.equal((await post(url, validBody, { 'x-app-token': 's3cret-token' })).status, 200);
  });

  it('rate limits per client with Retry-After', async () => {
    const { url } = await start({ rateLimit: { max: 2, windowMs: 60_000 } });
    assert.equal((await post(url, validBody)).status, 200);
    assert.equal((await post(url, validBody)).status, 200);
    const limited = await post(url, validBody);
    assert.equal(limited.headers.get('retry-after'), '30');
    assert.equal(limited.headers.get('ratelimit-remaining'), '0');
    await expectError(limited, 429, 'rate_limited');
  });

  it('handles CORS preflight and blocks unknown origins', async () => {
    const { url } = await start({ allowedOrigins: ['https://lastmile.app'] });
    const preflight = await fetch(`${url}/v1/assistant`, {
      method: 'OPTIONS',
      headers: { origin: 'https://lastmile.app', 'access-control-request-method': 'POST' },
    });
    assert.equal(preflight.status, 204);
    assert.equal(preflight.headers.get('access-control-allow-origin'), 'https://lastmile.app');
    assert.match(preflight.headers.get('access-control-allow-headers') ?? '', /X-App-Token/);
    assert.match(preflight.headers.get('access-control-allow-methods') ?? '', /POST/);

    await expectError(await post(url, validBody, { origin: 'https://evil.example' }), 403, 'forbidden_origin');
    // Native apps send no Origin header.
    assert.equal((await post(url, validBody)).status, 200);
  });

  it('allows any origin by default', async () => {
    const { url } = await start();
    const response = await post(url, validBody, { origin: 'http://localhost:8081' });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('access-control-allow-origin'), '*');
  });

  it('answers 404 and 405', async () => {
    const { url } = await start();
    await expectError(await fetch(`${url}/nope`), 404, 'not_found');
    await expectError(await fetch(`${url}/__proto__`), 404, 'not_found');
    await expectError(await fetch(`${url}/constructor?x=1`, { method: 'OPTIONS' }), 404, 'not_found');
    const wrongMethod = await fetch(`${url}/v1/assistant`);
    assert.equal(wrongMethod.headers.get('allow'), 'POST, OPTIONS');
    await expectError(wrongMethod, 405, 'method_not_allowed');
  });

  it('maps refusals and SDK errors without leaking upstream details', async () => {
    const refusing = await start({}, async () => {
      throw new RefusalError('bio');
    });
    await expectError(await post(refusing.url, validBody), 422, 'refused');

    const upstreamMessage = 'org quota exceeded for key sk-ant-very-secret';
    const limited = await start({}, async () => {
      throw new Anthropic.RateLimitError(
        429,
        { type: 'error', error: { type: 'rate_limit_error', message: upstreamMessage } },
        upstreamMessage,
        new Headers({ 'retry-after': '12' }),
      );
    });
    const response = await post(limited.url, validBody);
    assert.equal(response.headers.get('retry-after'), '12');
    const message = await expectError(response, 503, 'upstream_rate_limited');
    assert.doesNotMatch(message, /sk-ant|quota/);

    const unauthorized = await start({}, async () => {
      throw new Anthropic.AuthenticationError(401, undefined, 'invalid x-api-key', new Headers());
    });
    await expectError(await post(unauthorized.url, validBody), 502, 'upstream_auth');

    const crashing = await start({}, async () => {
      throw new TypeError('boom at /srv/app/secret.js:12');
    });
    const crashMessage = await expectError(await post(crashing.url, validBody), 500, 'internal_error');
    assert.doesNotMatch(crashMessage, /boom|secret/);
  });

  it('times out slow upstream calls and aborts them', async () => {
    let abortedUpstream = false;
    const { url } = await start({ requestTimeoutMs: 50 }, (_request, { signal }) => {
      return new Promise((_resolve, reject) => {
        signal.addEventListener('abort', () => {
          abortedUpstream = true;
          reject(new Anthropic.APIUserAbortError());
        });
      });
    });
    await expectError(await post(url, validBody), 504, 'timeout');
    assert.equal(abortedUpstream, true);
  });

  it('drains on close: finishes in-flight work, then closes the connection', async () => {
    let release: (() => void) | undefined;
    const { url, app } = await start({}, () => new Promise((resolve) => (release = () => resolve(okResult))));
    const pending = post(url, validBody);
    await new Promise((resolve) => setTimeout(resolve, 50));
    const closed = app.close(5_000);
    release?.();
    const response = await pending;
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('connection'), 'close');
    await closed;
    assert.equal(app.server.listening, false);
  });

  it('cuts off in-flight work with 503 shutting_down when the grace period runs out', async () => {
    const { url, app } = await start({}, (_request, { signal }) => {
      return new Promise((_resolve, reject) => {
        signal.addEventListener('abort', () => reject(new Anthropic.APIUserAbortError()));
      });
    });
    const pending = post(url, validBody);
    await new Promise((resolve) => setTimeout(resolve, 50));
    const closed = app.close(20);
    await expectError(await pending, 503, 'shutting_down');
    await closed;
  });
});

describe('http helpers', () => {
  const fakeRequest = (remoteAddress: string, forwardedFor?: string) =>
    ({
      socket: { remoteAddress },
      headers: forwardedFor === undefined ? {} : { 'x-forwarded-for': forwardedFor },
    }) as unknown as IncomingMessage;

  it('uses the socket address unless proxies are trusted', () => {
    assert.equal(clientIp(fakeRequest('10.0.0.1', '1.2.3.4'), 0), '10.0.0.1');
  });

  it('reads X-Forwarded-For from the right, ignoring client-supplied entries', () => {
    // Client spoofed "6.6.6.6"; the trusted proxy appended the real client address.
    assert.equal(clientIp(fakeRequest('10.0.0.1', '6.6.6.6, 1.2.3.4'), 1), '1.2.3.4');
    assert.equal(clientIp(fakeRequest('10.0.0.1', '6.6.6.6, 1.2.3.4, 10.0.0.2'), 2), '1.2.3.4');
    // More hops configured than present: fall back to the farthest known address.
    assert.equal(clientIp(fakeRequest('10.0.0.1', '1.2.3.4'), 5), '1.2.3.4');
    assert.equal(clientIp(fakeRequest('10.0.0.1'), 1), '10.0.0.1');
  });

  it('compares tokens exactly', () => {
    assert.equal(tokensMatch('abc', 'abc'), true);
    assert.equal(tokensMatch('abcd', 'abc'), false);
    assert.equal(tokensMatch(undefined, 'abc'), false);
  });

  it('recognises JSON content types', () => {
    assert.equal(isJsonContentType(undefined), true);
    assert.equal(isJsonContentType('application/json; charset=utf-8'), true);
    assert.equal(isJsonContentType('application/vnd.api+json'), true);
    assert.equal(isJsonContentType('text/plain;charset=UTF-8'), false);
    assert.equal(isJsonContentType('multipart/form-data'), false);
  });
});

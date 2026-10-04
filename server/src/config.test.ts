import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { loadConfig } from './config.js';

describe('loadConfig', () => {
  it('applies defaults to an empty environment', () => {
    assert.deepEqual(loadConfig({}), {
      port: 8787,
      host: undefined,
      aiConfigured: false,
      appToken: undefined,
      allowedOrigins: '*',
      rateLimit: { max: 20, windowMs: 300_000 },
      requestTimeoutMs: 60_000,
      trustProxyHops: 0,
      logLevel: 'info',
    });
  });

  it('treats blank values as unset', () => {
    const config = loadConfig({ ANTHROPIC_API_KEY: '  ', APP_TOKEN: '', PORT: '', ALLOWED_ORIGINS: ' ' });
    assert.equal(config.aiConfigured, false);
    assert.equal(config.appToken, undefined);
    assert.equal(config.port, 8787);
    assert.equal(config.allowedOrigins, '*');
  });

  it('reads every setting', () => {
    const config = loadConfig({
      ANTHROPIC_API_KEY: 'sk-ant-test',
      PORT: '9000',
      HOST: '127.0.0.1',
      APP_TOKEN: ' token ',
      ALLOWED_ORIGINS: 'https://a.example, https://b.example/ ,',
      RATE_LIMIT_MAX: '5',
      RATE_LIMIT_WINDOW_MS: '60000',
      REQUEST_TIMEOUT_MS: '30000',
      TRUST_PROXY_HOPS: '1',
      LOG_LEVEL: 'DEBUG',
    });
    assert.equal(config.aiConfigured, true);
    assert.equal(config.port, 9000);
    assert.equal(config.host, '127.0.0.1');
    assert.equal(config.appToken, 'token');
    assert.deepEqual(config.allowedOrigins, ['https://a.example', 'https://b.example']);
    assert.deepEqual(config.rateLimit, { max: 5, windowMs: 60_000 });
    assert.equal(config.requestTimeoutMs, 30_000);
    assert.equal(config.trustProxyHops, 1);
    assert.equal(config.logLevel, 'debug');
  });

  it('never exposes the API key itself', () => {
    assert.doesNotMatch(JSON.stringify(loadConfig({ ANTHROPIC_API_KEY: 'sk-ant-secret' })), /sk-ant/);
  });

  it('fails fast with a readable message on bad values', () => {
    assert.throws(() => loadConfig({ PORT: 'eighty' }), /PORT/);
    assert.throws(() => loadConfig({ RATE_LIMIT_MAX: '0' }), /RATE_LIMIT_MAX/);
    assert.throws(() => loadConfig({ LOG_LEVEL: 'loud' }), /LOG_LEVEL/);
  });
});

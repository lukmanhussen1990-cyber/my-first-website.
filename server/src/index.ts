import { createAnthropicClient, createAssistant, MODEL } from './assistant.js';
import { loadConfig } from './config.js';
import { createLogger } from './logger.js';
import { TokenBucketRateLimiter } from './rateLimit.js';
import { createApp } from './server.js';

const SHUTDOWN_GRACE_MS = 10_000;

function main(): void {
  const config = loadConfig();
  const logger = createLogger(config.logLevel);

  const assistant = config.aiConfigured
    ? createAssistant(createAnthropicClient({ timeoutMs: config.requestTimeoutMs }))
    : null;
  if (!assistant) {
    logger.warn('ai_not_configured', { hint: 'Set ANTHROPIC_API_KEY to enable /v1/assistant.' });
  }

  const rateLimiter = new TokenBucketRateLimiter({
    capacity: config.rateLimit.max,
    windowMs: config.rateLimit.windowMs,
  });
  const app = createApp({ config, assistant, rateLimiter, logger });

  app.server.on('error', (error: NodeJS.ErrnoException) => {
    logger.error('server_error', { code: error.code ?? null, message: error.message });
    process.exit(1);
  });

  app.server.listen({ port: config.port, host: config.host }, () => {
    const address = app.server.address();
    logger.info('listening', {
      port: typeof address === 'object' && address ? address.port : config.port,
      host: config.host ?? 'all interfaces',
      model: MODEL,
      aiConfigured: config.aiConfigured,
      appTokenRequired: config.appToken !== undefined,
      allowedOrigins: config.allowedOrigins === '*' ? '*' : config.allowedOrigins.join(','),
      rateLimit: `${config.rateLimit.max}/${config.rateLimit.windowMs}ms`,
      trustProxyHops: config.trustProxyHops,
    });
  });

  const shutdown = (signal: NodeJS.Signals) => {
    logger.info('shutdown_started', { signal, graceMs: SHUTDOWN_GRACE_MS });
    void app.close(SHUTDOWN_GRACE_MS).then(() => {
      logger.info('shutdown_complete');
      process.exit(0);
    });
  };
  process.once('SIGTERM', shutdown);
  process.once('SIGINT', shutdown);
}

try {
  main();
} catch (error) {
  // Configuration errors carry a readable message and no secrets.
  const message = error instanceof Error ? error.message : String(error);
  console.error(JSON.stringify({ time: new Date().toISOString(), level: 'error', event: 'startup_failed', message }));
  process.exit(1);
}

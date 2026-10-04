import { z } from 'zod';

import type { LogLevel } from './logger.js';

export interface RateLimitConfig {
  /** Requests allowed per window (also the burst size). */
  max: number;
  windowMs: number;
}

export interface Config {
  port: number;
  /** Interface to bind; undefined listens on all interfaces. */
  host: string | undefined;
  /** True when ANTHROPIC_API_KEY is set — without it /v1/assistant answers 503 `not_configured`. */
  aiConfigured: boolean;
  /** Shared secret the app sends as `x-app-token`; undefined disables the check. */
  appToken: string | undefined;
  /** `'*'` or an explicit list of allowed browser origins. */
  allowedOrigins: '*' | readonly string[];
  rateLimit: RateLimitConfig;
  /** Upper bound for one /v1/assistant call, including upstream retries. */
  requestTimeoutMs: number;
  /** How many reverse proxies sit in front of the server (used to read X-Forwarded-For). */
  trustProxyHops: number;
  logLevel: LogLevel;
}

/** Hard cap on request bodies. */
export const BODY_LIMIT_BYTES = 64 * 1024;

const optionalString = z
  .string()
  .optional()
  .transform((value) => {
    const trimmed = value?.trim();
    return trimmed ? trimmed : undefined;
  });

const intFromEnv = (fallback: number, min: number, max: number) =>
  z.preprocess(
    (value) => (typeof value === 'string' && value.trim() !== '' ? Number(value) : fallback),
    z.number().int().min(min).max(max),
  );

const EnvSchema = z.object({
  PORT: intFromEnv(8787, 0, 65535),
  HOST: optionalString,
  ANTHROPIC_API_KEY: optionalString,
  APP_TOKEN: optionalString,
  ALLOWED_ORIGINS: optionalString,
  RATE_LIMIT_MAX: intFromEnv(20, 1, 100_000),
  RATE_LIMIT_WINDOW_MS: intFromEnv(5 * 60_000, 1_000, 24 * 60 * 60_000),
  REQUEST_TIMEOUT_MS: intFromEnv(60_000, 1_000, 10 * 60_000),
  TRUST_PROXY_HOPS: intFromEnv(0, 0, 10),
  LOG_LEVEL: z
    .enum(['debug', 'info', 'warn', 'error'])
    .optional()
    .transform((value) => value ?? 'info'),
});

function parseOrigins(raw: string | undefined): '*' | readonly string[] {
  if (!raw || raw === '*') return '*';
  const origins = raw
    .split(',')
    .map((origin) => origin.trim().replace(/\/+$/, ''))
    .filter(Boolean);
  return origins.includes('*') || origins.length === 0 ? '*' : origins;
}

/** Reads and validates configuration from environment variables. Throws with a readable message on bad values. */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const result = EnvSchema.safeParse({
    ...env,
    LOG_LEVEL: env.LOG_LEVEL?.trim().toLowerCase() || undefined,
  });
  if (!result.success) {
    const details = result.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ');
    throw new Error(`Invalid environment configuration — ${details}`);
  }
  const parsed = result.data;
  return {
    port: parsed.PORT,
    host: parsed.HOST,
    aiConfigured: parsed.ANTHROPIC_API_KEY !== undefined,
    appToken: parsed.APP_TOKEN,
    allowedOrigins: parseOrigins(parsed.ALLOWED_ORIGINS),
    rateLimit: { max: parsed.RATE_LIMIT_MAX, windowMs: parsed.RATE_LIMIT_WINDOW_MS },
    requestTimeoutMs: parsed.REQUEST_TIMEOUT_MS,
    trustProxyHops: parsed.TRUST_PROXY_HOPS,
    logLevel: parsed.LOG_LEVEL,
  };
}

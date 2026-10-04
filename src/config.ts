/**
 * Public runtime configuration.
 *
 * `EXPO_PUBLIC_*` variables are inlined into the JS bundle at build time, so
 * they are visible to anyone with the app — never put secrets here. The
 * Anthropic API key lives only on the AI proxy server (`server/`).
 */

/** Base URL of the optional AI proxy, e.g. "https://lastmile-ai.example.com". Empty → offline study buddy only. */
export const AI_PROXY_URL = process.env.EXPO_PUBLIC_AI_PROXY_URL ?? '';

/** Optional shared token sent as `x-app-token` so the proxy can reject random callers. */
export const AI_APP_TOKEN = process.env.EXPO_PUBLIC_AI_APP_TOKEN ?? '';

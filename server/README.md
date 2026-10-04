# Last Mile AI proxy

A small Node 22 service that powers the cloud mode of the Last Mile **AI Study Buddy**. The app sends
`POST /v1/assistant`; the proxy calls Claude (`claude-opus-5-5`) through the official
[`@anthropic-ai/sdk`](https://www.npmjs.com/package/@anthropic-ai/sdk) and returns plain text, or
multiple-choice questions for quiz mode.

The proxy is optional. Without it (or when it is unreachable) the app uses its on-device study buddy,
labelled "Offline mode".

## Why the API key stays on the server

Anything shipped inside a mobile app can be extracted: JavaScript bundles, `EXPO_PUBLIC_*` values,
strings in the binary. An Anthropic API key in the app would let anyone run requests on your bill.
Here the key lives only in this server's environment (`ANTHROPIC_API_KEY`). The app only knows the
proxy's URL and, optionally, a shared app token. The proxy adds the controls a raw key can't have:
per-client rate limits, input size limits, a fixed model and prompt, and logs that contain metadata only.

## API

### `GET /health`

```json
{ "status": "ok", "aiConfigured": true, "model": "claude-opus-5-5" }
```

Returns `503` with `"status": "shutting_down"` while the server drains. Never requires the app token.

### `POST /v1/assistant`

Request and response types mirror `src/types/index.ts` in the app (`server/src/types.ts`).

```jsonc
// Request — Content-Type: application/json, max 64 KB
{
  "mode": "chat" | "explain" | "mcq" | "summarize" | "plan",
  "messages": [{ "role": "user" | "assistant", "content": "..." }], // oldest first, last one is the user's
  "context": {                                   // optional StudyContext
    "studentName": "Aisha",
    "today": "2026-10-04",                       // local day key
    "examDate": "2026-10-12T03:30:00.000Z",
    "subjects": [{ "name": "Databases", "progress": 0.85, "examDate": "…", "remainingChapters": ["Normalization"] }]
  }
}

// 200 response
{ "text": "…", "mcqs": [{ "question": "…", "options": ["…", "…", "…", "…"], "answerIndex": 1, "explanation": "…" }] }
```

- `mcqs` is present only for `mode: "mcq"` when at least one valid question came back. Each has exactly
  four distinct options and `answerIndex` 0–3, and there are at most 10.
- Validation: 1–30 messages, each 1–8000 characters, and the last one from the user. A leading assistant
  greeting is dropped and consecutive same-role turns are merged. Unknown fields are ignored. Context
  labels are trimmed, progress is clamped to 0–1, and dates must parse.
- Send `x-app-token` when the server has `APP_TOKEN` set.
- Response headers: `X-Request-Id`, `RateLimit-Limit`, `RateLimit-Remaining`, and `Retry-After` on 429 or 503.

### Errors

Every error has the body `{ "error": { "code": "…", "message": "…" } }`. The message can be shown to the
student. Upstream error text, stack traces and keys are never included.

| Status | `code` | When |
|---|---|---|
| 400 | `invalid_request`, `invalid_json` | The body fails validation or isn't JSON |
| 401 | `unauthorized` | `APP_TOKEN` is set and `x-app-token` is missing or wrong |
| 403 | `forbidden_origin` | A browser `Origin` not in `ALLOWED_ORIGINS` |
| 404 / 405 | `not_found`, `method_not_allowed` | Unknown route or method |
| 413 | `payload_too_large` | The body is over 64 KB |
| 415 | `unsupported_media_type` | `Content-Type` is set and isn't JSON |
| 422 | `refused` | Claude declined, and so did the server-side fallback model |
| 429 | `rate_limited` | The per-client bucket is empty (see `Retry-After`) |
| 502 | `upstream_auth`, `upstream_error` | Bad server key, or the API rejected or garbled the call |
| 503 | `not_configured` | No `ANTHROPIC_API_KEY` (input is still validated first) |
| 503 | `upstream_rate_limited`, `upstream_unavailable`, `shutting_down` | Anthropic is busy or overloaded, or the server is restarting |
| 504 | `timeout`, `upstream_timeout` | Over `REQUEST_TIMEOUT_MS` |
| 500 | `internal_error` | Bug; check the logs by `X-Request-Id` |

## How it calls Claude

- **Model and limits.** `claude-opus-5-5`, non-streaming, `max_tokens: 16000`. Thinking counts toward
  `max_tokens`, so the limit leaves room for it.
- **Thinking and effort.** Thinking is always on for this model and is sent as
  `thinking: { type: "adaptive", display: "omitted" }`, because reasoning is never shown to the student.
  `budget_tokens` and `disabled` are not used, since both return 400 on this model. Depth is set with
  `output_config.effort`: `low` for chat, explain and summarize, and `medium` for plan and mcq.
- **Refusal fallback.** Every call goes through `client.beta.messages.*` with the beta
  `server-side-fallback-2026-07-01` and `fallbacks: "default"`. If the model's safety classifiers decline
  a benign request, the API retries it on Anthropic's recommended fallback model within the same call.
  The installed SDK (0.131) types both the beta and the `"default"` value, so no untyped extra params are
  needed. `stop_reason === "refusal"` is checked before any content is read. If the whole chain refused,
  the proxy answers 422 `refused`. A `fallback_message` entry in `usage.iterations` is logged as
  `servedByFallback`.
- **Structured MCQs.** Quiz mode uses `client.beta.messages.parse` with `betaZodOutputFormat` (the beta
  twin of `zodOutputFormat`, from `@anthropic-ai/sdk/helpers/beta/zod`). This lets one call combine
  structured output with the refusal fallback. The SDK adds its own `structured-outputs-*` beta header
  next to the fallback beta. The wire schema is deliberately loose, so one bad question can't fail the
  whole parse. Each question is then checked (4 distinct options, integer `answerIndex` 0–3) and
  malformed ones are dropped.
- **Prompt caching.** The system prompt is a frozen "Last Mile Study Buddy" persona plus a fixed block for
  each mode (`src/prompts.ts`), with nothing per-user in it. The volatile study context (today, exam dates,
  progress) is rendered into the latest user turn. Two explicit `cache_control` breakpoints are set:
  1. On the last system block. Every student shares this cached prefix for each mode.
  2. On the turn just before the newest user message. That is exactly the prefix the next follow-up
     resends, so ongoing chats read their history from the cache.

  Top-level automatic caching is deliberately **not** used. It would place the breakpoint after the
  per-request context, which changes every time, so every call would pay the cache-write premium and
  no later call would ever read it back. Effort is fixed per mode, because changing it per request would
  also invalidate the cache. `cacheReadTokens` and `cacheWriteTokens` are logged for each request so
  you can confirm caching is working.
- **Errors and retries.** The SDK retries transient failures (`maxRetries: 2`). Every call is bounded by
  `REQUEST_TIMEOUT_MS` and aborted if the client disconnects. Typed SDK errors (`RateLimitError`,
  `AuthenticationError`, `BadRequestError`, `InternalServerError`, `APIConnectionTimeoutError`, …) are
  mapped to the codes in the table above.

## Run locally

```bash
cd server
npm install
cp .env.example .env          # then fill in ANTHROPIC_API_KEY
npm run dev                   # tsx watch, http://localhost:8787
curl localhost:8787/health
curl -X POST localhost:8787/v1/assistant -H 'content-type: application/json' \
  -d '{"mode":"explain","messages":[{"role":"user","content":"Explain database normalization"}]}'
```

Other scripts: `npm run build` (compiles to `dist/`), `npm start` (runs `dist/index.js` and loads `.env`
if present), `npm run typecheck`, `npm test` (node:test via tsx; no network and no API key needed).

Without `ANTHROPIC_API_KEY` the server still starts: `/health` works and `/v1/assistant` returns
503 `not_configured`.

### Configuration

| Variable | Default | |
|---|---|---|
| `ANTHROPIC_API_KEY` | *(none)* | Required for `/v1/assistant` |
| `PORT` / `HOST` | `8787` / all interfaces | |
| `APP_TOKEN` | *(off)* | Shared secret the app must send as `x-app-token` |
| `ALLOWED_ORIGINS` | `*` | Comma-separated browser origins for CORS. Native apps send no `Origin` |
| `RATE_LIMIT_MAX` / `RATE_LIMIT_WINDOW_MS` | `20` / `300000` | Token bucket per client: 20 requests per 5 minutes (burst 20) |
| `TRUST_PROXY_HOPS` | `0` | Reverse proxies in front of the server, used to read the client IP from `X-Forwarded-For` |
| `REQUEST_TIMEOUT_MS` | `60000` | Limit for one assistant call, including retries |
| `LOG_LEVEL` | `info` | `debug`, `info`, `warn` or `error` |

Logs are one JSON object per line: request id, route, status, duration, mode, message count, model,
stop reason, token usage and a salted hash of the client IP. Message text, study context, tokens and
keys are never logged.

## Deploy

Any host that runs a Node 22 process or a Docker image will work. Always serve the proxy over **HTTPS**.
Behind a platform load balancer, set `TRUST_PROXY_HOPS=1`. Otherwise every student shares the load
balancer's IP and therefore a single rate-limit bucket. Use your platform's health check on `/health`.

**Render.** New → Web Service → connect the repo → Root Directory `server` → Runtime **Docker** (uses
`server/Dockerfile`). Or pick the Node runtime with build command `npm ci && npm run build` and start
command `npm start`. Add the environment variables `ANTHROPIC_API_KEY`, `APP_TOKEN` and
`TRUST_PROXY_HOPS=1`, and set the Health Check Path to `/health`. Render provides `PORT`.

**Fly.io.** Run `cd server && fly launch` (it detects the Dockerfile; set `internal_port = 8787`), then
`fly secrets set ANTHROPIC_API_KEY=… APP_TOKEN=…`, then `fly deploy`. Add `TRUST_PROXY_HOPS = "1"`
under `[env]` in `fly.toml`.

**Railway.** New Project → Deploy from GitHub → set the service's Root Directory to `server` (Railway
builds the Dockerfile) → add the variables above → Settings → Networking → Generate Domain. Health
check path: `/health`.

**Any Docker host.**

```bash
docker build -t last-mile-ai-proxy server/
docker run -d --name last-mile-ai -p 8787:8787 --restart unless-stopped \
  -e ANTHROPIC_API_KEY=… -e APP_TOKEN=… last-mile-ai-proxy
```

The image is multi-stage `node:22-alpine` and runs as the unprivileged `node` user with a built-in
`HEALTHCHECK`. Put it behind a TLS-terminating proxy such as Caddy, nginx or Cloudflare, and set
`TRUST_PROXY_HOPS` to match. On `SIGTERM` (for example `docker stop`), the server stops accepting
connections, lets in-flight answers finish for up to 10 s, then exits.

The rate limiter is in memory, so it is per instance. Run a single instance, or put a shared limit
(API gateway, Redis) in front if you scale out.

## Point the app at it

In the app's `.env` (repo root):

```bash
EXPO_PUBLIC_AI_PROXY_URL=https://your-proxy.example.com   # no trailing slash
EXPO_PUBLIC_AI_APP_TOKEN=the-same-value-as-APP_TOKEN       # optional
```

The app reads these in `src/config.ts`. Restart Metro after changing them. For local testing on a device,
use your computer's LAN address (`http://192.168.x.x:8787`). The Android emulator reaches the host at
`http://10.0.2.2:8787`.

### Be honest about the app token

`EXPO_PUBLIC_*` values are compiled into the JavaScript bundle, so anyone who downloads the app can read
`APP_TOKEN`. It stops casual scripts and drive-by abuse of a URL someone found. **It is not
authentication.** The real protection is:

- the per-client rate limit, plus the fixed model, prompt and input caps in this proxy;
- a **monthly spend limit** on the Anthropic Console workspace that owns the key, and usage alerts;
- watching the logs (`servedByFallback`, token counts, 429s);
- for stronger guarantees: real user accounts (signed sessions or JWTs), or platform attestation
  (Apple App Attest, Google Play Integrity) checked by this server.

Rotate `ANTHROPIC_API_KEY` right away if it ever leaks. Rotate `APP_TOKEN` along with an app release.

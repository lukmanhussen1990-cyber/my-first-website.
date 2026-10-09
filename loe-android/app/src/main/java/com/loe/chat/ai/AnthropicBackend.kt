package com.loe.chat.ai

import com.anthropic.client.AnthropicClient
import com.anthropic.client.okhttp.AnthropicOkHttpClient
import com.anthropic.errors.AnthropicIoException
import com.anthropic.errors.AnthropicServiceException
import com.anthropic.models.beta.messages.BetaBase64ImageSource
import com.anthropic.models.beta.messages.BetaContentBlockParam
import com.anthropic.models.beta.messages.BetaFallbacksParam
import com.anthropic.models.beta.messages.BetaImageBlockParam
import com.anthropic.models.beta.messages.BetaMessageParam
import com.anthropic.models.beta.messages.BetaOutputConfig
import com.anthropic.models.beta.messages.MessageCreateParams
import com.anthropic.models.models.ModelListParams
import com.loe.chat.data.ErrorCodes
import com.loe.chat.data.Provider
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.currentCoroutineContext
import kotlinx.coroutines.ensureActive
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flow
import kotlinx.coroutines.flow.flowOn

/** Claude bots, through the official Anthropic Java SDK (streaming Messages API). */
class AnthropicBackend {

    private var cachedKey: String? = null
    private var cachedClient: AnthropicClient? = null

    @Synchronized
    private fun client(apiKey: String): AnthropicClient {
        val cacheKey = apiKey + "@" + Endpoints.of(Provider.ANTHROPIC)
        cachedClient?.let { if (cachedKey == cacheKey) return it }
        cachedClient?.close()
        return AnthropicOkHttpClient.builder()
            .apiKey(apiKey)
            .baseUrl(Endpoints.of(Provider.ANTHROPIC))
            .build()
            .also {
                cachedClient = it
                cachedKey = cacheKey
            }
    }

    fun stream(req: ChatRequest): Flow<StreamEvent> = flow {
        val params = buildParams(req)
        val response = try {
            client(req.route.apiKey).beta().messages().createStreaming(params)
        } catch (e: AnthropicServiceException) {
            throw mapError(req.route, e)
        } catch (e: AnthropicIoException) {
            throw networkError()
        }
        // Closing the stream aborts the HTTP request when the user taps Stop.
        val handle = currentCoroutineContext()[Job]?.invokeOnCompletion { runCatching { response.close() } }
        var refused = false
        var truncated = false
        try {
            response.use { stream ->
                val events = stream.stream().iterator()
                while (events.hasNext()) {
                    currentCoroutineContext().ensureActive()
                    val event = events.next()
                    val delta = event.contentBlockDelta().orElse(null)?.delta()
                    if (delta != null) {
                        val text = delta.text().orElse(null)?.text()
                        if (!text.isNullOrEmpty()) emit(StreamEvent.TextDelta(text))
                        if (delta.thinking().isPresent) emit(StreamEvent.Thinking)
                    }
                    // Check stop_reason before trusting the content: a refusal means the reply was declined.
                    val stopReason = event.messageDelta().orElse(null)?.delta()?.stopReason()?.orElse(null)?.asString()
                    when (stopReason) {
                        "refusal" -> refused = true
                        "max_tokens" -> truncated = true
                    }
                }
            }
        } catch (e: AnthropicServiceException) {
            throw mapError(req.route, e)
        } catch (e: AnthropicIoException) {
            currentCoroutineContext().ensureActive()
            throw networkError()
        } finally {
            handle?.dispose()
        }
        emit(StreamEvent.Finished(refused = refused, truncated = truncated))
    }.flowOn(Dispatchers.IO)

    fun testKey(apiKey: String): String {
        try {
            client(apiKey).models().list(ModelListParams.builder().limit(1L).build())
        } catch (e: AnthropicServiceException) {
            throw mapError(Route(Provider.ANTHROPIC, "", apiKey), e)
        } catch (e: AnthropicIoException) {
            throw networkError()
        }
        return "Connected to Anthropic."
    }

    internal fun buildParams(req: ChatRequest): MessageCreateParams {
        val model = req.route.model
        val builder = MessageCreateParams.builder()
            .model(model)
            .maxTokens(maxTokensFor(model, req.purpose))
            .messages(req.turns.mapNotNull { it.toParam() })
        req.system?.takeIf { it.isNotBlank() }?.let { builder.system(it) }
        if (supportsServerFallback(model)) {
            // If a safety classifier declines, Anthropic retries on its recommended fallback model.
            builder.addBeta(SERVER_FALLBACK_BETA)
            builder.fallbacks(BetaFallbacksParam.ofDefault())
        }
        if (req.purpose == Purpose.TITLE) {
            builder.outputConfig(BetaOutputConfig.builder().effort(BetaOutputConfig.Effort.LOW).build())
        }
        return builder.build()
    }

    private fun ChatTurn.toParam(): BetaMessageParam? {
        val role = if (fromUser) BetaMessageParam.Role.USER else BetaMessageParam.Role.ASSISTANT
        val builder = BetaMessageParam.builder().role(role)
        if (images.isEmpty()) {
            if (text.isBlank()) return null
            builder.content(text)
        } else {
            val blocks = images.map { img ->
                BetaContentBlockParam.ofImage(
                    BetaImageBlockParam.builder()
                        .source(
                            BetaBase64ImageSource.builder()
                                .data(img.base64)
                                .mediaType(BetaBase64ImageSource.MediaType.of(img.mime))
                                .build(),
                        )
                        .build(),
                )
            } + BetaContentBlockParam.ofText(text.ifBlank { "(see image)" })
            builder.contentOfBetaContentBlockParams(blocks)
        }
        return builder.build()
    }

    private fun mapError(route: Route, e: AnthropicServiceException): ApiException {
        val apiMessage = runCatching {
            val body = e.body().toString()
            Regex("\"message\"\\s*:\\s*\"((?:[^\"\\\\]|\\\\.)*)\"").find(body)?.groupValues?.get(1)
        }.getOrNull() ?: e.message
        return ApiErrors.friendly(Provider.ANTHROPIC, e.statusCode(), apiMessage, route.model)
    }

    private fun networkError() = ApiException(
        0, "Couldn't reach Anthropic. Check your internet connection and try again.", ErrorCodes.NETWORK,
    )

    companion object {
        const val SERVER_FALLBACK_BETA = "server-side-fallback-2026-07-01"

        private val currentGeneration = Regex("^claude-(opus|sonnet|haiku|fable|mythos)-(4-[5-9]|[5-9])")

        /** Models that accept `fallbacks: "default"` (not Haiku, which has no server-side fallback). */
        fun supportsServerFallback(model: String): Boolean =
            model == "claude-opus-5-5" || model == "claude-opus-5" ||
                model == "claude-fable-5-1" || model == "claude-fable-5" ||
                model == "claude-sonnet-5-5"

        fun maxTokensFor(model: String, purpose: Purpose): Long = when {
            purpose == Purpose.TITLE -> 2_000L
            currentGeneration.containsMatchIn(model) -> 64_000L
            else -> 8_192L
        }
    }
}

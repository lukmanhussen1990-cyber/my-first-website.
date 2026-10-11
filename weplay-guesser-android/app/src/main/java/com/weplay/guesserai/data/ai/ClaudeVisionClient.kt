package com.weplay.guesserai.data.ai

import com.anthropic.client.AnthropicClient
import com.anthropic.client.okhttp.AnthropicOkHttpClient
import com.anthropic.core.JsonValue
import com.anthropic.errors.AnthropicIoException
import com.anthropic.errors.AnthropicServiceException
import com.anthropic.errors.NotFoundException
import com.anthropic.errors.PermissionDeniedException
import com.anthropic.errors.RateLimitException
import com.anthropic.errors.UnauthorizedException
import com.anthropic.models.beta.messages.BetaBase64ImageSource
import com.anthropic.models.beta.messages.BetaContentBlockParam
import com.anthropic.models.beta.messages.BetaImageBlockParam
import com.anthropic.models.beta.messages.BetaJsonOutputFormat
import com.anthropic.models.beta.messages.BetaOutputConfig
import com.anthropic.models.beta.messages.BetaStopReason
import com.anthropic.models.beta.messages.BetaTextBlockParam
import com.anthropic.models.beta.messages.MessageCreateParams
import com.weplay.guesserai.domain.AiModel
import com.weplay.guesserai.domain.AppSettings
import com.weplay.guesserai.domain.FrameAnalysis
import com.weplay.guesserai.domain.PartialAnalysis
import com.weplay.guesserai.domain.PromptHints
import com.weplay.guesserai.domain.VisionAnalyzer
import com.weplay.guesserai.domain.VisionException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.currentCoroutineContext
import kotlinx.coroutines.ensureActive
import kotlinx.coroutines.job
import kotlinx.coroutines.withContext
import java.time.Duration
import java.util.Base64
import kotlin.coroutines.cancellation.CancellationException

/**
 * Talks to the Claude Messages API (or any Anthropic-compatible endpoint) through the
 * official Anthropic Java SDK, streaming the reply so guesses reach the overlay as soon as
 * each one is written.
 *
 * Speed settings (official endpoint only): effort `low`; in fast mode thinking is turned off
 * on Haiku 5.5 and Sonnet 5.5 (Opus 5.5 cannot turn it off). If the key has no access to
 * Haiku 5.5, the client switches to Opus 5.5 and remembers that for this key.
 */
class ClaudeVisionClient : VisionAnalyzer {

    private var cached: Pair<String, AnthropicClient>? = null
    @Volatile private var haikuUnavailableForKey: String? = null

    private fun client(settings: AppSettings): AnthropicClient {
        val id = settings.apiKey + "|" + settings.baseUrl
        cached?.let { (cachedId, c) -> if (cachedId == id) return c }
        val c = AnthropicOkHttpClient.builder()
            .apiKey(settings.apiKey.trim())
            .baseUrl(settings.baseUrl.trim().trimEnd('/').ifEmpty { AppSettings.DEFAULT_BASE_URL })
            .timeout(Duration.ofSeconds(30))
            .maxRetries(1)
            .build()
        cached = id to c
        return c
    }

    /** The settings actually used: Haiku is swapped for Opus once we know the key cannot use it. */
    fun effective(settings: AppSettings): AppSettings =
        if (settings.model == AiModel.HAIKU && haikuUnavailableForKey == settings.apiKey) settings.copy(model = AiModel.OPUS)
        else settings

    override suspend fun analyze(
        jpeg: ByteArray,
        hints: PromptHints,
        settings: AppSettings,
        onPartial: (PartialAnalysis) -> Unit,
    ): FrameAnalysis = withContext(Dispatchers.IO) {
        val s = effective(settings)
        try {
            stream(buildParams(jpeg, hints, s), s, onPartial)
        } catch (e: VisionException.ModelNotFound) {
            if (s.model != AiModel.HAIKU) throw e
            haikuUnavailableForKey = s.apiKey
            val opus = s.copy(model = AiModel.OPUS)
            stream(buildParams(jpeg, hints, opus), opus, onPartial)
        }
    }

    override suspend fun testConnection(settings: AppSettings): Result<String> = withContext(Dispatchers.IO) {
        runCatching {
            try {
                "Connected to ${ping(effective(settings))}"
            } catch (e: VisionException.ModelNotFound) {
                if (settings.model != AiModel.HAIKU) throw e
                haikuUnavailableForKey = settings.apiKey
                "Haiku 5.5 is not available on this key — connected to ${ping(settings.copy(model = AiModel.OPUS))} instead"
            }
        }
    }

    private fun ping(settings: AppSettings): String {
        val builder = MessageCreateParams.builder()
            .model(settings.modelId)
            .maxTokens(1024L)
            .addUserMessage("Reply with the single word: ready")
        applySpeedOptions(builder, settings)
        return call { client(settings).beta().messages().create(builder.build()) }.model().asString()
    }

    private suspend fun stream(params: MessageCreateParams, settings: AppSettings, onPartial: (PartialAnalysis) -> Unit): FrameAnalysis {
        val job = currentCoroutineContext().job
        val text = StringBuilder()
        var stop: BetaStopReason? = null
        var refusalCategory = "refusal"
        try {
            call {
                client(settings).beta().messages().createStreaming(params).use { response ->
                    // Closing the HTTP stream is what actually stops a cancelled request.
                    val onCancel = job.invokeOnCompletion { runCatching { response.close() } }
                    try {
                        response.stream().forEach { event ->
                            event.contentBlockDelta().flatMap { it.delta().text() }.ifPresent { delta ->
                                val chunk = delta.text()
                                text.append(chunk)
                                if (chunk.indexOf('}') >= 0) onPartial(AnalysisParser.parsePartial(text.toString()))
                            }
                            event.messageDelta().ifPresent { md ->
                                md.delta().stopReason().ifPresent { stop = it }
                                md.delta().stopDetails().flatMap { it.category() }.ifPresent { refusalCategory = it.toString() }
                            }
                        }
                    } finally {
                        onCancel.dispose()
                    }
                }
            }
        } catch (e: Exception) {
            if (!job.isActive) throw CancellationException("superseded by a newer frame")
            throw e
        }
        currentCoroutineContext().ensureActive()

        if (stop == BetaStopReason.REFUSAL) throw VisionException.Refused(refusalCategory)
        if (text.isBlank()) {
            if (stop == BetaStopReason.MAX_TOKENS) throw VisionException.BadResponse("AI reply was cut off (max tokens)")
            throw VisionException.BadResponse("AI reply was empty")
        }
        return AnalysisParser.parse(text.toString(), settings.modelId)
    }

    internal fun buildParams(jpeg: ByteArray, hints: PromptHints, settings: AppSettings): MessageCreateParams {
        val image = BetaImageBlockParam.builder()
            .source(
                BetaBase64ImageSource.builder()
                    .mediaType(BetaBase64ImageSource.MediaType.IMAGE_JPEG)
                    .data(Base64.getEncoder().encodeToString(jpeg))
                    .build()
            )
            .build()
        val text = BetaTextBlockParam.builder().text(SolverPrompt.userText(hints)).build()

        val builder = MessageCreateParams.builder()
            .model(settings.modelId)
            .maxTokens(if (thinkingOff(settings)) 1500L else 4096L)
            .system(SolverPrompt.SYSTEM)
            .addUserMessageOfBetaContentBlockParams(listOf(BetaContentBlockParam.ofImage(image), BetaContentBlockParam.ofText(text)))

        if (isOfficial(settings)) {
            val schema = BetaJsonOutputFormat.Schema.builder()
                .apply { SolverPrompt.SCHEMA.forEach { (k, v) -> putAdditionalProperty(k, JsonValue.from(v)) } }
                .build()
            builder.outputConfig(
                BetaOutputConfig.builder()
                    .effort(BetaOutputConfig.Effort.LOW)
                    .format(BetaJsonOutputFormat.builder().schema(schema).build())
                    .build()
            )
            applyThinking(builder, settings)
            if (settings.model == AiModel.OPUS || settings.model == AiModel.SONNET) {
                // If a safety classifier declines a frame, let the API retry it on a suitable model.
                builder.addBeta(FALLBACK_BETA)
                builder.putAdditionalBodyProperty("fallbacks", JsonValue.from("default"))
            }
        }
        return builder.build()
    }

    private fun applySpeedOptions(builder: MessageCreateParams.Builder, settings: AppSettings) {
        if (!isOfficial(settings)) return
        builder.outputConfig(BetaOutputConfig.builder().effort(BetaOutputConfig.Effort.LOW).build())
        applyThinking(builder, settings)
    }

    private fun applyThinking(builder: MessageCreateParams.Builder, settings: AppSettings) {
        if (!thinkingOff(settings)) return
        val type = if (settings.model == AiModel.SONNET) "between_tools" else "disabled"
        builder.putAdditionalBodyProperty("thinking", JsonValue.from(mapOf("type" to type)))
    }

    private inline fun <T> call(block: () -> T): T = try {
        block()
    } catch (e: UnauthorizedException) {
        throw VisionException.InvalidKey(e)
    } catch (e: PermissionDeniedException) {
        throw VisionException.InvalidKey(e)
    } catch (e: NotFoundException) {
        throw VisionException.ModelNotFound("model or endpoint", e)
    } catch (e: RateLimitException) {
        throw VisionException.RateLimited(e)
    } catch (e: AnthropicServiceException) {
        throw VisionException.Server(e.statusCode(), e.message ?: "unknown", e)
    } catch (e: AnthropicIoException) {
        throw VisionException.Network(e)
    }

    companion object {
        const val FALLBACK_BETA = "server-side-fallback-2026-07-01"

        fun isOfficial(settings: AppSettings): Boolean =
            settings.baseUrl.trim().trimEnd('/').let { it.isEmpty() || it == AppSettings.DEFAULT_BASE_URL }

        /** Haiku 5.5 accepts `disabled` and Sonnet 5.5 `between_tools` at low effort; Opus 5.5 always thinks. */
        fun thinkingOff(settings: AppSettings): Boolean =
            isOfficial(settings) && settings.fastMode && (settings.model == AiModel.HAIKU || settings.model == AiModel.SONNET)
    }
}

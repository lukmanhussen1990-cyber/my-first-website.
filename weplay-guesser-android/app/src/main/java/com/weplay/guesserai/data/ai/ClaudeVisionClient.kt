package com.weplay.guesserai.data.ai

import com.anthropic.client.AnthropicClient
import com.anthropic.client.okhttp.AnthropicOkHttpClient
import com.anthropic.core.JsonValue
import com.anthropic.core.RequestOptions
import com.anthropic.core.Timeout
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
import com.weplay.guesserai.domain.FrameImages
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
 *
 * Frame requests are never retried by the SDK and give up quickly on a stalled connection: the
 * capture loop sends a newer frame on its next beat anyway, and a stuck request would hold one
 * of its two request slots.
 */
class ClaudeVisionClient(private val timeouts: Timeouts = Timeouts()) : VisionAnalyzer {

    /** Limits for one frame request; "quiet" replies have thinking turned off and start writing at once. */
    data class Timeouts(
        val connect: Duration = Duration.ofSeconds(10),
        /** Longest silence while a reply streams. */
        val quietRead: Duration = Duration.ofSeconds(8),
        val thinkingRead: Duration = Duration.ofSeconds(20),
        /** Whole reply. */
        val quietTotal: Duration = Duration.ofSeconds(20),
        val thinkingTotal: Duration = Duration.ofSeconds(30),
    )

    /** One HTTP client per key and endpoint; [frames] shares its connections without retries. */
    private class Clients(val id: String, val base: AnthropicClient, val frames: AnthropicClient)

    private var cached: Clients? = null
    @Volatile private var haikuUnavailableForKey: String? = null

    /** Both lanes and the connection test call this from IO threads at the same time. */
    @Synchronized
    private fun clients(settings: AppSettings): Clients {
        val id = settings.apiKey + "|" + settings.baseUrl
        cached?.let { if (it.id == id) return it }
        val base = AnthropicOkHttpClient.builder()
            .apiKey(settings.apiKey.trim())
            .baseUrl(settings.baseUrl.trim().trimEnd('/').ifEmpty { AppSettings.DEFAULT_BASE_URL })
            .timeout(Duration.ofSeconds(30))
            .maxRetries(1)
            .build()
        return Clients(id, base, base.withOptions { it.maxRetries(0) }).also { cached = it }
    }

    /** Per-request limits for a frame: short when the model answers without thinking. */
    internal fun frameTimeout(settings: AppSettings): Timeout {
        val quiet = thinkingOff(settings)
        return Timeout.builder()
            .connect(timeouts.connect)
            .read(if (quiet) timeouts.quietRead else timeouts.thinkingRead)
            .write(if (quiet) timeouts.quietTotal else timeouts.thinkingTotal)
            .request(if (quiet) timeouts.quietTotal else timeouts.thinkingTotal)
            .build()
    }

    /** The settings actually used: Haiku is swapped for Opus once we know the key cannot use it. */
    fun effective(settings: AppSettings): AppSettings =
        if (settings.model == AiModel.HAIKU && haikuUnavailableForKey == settings.apiKey) settings.copy(model = AiModel.OPUS)
        else settings

    override suspend fun analyze(
        images: FrameImages,
        hints: PromptHints,
        settings: AppSettings,
        onPartial: (PartialAnalysis) -> Unit,
    ): FrameAnalysis = withContext(Dispatchers.IO) {
        val s = effective(settings)
        try {
            stream(buildParams(images, hints, s), s, onPartial)
        } catch (e: VisionException.ModelNotFound) {
            if (s.model != AiModel.HAIKU) throw e
            haikuUnavailableForKey = s.apiKey
            val opus = s.copy(model = AiModel.OPUS)
            stream(buildParams(images, hints, opus), opus, onPartial)
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
        return call { clients(settings).base.beta().messages().create(builder.build()) }.model().asString()
    }

    private suspend fun stream(params: MessageCreateParams, settings: AppSettings, onPartial: (PartialAnalysis) -> Unit): FrameAnalysis {
        val job = currentCoroutineContext().job
        val text = StringBuilder()
        var stop: BetaStopReason? = null
        var refusalCategory = "refusal"
        try {
            call {
                val options = RequestOptions.builder().timeout(frameTimeout(settings)).build()
                clients(settings).frames.beta().messages().createStreaming(params, options).use { response ->
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

    internal fun buildParams(images: FrameImages, hints: PromptHints, settings: AppSettings): MessageCreateParams {
        fun image(jpeg: ByteArray) = BetaContentBlockParam.ofImage(
            BetaImageBlockParam.builder()
                .source(
                    BetaBase64ImageSource.builder()
                        .mediaType(BetaBase64ImageSource.MediaType.IMAGE_JPEG)
                        .data(Base64.getEncoder().encodeToString(jpeg))
                        .build()
                )
                .build()
        )
        fun text(t: String) = BetaContentBlockParam.ofText(BetaTextBlockParam.builder().text(t).build())

        val content = if (images.full != null) {
            listOf(image(images.full), text(SolverPrompt.userText(hints, cropped = false)))
        } else {
            listOf(
                text(SolverPrompt.HINT_BAR_LABEL), image(requireNotNull(images.hintBar)),
                text(SolverPrompt.CANVAS_LABEL), image(requireNotNull(images.canvas)),
                text(SolverPrompt.userText(hints, cropped = true)),
            )
        }

        val builder = MessageCreateParams.builder()
            .model(settings.modelId)
            .maxTokens(if (thinkingOff(settings)) 1500L else 4096L)
            .system(SolverPrompt.SYSTEM)
            .addUserMessageOfBetaContentBlockParams(content)

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

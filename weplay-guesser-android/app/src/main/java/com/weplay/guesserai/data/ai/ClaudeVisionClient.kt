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
import com.anthropic.models.beta.messages.BetaMessage
import com.anthropic.models.beta.messages.BetaOutputConfig
import com.anthropic.models.beta.messages.BetaStopReason
import com.anthropic.models.beta.messages.BetaTextBlockParam
import com.anthropic.models.beta.messages.MessageCreateParams
import com.weplay.guesserai.domain.AiModel
import com.weplay.guesserai.domain.AppSettings
import com.weplay.guesserai.domain.FrameAnalysis
import com.weplay.guesserai.domain.VisionAnalyzer
import com.weplay.guesserai.domain.VisionException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.time.Duration
import java.util.Base64

/**
 * Talks to the Claude Messages API (or any Anthropic-compatible endpoint) through the
 * official Anthropic Java SDK.
 *
 * Features only the official API understands — structured outputs, effort, and the
 * server-side refusal fallback — are sent only when the base URL is api.anthropic.com,
 * so third-party compatible endpoints get a plain Messages request.
 */
class ClaudeVisionClient : VisionAnalyzer {

    private var cached: Pair<String, AnthropicClient>? = null

    private fun client(settings: AppSettings): AnthropicClient {
        val id = settings.apiKey + "|" + settings.baseUrl
        cached?.let { (cachedId, c) -> if (cachedId == id) return c }
        val c = AnthropicOkHttpClient.builder()
            .apiKey(settings.apiKey.trim())
            .baseUrl(settings.baseUrl.trim().trimEnd('/').ifEmpty { AppSettings.DEFAULT_BASE_URL })
            .timeout(Duration.ofSeconds(60))
            .maxRetries(1)
            .build()
        cached = id to c
        return c
    }

    override suspend fun analyze(jpeg: ByteArray, knownAnswers: List<String>, settings: AppSettings): FrameAnalysis =
        withContext(Dispatchers.IO) {
            val params = buildParams(jpeg, knownAnswers, settings)
            val message = call { client(settings).beta().messages().create(params) }
            AnalysisParser.parse(replyText(message))
        }

    override suspend fun testConnection(settings: AppSettings): Result<String> = withContext(Dispatchers.IO) {
        runCatching {
            val builder = MessageCreateParams.builder()
                .model(settings.modelId)
                .maxTokens(1024L)
                .addUserMessage("Reply with the single word: ready")
            if (isOfficial(settings)) builder.outputConfig(BetaOutputConfig.builder().effort(BetaOutputConfig.Effort.LOW).build())
            val msg = call { client(settings).beta().messages().create(builder.build()) }
            "Connected to ${msg.model().asString()}"
        }
    }

    internal fun buildParams(jpeg: ByteArray, knownAnswers: List<String>, settings: AppSettings): MessageCreateParams {
        val image = BetaImageBlockParam.builder()
            .source(
                BetaBase64ImageSource.builder()
                    .mediaType(BetaBase64ImageSource.MediaType.IMAGE_JPEG)
                    .data(Base64.getEncoder().encodeToString(jpeg))
                    .build()
            )
            .build()
        val text = BetaTextBlockParam.builder().text(SolverPrompt.userText(knownAnswers)).build()

        val builder = MessageCreateParams.builder()
            .model(settings.modelId)
            .maxTokens(4096L)
            .system(SolverPrompt.SYSTEM)
            .addUserMessageOfBetaContentBlockParams(listOf(BetaContentBlockParam.ofImage(image), BetaContentBlockParam.ofText(text)))

        if (isOfficial(settings)) {
            val schema = BetaJsonOutputFormat.Schema.builder()
                .apply { SolverPrompt.SCHEMA.forEach { (k, v) -> putAdditionalProperty(k, JsonValue.from(v)) } }
                .build()
            builder.outputConfig(
                BetaOutputConfig.builder()
                    // Speed matters more than depth when the drawing changes every second.
                    .effort(BetaOutputConfig.Effort.LOW)
                    .format(BetaJsonOutputFormat.builder().schema(schema).build())
                    .build()
            )
            if (settings.model == AiModel.OPUS || settings.model == AiModel.SONNET) {
                // If a safety classifier declines a frame, let the API retry it on a suitable model.
                builder.addBeta(FALLBACK_BETA)
                builder.putAdditionalBodyProperty("fallbacks", JsonValue.from("default"))
            }
        }
        return builder.build()
    }

    private fun replyText(message: BetaMessage): String {
        if (message.stopReason().orElse(null) == BetaStopReason.REFUSAL) {
            val detail = message.stopDetails().flatMap { it.category() }.map { it.toString() }.orElse("refusal")
            throw VisionException.Refused(detail)
        }
        val text = message.content().mapNotNull { it.text().orElse(null)?.text() }.joinToString("")
        if (text.isBlank()) {
            if (message.stopReason().orElse(null) == BetaStopReason.MAX_TOKENS) {
                throw VisionException.BadResponse("AI reply was cut off (max tokens)")
            }
            throw VisionException.BadResponse("AI reply was empty")
        }
        return text
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
    }
}

package com.runova.claude

import com.anthropic.client.AnthropicClient
import com.anthropic.client.okhttp.AnthropicOkHttpClient
import com.anthropic.errors.AnthropicIoException
import com.anthropic.errors.AnthropicServiceException
import com.anthropic.errors.BadRequestException
import com.anthropic.errors.InternalServerException
import com.anthropic.errors.NotFoundException
import com.anthropic.errors.PermissionDeniedException
import com.anthropic.errors.RateLimitException
import com.anthropic.errors.UnauthorizedException
import com.anthropic.models.beta.messages.BetaCacheControlEphemeral
import com.anthropic.models.beta.messages.BetaMessage
import com.anthropic.models.beta.messages.BetaOutputConfig
import com.anthropic.models.beta.messages.BetaStopReason
import com.anthropic.models.beta.messages.MessageCreateParams
import com.runova.core.coach.CoachEngine
import com.runova.core.coach.CoachSnapshot
import com.runova.core.format.Fmt
import com.runova.core.model.UnitSystem
import kotlinx.coroutines.CoroutineDispatcher
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.runInterruptible
import java.io.Closeable
import java.time.Duration
import kotlin.coroutines.cancellation.CancellationException
import kotlin.jvm.optionals.getOrNull

/** Models the coach can use. Opus 5.5 is the default; the user can pick another in Settings. */
enum class ClaudeModel(
    val id: String,
    val label: String,
    /** Accepts `output_config.effort`. */
    val supportsEffort: Boolean,
    /** Accepts server-side refusal fallbacks (`fallbacks: "default"`). */
    val supportsFallbacks: Boolean,
) {
    OPUS_5_5("claude-opus-5-5", "Opus 5.5", supportsEffort = true, supportsFallbacks = true),
    SONNET_5_5("claude-sonnet-5-5", "Sonnet 5.5", supportsEffort = true, supportsFallbacks = true),
    HAIKU_4_5("claude-haiku-4-5", "Haiku 4.5", supportsEffort = false, supportsFallbacks = false);

    companion object {
        val DEFAULT = OPUS_5_5
        fun of(id: String?): ClaudeModel = entries.firstOrNull { it.id == id } ?: DEFAULT
    }
}

/** One message of the visible chat. */
data class ChatTurn(val fromUser: Boolean, val text: String)

/** Why an answer came from the offline coach instead of Claude. */
enum class OfflineReason { NO_KEY, NO_CONNECTION, INVALID_KEY, NO_ACCESS, RATE_LIMITED, UNAVAILABLE, DECLINED, FAILED }

sealed interface CoachReply {
    val text: String

    data class FromClaude(override val text: String, val model: ClaudeModel) : CoachReply

    data class Offline(override val text: String, val reason: OfflineReason) : CoachReply {
        /** Short note shown under the chat, or null when nothing went wrong (no key configured). */
        val notice: String? get() = noticeFor(reason)
    }
}

sealed interface ConnectionResult {
    val message: String

    data class Ok(val displayName: String) : ConnectionResult {
        override val message: String get() = "Connected. $displayName is ready to coach you."
    }

    data class Failed(val reason: OfflineReason, override val message: String) : ConnectionResult
}

fun noticeFor(reason: OfflineReason): String? = when (reason) {
    OfflineReason.NO_KEY -> null
    OfflineReason.NO_CONNECTION -> "No connection to Claude, so the offline coach answered."
    OfflineReason.INVALID_KEY -> "Your Anthropic API key was rejected. Check it in Settings. The offline coach answered."
    OfflineReason.NO_ACCESS -> "Your API key can't use this model. Pick another in Settings. The offline coach answered."
    OfflineReason.RATE_LIMITED -> "Claude is rate limited right now, so the offline coach answered."
    OfflineReason.UNAVAILABLE -> "Claude is temporarily unavailable, so the offline coach answered."
    OfflineReason.DECLINED -> "Claude couldn't help with that one, so the offline coach answered."
    OfflineReason.FAILED -> "Claude couldn't answer, so the offline coach did."
}

/**
 * Answers coach questions with Claude and falls back to the rule-based [CoachEngine] whenever
 * there is no API key, no connection, an API error or a declined request, so the coach always
 * replies.
 *
 * Blocking SDK calls run on [dispatcher] and are interrupted when the calling coroutine is
 * cancelled.
 */
class ClaudeCoach(
    private val baseUrl: String? = null,
    private val timeout: Duration = Duration.ofSeconds(60),
    private val maxRetries: Int = 2,
    private val dispatcher: CoroutineDispatcher = Dispatchers.IO,
) : Closeable {

    private var client: AnthropicClient? = null
    private var clientKey: String? = null

    @Synchronized
    private fun clientFor(apiKey: String): AnthropicClient {
        val existing = client
        if (existing != null && clientKey == apiKey) return existing
        existing?.close()
        val builder = AnthropicOkHttpClient.builder()
            .apiKey(apiKey)
            .timeout(timeout)
            .maxRetries(maxRetries)
        baseUrl?.let { builder.baseUrl(it) }
        return builder.build().also {
            client = it
            clientKey = apiKey
        }
    }

    @Synchronized
    override fun close() {
        client?.close()
        client = null
        clientKey = null
    }

    suspend fun reply(
        apiKey: String?,
        model: ClaudeModel,
        history: List<ChatTurn>,
        question: String,
        snapshot: CoachSnapshot,
    ): CoachReply {
        fun offline(reason: OfflineReason) = CoachReply.Offline(CoachEngine.answer(question, snapshot), reason)
        if (apiKey.isNullOrBlank()) return offline(OfflineReason.NO_KEY)
        val params = buildParams(model, systemPrompt(snapshot), history, question)
        return try {
            val message = runInterruptible(dispatcher) { clientFor(apiKey).beta().messages().create(params) }
            val text = replyText(message)
            if (text == null) offline(if (message.stopReason().getOrNull() == BetaStopReason.REFUSAL) OfflineReason.DECLINED else OfflineReason.FAILED)
            else CoachReply.FromClaude(text, model)
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            offline(reasonFor(e))
        } catch (e: LinkageError) {
            // A missing class on an unusual runtime must never take the coach down with it.
            offline(OfflineReason.FAILED)
        }
    }

    /** Checks the key and model with the Models API (no tokens are spent). */
    suspend fun testConnection(apiKey: String, model: ClaudeModel): ConnectionResult = try {
        val info = runInterruptible(dispatcher) { clientFor(apiKey).models().retrieve(model.id) }
        ConnectionResult.Ok(info.displayName().ifBlank { model.label })
    } catch (e: CancellationException) {
        throw e
    } catch (e: Exception) {
        val reason = reasonFor(e)
        ConnectionResult.Failed(
            reason,
            when (reason) {
                OfflineReason.INVALID_KEY -> "The API key was rejected. Check that you copied the whole key."
                OfflineReason.NO_ACCESS -> "This key can't use ${model.label}. Try another model."
                OfflineReason.NO_CONNECTION -> "Couldn't reach Anthropic. Check your internet connection."
                OfflineReason.RATE_LIMITED -> "Rate limited. Try again in a minute."
                OfflineReason.UNAVAILABLE -> "Anthropic is temporarily unavailable. Try again later."
                else -> "Connection test failed: ${e.message ?: e.javaClass.simpleName}"
            },
        )
    } catch (e: LinkageError) {
        ConnectionResult.Failed(OfflineReason.FAILED, "Claude isn't supported on this device.")
    }

    companion object {
        const val MAX_HISTORY_TURNS = 20
        const val FALLBACK_BETA = "server-side-fallback-2026-07-01"

        /** Most specific first: every subclass is also an [AnthropicServiceException]. */
        internal fun reasonFor(e: Exception): OfflineReason = when (e) {
            is UnauthorizedException -> OfflineReason.INVALID_KEY
            is PermissionDeniedException -> OfflineReason.NO_ACCESS
            is NotFoundException -> OfflineReason.NO_ACCESS
            is RateLimitException -> OfflineReason.RATE_LIMITED
            is InternalServerException -> OfflineReason.UNAVAILABLE
            is BadRequestException -> OfflineReason.FAILED
            is AnthropicServiceException -> if (e.statusCode() >= 500) OfflineReason.UNAVAILABLE else OfflineReason.FAILED
            is AnthropicIoException -> OfflineReason.NO_CONNECTION
            else -> OfflineReason.FAILED
        }

        internal fun buildParams(model: ClaudeModel, system: String, history: List<ChatTurn>, question: String): MessageCreateParams {
            val b = MessageCreateParams.builder()
                .model(model.id)
                // Thinking counts towards max_tokens, so leave room beyond the short reply.
                .maxTokens(16_000L)
                .system(system)
                .cacheControl(BetaCacheControlEphemeral.builder().build())
            if (model.supportsEffort) {
                // Chat replies should start quickly; low effort keeps thinking short.
                b.outputConfig(BetaOutputConfig.builder().effort(BetaOutputConfig.Effort.LOW).build())
            }
            if (model.supportsFallbacks) {
                // Re-run a request a safety classifier declines on Anthropic's recommended model.
                b.addBeta(FALLBACK_BETA).fallbacksDefault()
            }
            for (turn in conversation(history, question)) {
                if (turn.fromUser) b.addUserMessage(turn.text) else b.addAssistantMessage(turn.text)
            }
            return b.build()
        }

        /**
         * Recent chat as alternating user/assistant turns that start with a user turn and end
         * with [question], merging consecutive turns from the same side.
         */
        internal fun conversation(history: List<ChatTurn>, question: String): List<ChatTurn> {
            val merged = ArrayList<ChatTurn>()
            for (turn in history.takeLast(MAX_HISTORY_TURNS) + ChatTurn(true, question)) {
                val text = turn.text.trim()
                if (text.isEmpty()) continue
                val last = merged.lastOrNull()
                if (last != null && last.fromUser == turn.fromUser) merged[merged.lastIndex] = ChatTurn(turn.fromUser, last.text + "\n\n" + text)
                else merged.add(ChatTurn(turn.fromUser, text))
            }
            while (merged.isNotEmpty() && !merged.first().fromUser) merged.removeAt(0)
            return merged
        }

        /** Reply text, or null when the request was declined or produced no text. */
        internal fun replyText(message: BetaMessage): String? {
            val stop = message.stopReason().getOrNull()
            if (stop == BetaStopReason.REFUSAL) return null
            val text = message.content().mapNotNull { block -> block.text().getOrNull()?.text() }.joinToString("").trim()
            if (text.isEmpty()) return null
            return if (stop == BetaStopReason.MAX_TOKENS) "$text…" else text
        }

        fun systemPrompt(s: CoachSnapshot): String {
            val units = if (s.units == UnitSystem.METRIC) "kilometers, with paces in minutes per kilometer" else "miles, with paces in minutes per mile"
            val instructions = """
                You are the RUNOVA Coach, the running coach inside the RUNOVA app. You chat with ${s.name.ifBlank { "the runner" }} about their running: progress, goals, pacing, training plans, recovery and motivation.

                How to answer:
                - Keep replies short, usually two to five sentences, or a brief list when asked for a plan. They are read on a phone.
                - Be warm, encouraging and specific. Take every figure from the runner data below and never invent runs, times or distances. If the data can't answer a question, say so.
                - Use $units (${Fmt.distanceUnit(s.units)}).
                - Calorie figures in the app are estimates, so describe them as estimates.
                - You are not a doctor. For pain, injury, illness or other medical questions, give general guidance and suggest seeing a professional.
                - Write plain text without Markdown formatting or XML tags. An emoji now and then is fine.
            """.trimIndent()
            return instructions + "\n\n<runner_data>\n" + CoachEngine.contextSummary(s).trim() + "\n</runner_data>"
        }
    }
}

package com.imran.jarvis.ai

import java.util.concurrent.ConcurrentHashMap
import org.json.JSONException
import org.json.JSONObject

/** One question to an AI provider. */
data class AiRequest(
    val apiKey: String,
    val model: String,
    val systemPrompt: String,
    val turns: List<AiTurn>,
)

/** Talks to one AI provider. Returns the model's raw text (JARVIS's JSON) or throws [AiException]. */
interface AiClient {
    suspend fun chat(request: AiRequest): String
}

/**
 * Shared logic of the three provider clients.
 *
 * Speed-up options: each request may carry an "optional" parameter that makes the model answer faster
 * (for example "think less"). Not every model accepts it. If a provider rejects it with HTTP 400, the
 * request is repeated without it, and that model is remembered so the next question skips it.
 */
abstract class BaseAiClient(private val http: HttpJson) : AiClient {

    /** Words in an HTTP 400 error that mean "I did not like your optional speed-up parameter". */
    protected abstract val optionalParamHints: List<String>

    protected abstract fun url(request: AiRequest): String
    protected abstract fun headers(request: AiRequest): Map<String, String>
    protected abstract fun body(request: AiRequest, withOptional: Boolean): String

    /** Extracts the answer text from a successful (HTTP 200) response body. */
    protected abstract fun parseSuccess(body: String): String
    protected abstract fun errorFor(code: Int, info: ErrorInfo, request: AiRequest): AiException

    private val rejectedOptional = ConcurrentHashMap.newKeySet<String>()

    final override suspend fun chat(request: AiRequest): String {
        if (request.apiKey.isBlank()) throw AiException.NoApiKey()

        var withOptional = request.model !in rejectedOptional
        var reply = http.post(url(request), headers(request), body(request, withOptional))

        if (withOptional && reply.code == 400 && mentionsOptionalParam(reply.body)) {
            rejectedOptional += request.model
            withOptional = false
            reply = http.post(url(request), headers(request), body(request, withOptional))
        }

        if (reply.code in 200..299) return parseSuccess(reply.body)
        throw errorFor(reply.code, ErrorInfo.parse(reply.body), request)
    }

    private fun mentionsOptionalParam(errorBody: String): Boolean {
        val text = errorBody.lowercase()
        return optionalParamHints.any { it in text }
    }
}

/** The useful parts of a provider's JSON error message. Missing parts are empty strings. */
data class ErrorInfo(
    val message: String = "",
    val type: String = "",
    val code: String = "",
    val status: String = "",
    val reason: String = "",
) {
    companion object {
        /** Understands the error shapes of Gemini, OpenAI and Claude. Never throws. */
        fun parse(body: String): ErrorInfo {
            return try {
                val root = JSONObject(body)
                val error = root.optJSONObject("error")
                    ?: return ErrorInfo(message = root.optString("message", "").take(MAX_DETAIL))
                var reason = ""
                error.optJSONArray("details")?.let { details ->
                    for (i in 0 until details.length()) {
                        val item = details.optJSONObject(i) ?: continue
                        if (item.has("reason") && !item.isNull("reason")) reason = item.optString("reason", "")
                    }
                }
                ErrorInfo(
                    message = error.text("message").take(MAX_DETAIL),
                    type = error.text("type"),
                    code = error.text("code"),
                    status = error.text("status"),
                    reason = reason,
                )
            } catch (_: JSONException) {
                ErrorInfo(message = body.trim().take(MAX_DETAIL))
            }
        }

        private const val MAX_DETAIL = 300

        private fun JSONObject.text(name: String): String =
            if (!has(name) || isNull(name)) "" else get(name).toString()
    }
}

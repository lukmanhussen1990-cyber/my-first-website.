package com.imran.jarvis.ai

import com.imran.jarvis.data.Role
import org.json.JSONArray
import org.json.JSONException
import org.json.JSONObject

/** Google Gemini (generativelanguage.googleapis.com, "generateContent"). */
class GeminiClient(
    http: HttpJson,
    private val baseUrl: String = "https://generativelanguage.googleapis.com",
) : BaseAiClient(http) {

    override val optionalParamHints = listOf("thinking", "response_mime_type", "responsemimetype")

    override fun url(request: AiRequest) =
        "$baseUrl/v1beta/models/${request.model.trim().removePrefix("models/")}:generateContent"

    // The key travels in a header, not in the URL, so it never shows up in logs or error messages.
    override fun headers(request: AiRequest) = mapOf("x-goog-api-key" to request.apiKey)

    override fun body(request: AiRequest, withOptional: Boolean): String {
        val contents = JSONArray()
        for (turn in request.turns) {
            contents.put(
                JSONObject()
                    .put("role", if (turn.role == Role.USER) "user" else "model")
                    .put("parts", JSONArray().put(JSONObject().put("text", turn.text))),
            )
        }

        val generationConfig = JSONObject()
        if (withOptional) {
            generationConfig.put("responseMimeType", "application/json")
            thinkingLevelFor(request.model)?.let {
                generationConfig.put("thinkingConfig", JSONObject().put("thinkingLevel", it))
            }
        }

        return JSONObject()
            .put("systemInstruction", JSONObject().put("parts", JSONArray().put(JSONObject().put("text", request.systemPrompt))))
            .put("contents", contents)
            .put("generationConfig", generationConfig)
            .toString()
    }

    override fun parseSuccess(body: String): String {
        try {
            val root = JSONObject(body)
            val candidates = root.optJSONArray("candidates")
            if (candidates == null || candidates.length() == 0) {
                val block = root.optJSONObject("promptFeedback")?.optString("blockReason", "").orEmpty()
                if (block.isNotBlank()) throw AiException.Blocked(block)
                throw AiException.EmptyReply()
            }

            val candidate = candidates.getJSONObject(0)
            val parts = candidate.optJSONObject("content")?.optJSONArray("parts")
            val text = buildString {
                if (parts != null) {
                    for (i in 0 until parts.length()) {
                        val part = parts.optJSONObject(i) ?: continue
                        if (part.optBoolean("thought", false)) continue // skip the model's private reasoning
                        append(part.optString("text", ""))
                    }
                }
            }
            if (text.isBlank()) {
                val finish = candidate.optString("finishReason", "")
                if (finish in BLOCKED_FINISH_REASONS) throw AiException.Blocked(finish)
                throw AiException.EmptyReply()
            }
            return text
        } catch (_: JSONException) {
            throw AiException.EmptyReply()
        }
    }

    override fun errorFor(code: Int, info: ErrorInfo, request: AiRequest): AiException {
        val message = info.message
        return when {
            // Gemini reports a wrong key as HTTP 400, not 401.
            info.reason.startsWith("API_KEY") ||
                message.contains("API key not valid", ignoreCase = true) ||
                message.contains("API_KEY_INVALID") -> AiException.InvalidApiKey(message)
            code == 401 -> AiException.InvalidApiKey(message)
            code == 403 && message.contains("leaked", ignoreCase = true) -> AiException.InvalidApiKey(message)
            code == 403 -> AiException.PermissionDenied(message)
            code == 404 -> AiException.ModelNotFound(request.model, message)
            code == 429 -> AiException.RateLimited(message)
            code in 500..599 -> AiException.ServerError(code, message)
            code == 400 && message.contains("location is not supported", ignoreCase = true) ->
                AiException.PermissionDenied(message)
            code == 400 && message.contains("model", ignoreCase = true) &&
                message.contains("not found", ignoreCase = true) -> AiException.ModelNotFound(request.model, message)
            else -> AiException.BadRequest(code, message)
        }
    }

    internal companion object {
        private val BLOCKED_FINISH_REASONS = setOf("SAFETY", "PROHIBITED_CONTENT", "BLOCKLIST", "SPII", "RECITATION")

        /**
         * Gemini 3 "Flash" models think by default, which adds seconds. "low" is accepted by all of
         * them. The Flash-Lite models already think minimally, so they need no setting.
         */
        fun thinkingLevelFor(model: String): String? {
            val m = model.trim().lowercase()
            return if (m.startsWith("gemini-3") && "flash" in m && "lite" !in m) "low" else null
        }
    }
}

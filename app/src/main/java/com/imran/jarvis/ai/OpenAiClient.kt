package com.imran.jarvis.ai

import com.imran.jarvis.data.Role
import org.json.JSONArray
import org.json.JSONException
import org.json.JSONObject

/** OpenAI "Chat Completions" API (api.openai.com). */
class OpenAiClient(
    http: HttpJson,
    private val baseUrl: String = "https://api.openai.com",
) : BaseAiClient(http) {

    override val optionalParamHints = listOf("reasoning", "response_format")

    override fun url(request: AiRequest) = "$baseUrl/v1/chat/completions"

    override fun headers(request: AiRequest) = mapOf("Authorization" to "Bearer ${request.apiKey}")

    override fun body(request: AiRequest, withOptional: Boolean): String {
        val messages = JSONArray().put(JSONObject().put("role", "system").put("content", request.systemPrompt))
        for (turn in request.turns) {
            messages.put(
                JSONObject()
                    .put("role", if (turn.role == Role.USER) "user" else "assistant")
                    .put("content", turn.text),
            )
        }

        val json = JSONObject().put("model", request.model.trim()).put("messages", messages)
        if (withOptional) {
            json.put("response_format", JSONObject().put("type", "json_object"))
            reasoningEffortFor(request.model)?.let { json.put("reasoning_effort", it) }
        }
        return json.toString()
    }

    override fun parseSuccess(body: String): String {
        try {
            val choices = JSONObject(body).optJSONArray("choices")
            if (choices == null || choices.length() == 0) throw AiException.EmptyReply()

            val choice = choices.getJSONObject(0)
            val message = choice.optJSONObject("message")
            val text = when (val content = message?.opt("content")) {
                is String -> content
                is JSONArray -> buildString {
                    for (i in 0 until content.length()) append(content.optJSONObject(i)?.optString("text", "").orEmpty())
                }
                else -> ""
            }
            if (text.isBlank()) {
                val refusal = if (message == null || message.isNull("refusal")) "" else message.optString("refusal", "")
                if (refusal.isNotBlank()) throw AiException.Blocked(refusal)
                if (choice.optString("finish_reason", "") == "content_filter") throw AiException.Blocked("content_filter")
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
            code == 401 -> AiException.InvalidApiKey(message)
            code == 403 -> AiException.PermissionDenied(message)
            code == 404 || info.code == "model_not_found" -> AiException.ModelNotFound(request.model, message)
            code == 429 && (info.code == "insufficient_quota" || info.type == "insufficient_quota") ->
                AiException.QuotaOrBilling(message)
            code == 429 -> AiException.RateLimited(message)
            code in 500..599 -> AiException.ServerError(code, message)
            else -> AiException.BadRequest(code, message)
        }
    }

    internal companion object {
        /**
         * Newer OpenAI models "reason" before answering, which adds seconds. This picks the lowest
         * setting each family accepts. If a model refuses it, the client retries without it.
         */
        fun reasoningEffortFor(model: String): String? {
            val m = model.trim().lowercase()
            return when {
                m.startsWith("gpt-6") && "luna" in m -> "none"
                m.startsWith("gpt-6") -> "low"
                Regex("^gpt-5\\.\\d").containsMatchIn(m) -> "none"
                m.startsWith("gpt-5") -> "minimal"
                Regex("^o\\d").containsMatchIn(m) -> "low"
                else -> null
            }
        }
    }
}

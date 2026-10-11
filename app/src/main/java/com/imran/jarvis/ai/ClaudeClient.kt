package com.imran.jarvis.ai

import com.imran.jarvis.data.Role
import org.json.JSONArray
import org.json.JSONException
import org.json.JSONObject

/** Anthropic Claude "Messages" API (api.anthropic.com). */
class ClaudeClient(
    http: HttpJson,
    private val baseUrl: String = "https://api.anthropic.com",
) : BaseAiClient(http) {

    override val optionalParamHints = listOf("effort", "output_config")

    override fun url(request: AiRequest) = "$baseUrl/v1/messages"

    override fun headers(request: AiRequest) = mapOf(
        "x-api-key" to request.apiKey,
        "anthropic-version" to API_VERSION,
    )

    override fun body(request: AiRequest, withOptional: Boolean): String {
        val messages = JSONArray()
        for (turn in request.turns) {
            messages.put(
                JSONObject()
                    .put("role", if (turn.role == Role.USER) "user" else "assistant")
                    .put("content", turn.text),
            )
        }

        // No "temperature" and no assistant "prefill": the newest Claude models reject both.
        val json = JSONObject()
            .put("model", request.model.trim())
            .put("max_tokens", MAX_TOKENS)
            .put("system", request.systemPrompt)
            .put("messages", messages)
        if (withOptional && supportsEffort(request.model)) {
            json.put("output_config", JSONObject().put("effort", "low"))
        }
        return json.toString()
    }

    override fun parseSuccess(body: String): String {
        try {
            val root = JSONObject(body)
            val content = root.optJSONArray("content")
            // Newer models can put "thinking" blocks before the answer, so read blocks by type.
            val text = buildString {
                if (content != null) {
                    for (i in 0 until content.length()) {
                        val block = content.optJSONObject(i) ?: continue
                        if (block.optString("type") == "text") append(block.optString("text", ""))
                    }
                }
            }
            if (text.isBlank()) {
                if (root.optString("stop_reason") == "refusal") {
                    val category = root.optJSONObject("stop_details")?.optString("category", "").orEmpty()
                    throw AiException.Blocked(category)
                }
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
            code == 402 -> AiException.QuotaOrBilling(message)
            code == 403 -> AiException.PermissionDenied(message)
            code == 404 -> AiException.ModelNotFound(request.model, message)
            code == 429 -> AiException.RateLimited(message)
            code in 500..599 -> AiException.ServerError(code, message) // includes 529 "overloaded"
            code == 400 && message.contains("credit balance", ignoreCase = true) -> AiException.QuotaOrBilling(message)
            else -> AiException.BadRequest(code, message)
        }
    }

    internal companion object {
        const val API_VERSION = "2023-06-01"

        // Thinking tokens (if any) count towards this limit too, so keep plenty of room.
        const val MAX_TOKENS = 4096

        private val EFFORT_MODELS = Regex("^claude-(opus|sonnet|haiku|fable|mythos)-[5-9]|^claude-(opus|sonnet)-4-[6-9]")

        /** "effort: low" makes the 4.6+ / 5.x models answer quickly. Older models would reject it. */
        fun supportsEffort(model: String): Boolean = EFFORT_MODELS.containsMatchIn(model.trim().lowercase())
    }
}

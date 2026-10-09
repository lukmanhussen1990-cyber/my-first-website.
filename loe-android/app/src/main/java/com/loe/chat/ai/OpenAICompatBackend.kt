package com.loe.chat.ai

import com.loe.chat.data.ErrorCodes
import com.loe.chat.data.Provider
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.currentCoroutineContext
import kotlinx.coroutines.ensureActive
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flow
import kotlinx.coroutines.flow.flowOn
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.Response
import org.json.JSONArray
import org.json.JSONObject
import java.io.IOException

/** Chat Completions client for every OpenAI-compatible provider (OpenRouter, OpenAI, Gemini, xAI, DeepSeek, Poe). */
class OpenAICompatBackend(private val http: OkHttpClient) {

    fun stream(req: ChatRequest): Flow<StreamEvent> = flow {
        val body = buildBody(req, stream = true)
        val call = http.newCall(request(req.route, "/chat/completions", body))
        val handle = currentCoroutineContext()[Job]?.invokeOnCompletion { call.cancel() }
        var refused = false
        var truncated = false
        try {
            call.execute().use { response ->
                if (!response.isSuccessful) throw errorFrom(req.route, response)
                val source = response.body?.source() ?: throw ApiException(response.code, "Empty response from ${req.route.provider.displayName}.")
                val parser = SseParser()
                while (true) {
                    currentCoroutineContext().ensureActive()
                    val line = source.readUtf8Line() ?: break
                    val event = parser.feed(line) ?: continue
                    if (event.data == "[DONE]") break
                    val chunk = runCatching { JSONObject(event.data) }.getOrNull() ?: continue
                    chunk.optJSONObject("error")?.let { err ->
                        throw ApiErrors.friendly(req.route.provider, err.optInt("code", 500), err.optString("message"), req.route.model)
                    }
                    val choice = chunk.optJSONArray("choices")?.optJSONObject(0) ?: continue
                    val delta = choice.optJSONObject("delta")
                    if (delta != null) {
                        val reasoning = delta.optStringOrNull("reasoning") ?: delta.optStringOrNull("reasoning_content")
                        if (!reasoning.isNullOrEmpty()) emit(StreamEvent.Thinking)
                        delta.optStringOrNull("content")?.takeIf { it.isNotEmpty() }?.let { emit(StreamEvent.TextDelta(it)) }
                        delta.optJSONArray("images")?.let { images -> imagesFrom(images).forEach { emit(it) } }
                    }
                    when (choice.optStringOrNull("finish_reason")) {
                        "length" -> truncated = true
                        "content_filter" -> refused = true
                    }
                }
            }
        } catch (e: IOException) {
            currentCoroutineContext().ensureActive()
            throw ApiException(0, "Couldn't reach ${req.route.provider.displayName}. Check your internet connection and try again.", ErrorCodes.NETWORK)
        } finally {
            handle?.dispose()
        }
        emit(StreamEvent.Finished(refused = refused, truncated = truncated))
    }.flowOn(Dispatchers.IO)

    /** Image generation through chat completions with image output (OpenRouter image models). */
    fun generateImage(req: ChatRequest): Flow<StreamEvent> = flow {
        val body = buildBody(req.copy(turns = listOfNotNull(req.turns.lastOrNull())), stream = false)
            .put("modalities", JSONArray().put("image").put("text"))
        val json = executeJson(req.route, "/chat/completions", body)
        val message = json.optJSONArray("choices")?.optJSONObject(0)?.optJSONObject("message")
            ?: throw ApiException(500, "${req.route.provider.displayName} returned no image.")
        message.optStringOrNull("content")?.takeIf { it.isNotBlank() }?.let { emit(StreamEvent.TextDelta(it)) }
        val images = message.optJSONArray("images")?.let { imagesFrom(it) }.orEmpty()
        images.forEach { emit(it) }
        emit(StreamEvent.Finished(refused = images.isEmpty() && message.optStringOrNull("refusal") != null))
    }.flowOn(Dispatchers.IO)

    /** Lightweight key check: lists models (or key info on OpenRouter). */
    fun testKey(provider: Provider, key: String): String {
        val path = if (provider == Provider.OPENROUTER) "/key" else "/models"
        val request = Request.Builder().url(Endpoints.of(provider) + path)
            .header("Authorization", "Bearer $key")
            .get().build()
        try {
            http.newCall(request).execute().use { response ->
                if (!response.isSuccessful) throw errorFrom(Route(provider, "", key), response)
            }
        } catch (e: IOException) {
            throw ApiException(0, "Couldn't reach ${provider.displayName}. Check your internet connection.", ErrorCodes.NETWORK)
        }
        return "Connected to ${provider.displayName}."
    }

    // ---- Helpers ------------------------------------------------------------------------------

    private fun request(route: Route, path: String, body: JSONObject): Request =
        Request.Builder()
            .url(Endpoints.of(route.provider) + path)
            .header("Authorization", "Bearer ${route.apiKey}")
            .header("Content-Type", "application/json")
            .apply { if (route.provider == Provider.OPENROUTER) header("X-Title", "Loe") }
            .post(body.toString().toRequestBody(JSON))
            .build()

    private fun executeJson(route: Route, path: String, body: JSONObject): JSONObject {
        try {
            http.newCall(request(route, path, body)).execute().use { response ->
                if (!response.isSuccessful) throw errorFrom(route, response)
                val text = response.body?.string().orEmpty()
                return runCatching { JSONObject(text) }.getOrElse {
                    throw ApiException(response.code, "Unexpected response from ${route.provider.displayName}.")
                }
            }
        } catch (e: IOException) {
            throw ApiException(0, "Couldn't reach ${route.provider.displayName}. Check your internet connection and try again.", ErrorCodes.NETWORK)
        }
    }

    internal fun buildBody(req: ChatRequest, stream: Boolean): JSONObject {
        val messages = JSONArray()
        req.system?.takeIf { it.isNotBlank() }?.let {
            messages.put(JSONObject().put("role", "system").put("content", it))
        }
        req.turns.forEach { turn ->
            val role = if (turn.fromUser) "user" else "assistant"
            if (turn.images.isEmpty()) {
                messages.put(JSONObject().put("role", role).put("content", turn.text))
            } else {
                val parts = JSONArray()
                parts.put(JSONObject().put("type", "text").put("text", turn.text.ifBlank { "(see image)" }))
                turn.images.forEach { img ->
                    parts.put(
                        JSONObject().put("type", "image_url")
                            .put("image_url", JSONObject().put("url", "data:${img.mime};base64,${img.base64}")),
                    )
                }
                messages.put(JSONObject().put("role", role).put("content", parts))
            }
        }
        return JSONObject()
            .put("model", req.route.model)
            .put("messages", messages)
            .put("stream", stream)
    }

    private fun imagesFrom(images: JSONArray): List<StreamEvent.ImageOut> = buildList {
        for (i in 0 until images.length()) {
            val url = images.optJSONObject(i)?.optJSONObject("image_url")?.optString("url").orEmpty()
            decodeDataUrl(url)?.let { add(it) }
        }
    }

    private fun decodeDataUrl(url: String): StreamEvent.ImageOut? {
        if (!url.startsWith("data:")) return null
        val comma = url.indexOf(',')
        if (comma < 0) return null
        val mime = url.substring(5, comma).substringBefore(';').ifBlank { "image/png" }
        val bytes = runCatching { java.util.Base64.getMimeDecoder().decode(url.substring(comma + 1)) }.getOrNull() ?: return null
        return StreamEvent.ImageOut(bytes, mime)
    }

    private fun errorFrom(route: Route, response: Response): ApiException {
        val raw = runCatching { response.body?.string() }.getOrNull()
        val message = raw?.let { text ->
            runCatching {
                val json = JSONObject(text)
                json.optJSONObject("error")?.optString("message")
                    ?: json.optString("message").takeIf { it.isNotBlank() }
                    ?: json.optString("detail").takeIf { it.isNotBlank() }
            }.getOrNull() ?: text.take(300)
        }
        return ApiErrors.friendly(route.provider, response.code, message, route.model)
    }

    companion object {
        private val JSON = "application/json; charset=utf-8".toMediaType()
    }
}

internal fun JSONObject.optStringOrNull(name: String): String? =
    if (has(name) && !isNull(name)) optString(name) else null

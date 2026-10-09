package com.loe.chat.ai

import com.loe.chat.data.ErrorCodes
import com.loe.chat.data.Provider
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flow
import kotlinx.coroutines.flow.flowOn
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.MultipartBody
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONArray
import org.json.JSONObject
import java.io.IOException
import java.util.Base64

/** GPT-Image bots through the OpenAI Images API (generation, or edits when a photo is attached). */
class OpenAIImageBackend(private val http: OkHttpClient) {

    fun generate(req: ChatRequest): Flow<StreamEvent> = flow {
        val turn = req.turns.lastOrNull { it.fromUser } ?: throw ApiException(400, "Describe the image you want.")
        val prompt = turn.text.ifBlank { "Improve this image." }
        val route = req.route
        val request = if (turn.images.isEmpty()) {
            val body = JSONObject()
                .put("model", route.model)
                .put("prompt", prompt)
                .put("n", 1)
                .put("size", "1024x1024")
            Request.Builder().url("${Endpoints.of(route.provider)}/images/generations")
                .header("Authorization", "Bearer ${route.apiKey}")
                .post(body.toString().toRequestBody(JSON))
                .build()
        } else {
            val multipart = MultipartBody.Builder().setType(MultipartBody.FORM)
                .addFormDataPart("model", route.model)
                .addFormDataPart("prompt", prompt)
            turn.images.forEachIndexed { i, img ->
                val bytes = Base64.getDecoder().decode(img.base64)
                val ext = if (img.mime.contains("png")) "png" else "jpg"
                multipart.addFormDataPart("image[]", "input$i.$ext", bytes.toRequestBody(img.mime.toMediaType()))
            }
            Request.Builder().url("${Endpoints.of(route.provider)}/images/edits")
                .header("Authorization", "Bearer ${route.apiKey}")
                .post(multipart.build())
                .build()
        }
        val json = execute(http, route, request)
        val data = json.optJSONArray("data") ?: JSONArray()
        var count = 0
        for (i in 0 until data.length()) {
            val b64 = data.optJSONObject(i)?.optString("b64_json").orEmpty()
            if (b64.isNotEmpty()) {
                emit(StreamEvent.ImageOut(Base64.getMimeDecoder().decode(b64), "image/png"))
                count++
            }
        }
        if (count == 0) throw ApiException(500, "OpenAI didn't return an image. Try a different description.")
        emit(StreamEvent.Finished())
    }.flowOn(Dispatchers.IO)

    companion object {
        private val JSON = "application/json; charset=utf-8".toMediaType()
    }
}

/** Nano-Banana bots through Google's native Gemini API (image output isn't on the OpenAI-compatible endpoint). */
class GeminiImageBackend(private val http: OkHttpClient) {

    fun generate(req: ChatRequest): Flow<StreamEvent> = flow {
        val turn = req.turns.lastOrNull { it.fromUser } ?: throw ApiException(400, "Describe the image you want.")
        val parts = JSONArray().put(JSONObject().put("text", turn.text.ifBlank { "Improve this image." }))
        turn.images.forEach { img ->
            parts.put(JSONObject().put("inline_data", JSONObject().put("mime_type", img.mime).put("data", img.base64)))
        }
        val body = JSONObject()
            .put("contents", JSONArray().put(JSONObject().put("role", "user").put("parts", parts)))
            .put("generationConfig", JSONObject().put("responseModalities", JSONArray().put("TEXT").put("IMAGE")))
        val route = req.route
        val request = Request.Builder()
            .url("${Endpoints.of(Provider.GOOGLE).removeSuffix("/openai")}/models/${route.model}:generateContent")
            .header("x-goog-api-key", route.apiKey)
            .post(body.toString().toRequestBody("application/json; charset=utf-8".toMediaType()))
            .build()
        val json = execute(http, route, request)
        val candidate = json.optJSONArray("candidates")?.optJSONObject(0)
        val outParts = candidate?.optJSONObject("content")?.optJSONArray("parts") ?: JSONArray()
        var images = 0
        for (i in 0 until outParts.length()) {
            val part = outParts.optJSONObject(i) ?: continue
            part.optStringOrNull("text")?.takeIf { it.isNotBlank() }?.let { emit(StreamEvent.TextDelta(it)) }
            val inline = part.optJSONObject("inlineData") ?: part.optJSONObject("inline_data")
            if (inline != null) {
                val data = inline.optString("data")
                val mime = inline.optStringOrNull("mimeType") ?: inline.optStringOrNull("mime_type") ?: "image/png"
                if (data.isNotEmpty()) {
                    emit(StreamEvent.ImageOut(Base64.getMimeDecoder().decode(data), mime))
                    images++
                }
            }
        }
        val blocked = candidate?.optString("finishReason").orEmpty().let { it == "SAFETY" || it == "PROHIBITED_CONTENT" || it == "IMAGE_SAFETY" } ||
            json.optJSONObject("promptFeedback")?.has("blockReason") == true
        emit(StreamEvent.Finished(refused = blocked && images == 0))
    }.flowOn(Dispatchers.IO)
}

private fun execute(http: OkHttpClient, route: Route, request: Request): JSONObject {
    try {
        http.newCall(request).execute().use { response ->
            val text = response.body?.string().orEmpty()
            if (!response.isSuccessful) {
                val message = runCatching {
                    val json = JSONObject(text)
                    json.optJSONObject("error")?.optString("message") ?: json.optString("message")
                }.getOrNull() ?: text.take(300)
                throw ApiErrors.friendly(route.provider, response.code, message, route.model)
            }
            return runCatching { JSONObject(text) }.getOrElse {
                throw ApiException(response.code, "Unexpected response from ${route.provider.displayName}.")
            }
        }
    } catch (e: IOException) {
        throw ApiException(0, "Couldn't reach ${route.provider.displayName}. Check your internet connection and try again.", ErrorCodes.NETWORK)
    }
}

/** Sends each request to the right backend for its provider and bot kind. */
class AiService(http: OkHttpClient) {
    private val anthropic = AnthropicBackend()
    private val compat = OpenAICompatBackend(http)
    private val openAiImages = OpenAIImageBackend(http)
    private val geminiImages = GeminiImageBackend(http)

    fun stream(req: ChatRequest): Flow<StreamEvent> = when (req.kind) {
        com.loe.chat.data.BotKind.TEXT -> textStream(req)
        com.loe.chat.data.BotKind.IMAGE -> when (req.route.provider) {
            Provider.OPENAI -> openAiImages.generate(req)
            Provider.GOOGLE -> geminiImages.generate(req)
            Provider.OPENROUTER -> compat.generateImage(req)
            else -> compat.stream(req) // Poe returns image links in the text
        }
        com.loe.chat.data.BotKind.VIDEO -> compat.stream(req)
    }

    private fun textStream(req: ChatRequest): Flow<StreamEvent> =
        if (req.route.provider == Provider.ANTHROPIC) anthropic.stream(req) else compat.stream(req)

    /** Collects a whole reply as text (used for chat titles). */
    suspend fun complete(req: ChatRequest): String {
        val out = StringBuilder()
        textStream(req).collect { if (it is StreamEvent.TextDelta) out.append(it.text) }
        return out.toString()
    }

    fun testKey(provider: Provider, key: String): String = when (provider) {
        Provider.ANTHROPIC -> anthropic.testKey(key)
        // Poe's model list is public, so it can't confirm a key; the first message will.
        Provider.POE -> "Saved. Your Poe key will be used on your next message."
        else -> compat.testKey(provider, key)
    }
}

package com.weplay.guesserai

import com.fasterxml.jackson.databind.ObjectMapper
import com.weplay.guesserai.data.ai.ClaudeVisionClient
import com.weplay.guesserai.domain.AiModel
import com.weplay.guesserai.domain.AppSettings
import com.weplay.guesserai.domain.VisionException
import kotlinx.coroutines.test.runTest
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

/** Runs the real Anthropic SDK against a local mock server and checks the wire format both ways. */
class ClaudeVisionClientTest {
    private lateinit var server: MockWebServer
    private val mapper = ObjectMapper()

    @Before fun setUp() { server = MockWebServer().apply { start() } }
    @After fun tearDown() { server.shutdown() }

    private fun reply(text: String, stop: String = "end_turn") = MockResponse()
        .setHeader("content-type", "application/json")
        .setBody(
            mapper.writeValueAsString(
                mapOf(
                    "id" to "msg_1", "type" to "message", "role" to "assistant", "model" to "claude-opus-5-5",
                    "content" to listOf(mapOf("type" to "text", "text" to text)),
                    "stop_reason" to stop, "stop_sequence" to null,
                    "usage" to mapOf("input_tokens" to 900, "output_tokens" to 120),
                )
            )
        )

    private fun settings(model: AiModel = AiModel.OPUS) =
        AppSettings(apiKey = "sk-test", baseUrl = server.url("/").toString().trimEnd('/'), model = model)

    @Test fun `sends image plus prompt and parses guesses`() = runTest {
        server.enqueue(reply("""{"is_drawing_game":true,"canvas_empty":false,"detected_object":"Fire truck","category":"Vehicle","emoji":"🚒","hint":{"word_count":2,"letter_count":9,"word_lengths":[4,5]},"canvas_box":[0.1,0.2,0.9,0.6],"guesses":[{"answer":"Fire Truck","confidence":95,"reason":"ladder"}]}"""))
        val jpeg = byteArrayOf(-1, -40, -1, -32, 1, 2, 3)
        val result = ClaudeVisionClient().analyze(jpeg, listOf("Cat House"), settings())

        assertEquals("Fire Truck", result.guesses.single().answer)
        assertEquals(9, result.hint!!.letterCount)

        val req = server.takeRequest()
        assertTrue(req.path!!.startsWith("/v1/messages"))
        assertEquals("sk-test", req.getHeader("x-api-key"))
        val body = mapper.readTree(req.body.readUtf8())
        assertEquals("claude-opus-5-5", body["model"].asText())
        assertTrue(body["system"].toString().contains("expert drawing game solver"))
        val content = body["messages"][0]["content"]
        assertEquals("image", content[0]["type"].asText())
        assertEquals("image/jpeg", content[0]["source"]["media_type"].asText())
        assertEquals(java.util.Base64.getEncoder().encodeToString(jpeg), content[0]["source"]["data"].asText())
        assertTrue(content[1]["text"].asText().contains("Cat House"))
        // Base URL is the mock server, so official-only fields must not be sent.
        assertFalse(body.has("output_config"))
        assertFalse(body.has("fallbacks"))
    }

    @Test fun `official endpoint gets structured output, low effort and refusal fallback`() {
        val params = ClaudeVisionClient().buildParams(byteArrayOf(1), emptyList(), AppSettings(apiKey = "k"))
        val body = mapper.readTree(mapper.writeValueAsString(params._body()))
        assertEquals("low", body["output_config"]["effort"].asText())
        assertEquals("json_schema", body["output_config"]["format"]["type"].asText())
        assertEquals("object", body["output_config"]["format"]["schema"]["type"].asText())
        assertEquals("default", body["fallbacks"].asText())
        assertTrue(params._headers().values("anthropic-beta").any { it.contains(ClaudeVisionClient.FALLBACK_BETA) })
    }

    @Test fun `haiku on official endpoint gets no fallback`() {
        val params = ClaudeVisionClient().buildParams(byteArrayOf(1), emptyList(), AppSettings(apiKey = "k", model = AiModel.HAIKU))
        val body = mapper.readTree(mapper.writeValueAsString(params._body()))
        assertFalse(body.has("fallbacks"))
        assertEquals("claude-haiku-5-5", body["model"].asText())
    }

    @Test(expected = VisionException.InvalidKey::class)
    fun `401 maps to InvalidKey`() = runTest {
        server.enqueue(MockResponse().setResponseCode(401).setHeader("content-type", "application/json")
            .setBody("""{"type":"error","error":{"type":"authentication_error","message":"invalid x-api-key"}}"""))
        ClaudeVisionClient().analyze(byteArrayOf(1), emptyList(), settings())
    }

    @Test fun `refusal is reported`() = runTest {
        server.enqueue(reply("", stop = "refusal"))
        val e = runCatching { ClaudeVisionClient().analyze(byteArrayOf(1), emptyList(), settings()) }.exceptionOrNull()
        assertTrue(e is VisionException.Refused)
    }

    @Test fun `test connection succeeds`() = runTest {
        server.enqueue(reply("ready"))
        val r = ClaudeVisionClient().testConnection(settings())
        assertTrue(r.isSuccess)
        assertEquals("Connected to claude-opus-5-5", r.getOrThrow())
    }
}

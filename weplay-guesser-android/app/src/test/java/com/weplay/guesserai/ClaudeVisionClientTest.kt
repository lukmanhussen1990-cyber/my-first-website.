package com.weplay.guesserai

import com.fasterxml.jackson.databind.JsonNode
import com.fasterxml.jackson.databind.ObjectMapper
import com.weplay.guesserai.data.ai.ClaudeVisionClient
import com.weplay.guesserai.data.ai.SolverPrompt
import com.weplay.guesserai.domain.AiModel
import com.weplay.guesserai.domain.AppSettings
import com.weplay.guesserai.domain.FrameImages
import com.weplay.guesserai.domain.HintPattern
import com.weplay.guesserai.domain.PartialAnalysis
import com.weplay.guesserai.domain.PromptHints
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
import java.util.Collections

/** Runs the real Anthropic SDK against a local mock server and checks the wire format both ways. */
class ClaudeVisionClientTest {
    private lateinit var server: MockWebServer
    private val mapper = ObjectMapper()

    @Before fun setUp() { server = MockWebServer().apply { start() } }
    @After fun tearDown() { server.shutdown() }

    private fun sse(model: String, chunks: List<String>, stop: String = "end_turn"): MockResponse {
        fun ev(type: String, data: Map<String, Any?>) = "event: $type\ndata: ${mapper.writeValueAsString(data)}\n\n"
        val body = StringBuilder()
        body.append(ev("message_start", mapOf("type" to "message_start", "message" to mapOf(
            "id" to "msg_1", "type" to "message", "role" to "assistant", "model" to model, "content" to emptyList<Any>(),
            "stop_reason" to null, "stop_sequence" to null, "usage" to mapOf("input_tokens" to 900, "output_tokens" to 1)))))
        body.append(ev("content_block_start", mapOf("type" to "content_block_start", "index" to 0, "content_block" to mapOf("type" to "text", "text" to ""))))
        chunks.forEach { body.append(ev("content_block_delta", mapOf("type" to "content_block_delta", "index" to 0, "delta" to mapOf("type" to "text_delta", "text" to it)))) }
        body.append(ev("content_block_stop", mapOf("type" to "content_block_stop", "index" to 0)))
        body.append(ev("message_delta", mapOf("type" to "message_delta", "delta" to mapOf("stop_reason" to stop, "stop_sequence" to null), "usage" to mapOf("output_tokens" to 120))))
        body.append(ev("message_stop", mapOf("type" to "message_stop")))
        return MockResponse().setHeader("content-type", "text/event-stream").setBody(body.toString())
    }

    private val reply = listOf(
        """{"is_drawing_game":true,"canvas_empty":false,"hint":{"word_count":2,"letter_count":8,"word_lengths":[4,4]},""",
        """"seen":"gun with flames","guesses":[""",
        """{"answer":"Free Fire","confidence":93,"reason":"gun and flames"},""",
        """{"answer":"Coca Cola","confidence":40,"reason":"red"}],""",
        """"detected_object":"Game logo","category":"Game","emoji":"🔥","canvas_box":[0.1,0.2,0.9,0.6]}""",
    )

    private fun settings(model: AiModel = AiModel.HAIKU) =
        AppSettings(apiKey = "sk-test", baseUrl = server.url("/").toString().trimEnd('/'), model = model)

    private fun body(params: com.anthropic.models.beta.messages.MessageCreateParams) =
        mapper.readTree(mapper.writeValueAsString(params._body()))

    @Test fun `streams guesses as they arrive and sends image, prompt and word-list candidates`() = runTest {
        server.enqueue(sse("claude-haiku-5-5", reply))
        val partials = Collections.synchronizedList(mutableListOf<PartialAnalysis>())
        val jpeg = byteArrayOf(-1, -40, -1, -32, 1, 2, 3)
        val hints = PromptHints(HintPattern(2, 8), knownAnswers = listOf("Free Fire"), wordListCandidates = listOf("Free Fire", "Coca Cola"))
        val result = ClaudeVisionClient().analyze(FrameImages(full = jpeg), hints, settings()) { partials += it }

        assertEquals(listOf("Free Fire", "Coca Cola"), result.guesses.map { it.answer })
        assertEquals("gun with flames", result.seen)
        assertEquals("claude-haiku-5-5", result.modelUsed)
        // The first guess was available before the reply finished.
        assertTrue(partials.any { it.guesses.map { g -> g.answer } == listOf("Free Fire") })

        val req = server.takeRequest()
        assertTrue(req.path!!.startsWith("/v1/messages"))
        val b = mapper.readTree(req.body.readUtf8())
        assertEquals("claude-haiku-5-5", b["model"].asText())
        assertTrue(b["stream"].asBoolean())
        val content = b["messages"][0]["content"]
        assertEquals("image", content[0]["type"].asText())
        assertEquals(java.util.Base64.getEncoder().encodeToString(jpeg), content[0]["source"]["data"].asText())
        val text = content[1]["text"].asText()
        assertTrue(text.contains("confirmed in earlier rounds with this hint (use only if the drawing matches): Free Fire."))
        // Free Fire is already listed as confirmed, so the word list adds only Coca Cola.
        assertTrue(text.contains("Possible answers for this hint (use only if the drawing matches): Coca Cola."))
        assertFalse(text.contains("Already tried"))
        assertTrue(b["system"].asText().contains("A 1-letter word is always \"A\""))
        assertTrue(b["system"].asText().contains("4 letters|A state"))
        assertTrue(content[1]["text"].asText().contains("whole phone screen"))
        // Custom (mock) endpoint: no official-only fields.
        assertFalse(b.has("output_config")); assertFalse(b.has("thinking")); assertFalse(b.has("fallbacks"))
    }

    @Test fun `falls back to Opus when the key has no Haiku access, and remembers it`() = runTest {
        server.enqueue(MockResponse().setResponseCode(404).setHeader("content-type", "application/json")
            .setBody("""{"type":"error","error":{"type":"not_found_error","message":"model: claude-haiku-5-5"}}"""))
        server.enqueue(sse("claude-opus-5-5", reply))
        server.enqueue(sse("claude-opus-5-5", reply))
        val client = ClaudeVisionClient()

        val first = client.analyze(FrameImages(full = byteArrayOf(1)), PromptHints(), settings())
        assertEquals("claude-opus-5-5", first.modelUsed)
        client.analyze(FrameImages(full = byteArrayOf(1)), PromptHints(), settings())

        val models = (1..3).map { mapper.readTree(server.takeRequest().body.readUtf8())["model"].asText() }
        assertEquals(listOf("claude-haiku-5-5", "claude-opus-5-5", "claude-opus-5-5"), models)
    }

    @Test fun `official Haiku request is fast - thinking off, low effort, no fallback`() {
        val b = body(ClaudeVisionClient().buildParams(FrameImages(full = byteArrayOf(1)), PromptHints(), AppSettings(apiKey = "k")))
        assertEquals("claude-haiku-5-5", b["model"].asText())
        assertEquals("disabled", b["thinking"]["type"].asText())
        assertEquals("low", b["output_config"]["effort"].asText())
        assertEquals("json_schema", b["output_config"]["format"]["type"].asText())
        // State, hint, a short look at the canvas and the guesses come first in the schema, so they stream first.
        val schema = b["output_config"]["format"]["schema"]
        assertEquals(SCHEMA_ORDER, schema["properties"].fieldNames().asSequence().toList())
        assertEquals(listOf("guessing", "word_revealed", "round_over", "not_game"), schema["properties"]["screen_state"]["enum"].map { it.asText() })
        assertTrue(schema["properties"]["hint"]["required"].map { it.asText() }.contains("clue"))
        assertEquals("string", schema["properties"]["seen"]["type"].asText())
        assertStrictObjects(schema)
        assertFalse(b.has("fallbacks"))
        assertEquals(1500, b["max_tokens"].asInt())
    }

    @Test fun `fast mode off keeps Haiku thinking`() {
        val b = body(ClaudeVisionClient().buildParams(FrameImages(full = byteArrayOf(1)), PromptHints(), AppSettings(apiKey = "k", fastMode = false)))
        assertFalse(b.has("thinking"))
    }

    @Test fun `Sonnet uses between_tools, Opus keeps thinking, both get refusal fallback`() {
        val sonnet = ClaudeVisionClient().buildParams(FrameImages(full = byteArrayOf(1)), PromptHints(), AppSettings(apiKey = "k", model = AiModel.SONNET))
        assertEquals("between_tools", body(sonnet)["thinking"]["type"].asText())
        assertEquals("default", body(sonnet)["fallbacks"].asText())
        assertTrue(sonnet._headers().values("anthropic-beta").any { it.contains(ClaudeVisionClient.FALLBACK_BETA) })
        val opus = body(ClaudeVisionClient().buildParams(FrameImages(full = byteArrayOf(1)), PromptHints(), AppSettings(apiKey = "k", model = AiModel.OPUS)))
        assertFalse(opus.has("thinking"))
        assertEquals("default", opus["fallbacks"].asText())
    }

    @Test(expected = VisionException.InvalidKey::class)
    fun `401 maps to InvalidKey`() = runTest {
        server.enqueue(MockResponse().setResponseCode(401).setHeader("content-type", "application/json")
            .setBody("""{"type":"error","error":{"type":"authentication_error","message":"invalid x-api-key"}}"""))
        ClaudeVisionClient().analyze(FrameImages(full = byteArrayOf(1)), PromptHints(), settings())
    }

    @Test fun `refusal is reported`() = runTest {
        server.enqueue(sse("claude-haiku-5-5", emptyList(), stop = "refusal"))
        val e = runCatching { ClaudeVisionClient().analyze(FrameImages(full = byteArrayOf(1)), PromptHints(), settings()) }.exceptionOrNull()
        assertTrue("got $e", e is VisionException.Refused)
    }

    @Test fun `test connection reports the Opus fallback`() = runTest {
        server.enqueue(MockResponse().setResponseCode(404).setHeader("content-type", "application/json")
            .setBody("""{"type":"error","error":{"type":"not_found_error","message":"model"}}"""))
        server.enqueue(MockResponse().setHeader("content-type", "application/json").setBody(mapper.writeValueAsString(mapOf(
            "id" to "m", "type" to "message", "role" to "assistant", "model" to "claude-opus-5-5",
            "content" to listOf(mapOf("type" to "text", "text" to "ready")), "stop_reason" to "end_turn", "stop_sequence" to null,
            "usage" to mapOf("input_tokens" to 5, "output_tokens" to 1)))))
        val r = ClaudeVisionClient().testConnection(settings())
        assertTrue(r.getOrThrow().contains("Haiku 5.5 is not available"))
    }

    @Test fun `close-ups are sent as labelled hint bar then canvas`() {
        val params = ClaudeVisionClient().buildParams(
            FrameImages(hintBar = byteArrayOf(1, 2), canvas = byteArrayOf(3, 4)), PromptHints(), AppSettings(apiKey = "k"),
        )
        val content = body(params)["messages"][0]["content"]
        assertEquals(listOf("text", "image", "text", "image", "text"), content.map { it["type"].asText() })
        assertTrue(content[0]["text"].asText().contains("top bar"))
        assertEquals(java.util.Base64.getEncoder().encodeToString(byteArrayOf(1, 2)), content[1]["source"]["data"].asText())
        assertEquals(java.util.Base64.getEncoder().encodeToString(byteArrayOf(3, 4)), content[3]["source"]["data"].asText())
        assertTrue(content[4]["text"].asText().contains("Return [] for canvas_box"))
    }

    @Test fun `answers rejected this round are named as wrong and never offered as candidates`() {
        val hints = PromptHints(
            HintPattern(1, 4, clue = "A state"),
            knownAnswers = listOf("Fear"),
            wordListCandidates = listOf("fear", "Rage", "Calm"),
            rejected = listOf("Calm", "Sleep"),
        )
        val params = ClaudeVisionClient().buildParams(
            FrameImages(hintBar = byteArrayOf(1), canvas = byteArrayOf(2)), hints, AppSettings(apiKey = "k"),
        )
        val text = body(params)["messages"][0]["content"][4]["text"].asText()
        assertTrue(text.contains("Already tried and wrong this round: Calm, Sleep. Do not suggest them again."))
        assertTrue(text.contains("(clue: A state)"))
        assertTrue(text.contains("Possible answers for this hint (use only if the drawing matches): Rage."))
    }

    @Test fun `rejected answers are sent even without word-list candidates`() {
        val text = SolverPrompt.userText(PromptHints(HintPattern(1, 4), wordListCandidates = listOf("Crab"), rejected = listOf("Crab")), cropped = true)
        assertTrue(text.contains("Already tried and wrong this round: Crab."))
        // Its only candidate was rejected, so there is nothing to suggest for the hint.
        assertFalse(text.contains("Possible answers"))
        assertFalse(text.contains("hint so far"))
        assertFalse(SolverPrompt.userText(PromptHints(), cropped = true).contains("Already tried"))
    }

    @Test fun `the prompt asks for a short look at the canvas and shows the fields in schema order`() {
        val system = SolverPrompt.SYSTEM
        assertTrue(system.contains("in \"seen\", say in at most 12 words"))
        val example = system.substringAfter("Return JSON only")
        val positions = SCHEMA_ORDER.map { example.indexOf("\"$it\":") }
        assertTrue("every field is in the example: $positions", positions.all { it >= 0 })
        assertEquals(positions.sorted(), positions)
        assertEquals(SCHEMA_ORDER, SolverPrompt.SCHEMA["required"])
    }

    /** Structured outputs need every object closed (additionalProperties false) with all its properties required. */
    private fun assertStrictObjects(node: JsonNode, path: String = "schema") {
        if (node["type"]?.asText() == "object") {
            assertFalse("$path allows extra properties", node["additionalProperties"].asBoolean(true))
            assertEquals("$path required", node["properties"].fieldNames().asSequence().toList(), node["required"].map { it.asText() })
        }
        node["properties"]?.fields()?.forEach { (name, child) -> assertStrictObjects(child, "$path.$name") }
        node["items"]?.let { assertStrictObjects(it, "$path[]") }
    }

    private companion object {
        val SCHEMA_ORDER = listOf(
            "screen_state", "revealed_answer", "canvas_empty", "hint", "seen", "guesses", "detected_object", "category",
            "emoji", "canvas_box", "hint_box",
        )
    }
}

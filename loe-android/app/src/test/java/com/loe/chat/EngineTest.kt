package com.loe.chat

import com.loe.chat.ai.AnthropicBackend
import com.loe.chat.ai.Endpoints
import com.loe.chat.data.BotCatalog
import com.loe.chat.data.ChatMessage
import com.loe.chat.data.ErrorCodes
import com.loe.chat.data.MessageStatus
import com.loe.chat.data.Provider
import com.loe.chat.data.Role
import kotlinx.coroutines.runBlocking
import okhttp3.mockwebserver.Dispatcher
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import okhttp3.mockwebserver.RecordedRequest
import org.json.JSONObject
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Assert.fail
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import java.io.File
import java.util.Base64
import java.util.concurrent.CopyOnWriteArrayList
import java.util.concurrent.TimeUnit

/** End-to-end tests of the chat engine against a local fake provider (no real API calls). */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35])
class EngineTest {
    private lateinit var server: MockWebServer
    private lateinit var graph: AppGraph
    private val requests = CopyOnWriteArrayList<Pair<RecordedRequest, String>>()

    @Before
    fun setUp() {
        server = MockWebServer()
        server.start()
        graph = Loe.graph
        Endpoints.override(Provider.OPENROUTER, server.url("/api/v1").toString())
        Endpoints.override(Provider.ANTHROPIC, server.url("/").toString())
        Endpoints.override(Provider.OPENAI, server.url("/openai/v1").toString())
        graph.settings.completeOnboarding("Tester", null)
    }

    @After
    fun tearDown() {
        server.shutdown()
        Endpoints.reset()
    }

    private fun serve(handler: (RecordedRequest, String) -> MockResponse) {
        server.dispatcher = object : Dispatcher() {
            override fun dispatch(request: RecordedRequest): MockResponse {
                val body = request.body.clone().readUtf8()
                requests += request to body
                return handler(request, body)
            }
        }
    }

    private fun sse(vararg data: String): MockResponse =
        MockResponse()
            .setHeader("Content-Type", "text/event-stream")
            .setBody(data.joinToString("") { "data: $it\n\n" } + "data: [DONE]\n\n")

    private fun chunk(text: String) = JSONObject().put(
        "choices", org.json.JSONArray().put(JSONObject().put("delta", JSONObject().put("content", text))),
    ).toString()

    private fun anthropicSse(text: String, stopReason: String = "end_turn", model: String = "claude-opus-5-5"): MockResponse {
        val events = listOf(
            "message_start" to """{"type":"message_start","message":{"id":"msg_1","type":"message","role":"assistant","model":"$model","content":[],"stop_reason":null,"stop_sequence":null,"usage":{"input_tokens":10,"output_tokens":1}}}""",
            "content_block_start" to """{"type":"content_block_start","index":0,"content_block":{"type":"text","text":""}}""",
            "content_block_delta" to """{"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":${JSONObject.quote(text)}}}""",
            "content_block_stop" to """{"type":"content_block_stop","index":0}""",
            "message_delta" to """{"type":"message_delta","delta":{"stop_reason":"$stopReason","stop_sequence":null},"usage":{"output_tokens":5}}""",
            "message_stop" to """{"type":"message_stop"}""",
        )
        return MockResponse()
            .setHeader("Content-Type", "text/event-stream")
            .setBody(events.joinToString("") { (name, data) -> "event: $name\ndata: $data\n\n" })
    }

    private fun waitForReply(conversationId: Long, timeoutMs: Long = 20_000, predicate: (ChatMessage) -> Boolean): ChatMessage {
        val deadline = System.currentTimeMillis() + timeoutMs
        while (System.currentTimeMillis() < deadline) {
            val reply = graph.repository.messagesNow(conversationId).lastOrNull { it.role == Role.BOT }
            if (reply != null && predicate(reply)) return reply
            Thread.sleep(40)
        }
        fail("Timed out. Messages: " + graph.repository.messagesNow(conversationId))
        throw IllegalStateException()
    }

    private fun waitFor(timeoutMs: Long = 20_000, condition: () -> Boolean) {
        val deadline = System.currentTimeMillis() + timeoutMs
        while (System.currentTimeMillis() < deadline) {
            if (condition()) return
            Thread.sleep(40)
        }
        fail("Timed out waiting for condition")
    }

    @Test
    fun assistantStreamsThroughOpenRouterAndGetsATitle() {
        graph.settings.setApiKey(Provider.OPENROUTER, "or-test-key")
        serve { _, body ->
            if (body.contains("gpt-4.1-nano")) sse(chunk("Friendly Greeting")) else sse(chunk("Xin chào!"), chunk(" Bạn khỏe không?"))
        }
        val id = runBlocking { graph.engine.startChat(BotCatalog.ASSISTANT_ID, "Hi there", emptyList()) }
        val reply = waitForReply(id) { it.status == MessageStatus.DONE }
        assertEquals("Xin chào! Bạn khỏe không?", reply.content)
        waitFor { graph.repository.conversationNow(id)?.title == "Friendly Greeting" }

        val chat = requests.first { !it.second.contains("gpt-4.1-nano") }
        assertEquals("/api/v1/chat/completions", chat.first.path)
        assertEquals("Bearer or-test-key", chat.first.getHeader("Authorization"))
        val json = JSONObject(chat.second)
        assertEquals("google/gemini-3.5-flash", json.getString("model"))
        assertTrue(json.getBoolean("stream"))
        val messages = json.getJSONArray("messages")
        assertEquals("system", messages.getJSONObject(0).getString("role"))
        assertTrue(messages.getJSONObject(0).getString("content").startsWith("You are Assistant"))
        assertEquals("Hi there", messages.getJSONObject(1).getString("content"))
        // The user message was marked sent and the chat list shows the reply.
        assertEquals(MessageStatus.SENT, graph.repository.messagesNow(id).first { it.role == Role.USER }.status)
        assertEquals("Assistant", graph.repository.conversationNow(id)!!.lastSender)
    }

    @Test
    fun claudeUsesTheOfficialSdkWithServerFallbacks() {
        graph.settings.setApiKey(Provider.ANTHROPIC, "ant-test-key")
        serve { _, body ->
            if (body.contains("claude-haiku-5-5")) anthropicSse("Claude Title", model = "claude-haiku-5-5") else anthropicSse("Hi from Claude")
        }
        val id = runBlocking { graph.engine.startChat("claude-opus-5.5", "Hello Claude", emptyList()) }
        val reply = waitForReply(id) { it.status == MessageStatus.DONE }
        assertEquals("Hi from Claude", reply.content)
        waitFor { graph.repository.conversationNow(id)?.title == "Claude Title" }

        val (request, body) = requests.first { it.second.contains("\"claude-opus-5-5\"") }
        assertEquals("/v1/messages", request.path?.substringBefore('?'))
        assertEquals("ant-test-key", request.getHeader("x-api-key"))
        assertTrue(request.getHeader("anthropic-beta").orEmpty().contains(AnthropicBackend.SERVER_FALLBACK_BETA))
        val json = JSONObject(body)
        assertEquals("default", json.getString("fallbacks"))
        assertTrue(json.getBoolean("stream"))
        assertEquals("user", json.getJSONArray("messages").getJSONObject(0).getString("role"))

        // The title request uses Haiku with low effort and no fallbacks.
        val title = JSONObject(requests.first { it.second.contains("claude-haiku-5-5") }.second)
        assertFalse(title.has("fallbacks"))
        assertEquals("low", title.getJSONObject("output_config").getString("effort"))
    }

    @Test
    fun claudeRefusalIsShownAsDeclined() {
        graph.settings.setApiKey(Provider.ANTHROPIC, "ant-test-key")
        serve { _, body -> if (body.contains("claude-haiku-5-5")) anthropicSse("Title") else anthropicSse("partial", stopReason = "refusal") }
        val id = runBlocking { graph.engine.startChat("claude-fable-5.1", "Something", emptyList()) }
        val reply = waitForReply(id) { it.status == MessageStatus.REFUSED }
        assertEquals("", reply.content)
        assertTrue(reply.error!!.contains("declined"))
    }

    @Test
    fun badKeyShowsAFriendlyError() {
        graph.settings.setApiKey(Provider.OPENROUTER, "wrong")
        serve { _, _ ->
            MockResponse().setResponseCode(401).setBody("""{"error":{"message":"No auth credentials found","code":401}}""")
        }
        val id = runBlocking { graph.engine.startChat("gpt-6-astra", "Hi", emptyList()) }
        val reply = waitForReply(id) { it.status == MessageStatus.ERROR }
        assertEquals(ErrorCodes.AUTH, reply.errorCode)
        assertTrue(reply.error!!.contains("OpenRouter"))
    }

    @Test
    fun missingKeyAsksToConnectOne() {
        val id = runBlocking { graph.engine.startChat(BotCatalog.ASSISTANT_ID, "Hi", emptyList()) }
        val reply = waitForReply(id) { it.status == MessageStatus.ERROR }
        assertEquals(ErrorCodes.NO_KEY, reply.errorCode)
        assertEquals("Hi Conversation", graph.repository.conversationNow(id)!!.title)
    }

    @Test
    fun perMessageBudgetBlocksExpensiveBots() {
        graph.settings.setApiKey(Provider.OPENROUTER, "k")
        graph.settings.setMessageBudget(100)
        val id = runBlocking { graph.engine.startChat("claude-fable-5.1", "Hi", emptyList()) }
        val reply = waitForReply(id) { it.status == MessageStatus.ERROR }
        assertEquals(ErrorCodes.BUDGET, reply.errorCode)
        assertTrue(requests.none { it.second.contains("claude-fable") })
    }

    @Test
    fun stopKeepsThePartialReply() {
        graph.settings.setApiKey(Provider.OPENROUTER, "k")
        serve { _, body ->
            if (body.contains("gpt-4.1-nano")) {
                sse(chunk("Title"))
            } else {
                val first = "data: ${chunk("Partial answer")}\n\n"
                val padding = "data: ${chunk(" more")}\n\n".repeat(200)
                MockResponse().setHeader("Content-Type", "text/event-stream")
                    .setBody(first + padding)
                    .throttleBody(first.length.toLong(), 2, TimeUnit.SECONDS)
            }
        }
        val id = runBlocking { graph.engine.startChat("gpt-5-mini", "Tell me a long story", emptyList()) }
        waitFor { graph.engine.live.value[id]?.text?.startsWith("Partial answer") == true }
        graph.engine.stop(id)
        val reply = waitForReply(id) { it.status == MessageStatus.STOPPED }
        assertTrue(reply.content.startsWith("Partial answer"))
        waitFor { id !in graph.engine.busy.value }
    }

    @Test
    fun openRouterImageBotSavesTheImage() {
        graph.settings.setApiKey(Provider.OPENROUTER, "k")
        val png = Base64.getEncoder().encodeToString(byteArrayOf(0x89.toByte(), 0x50, 0x4E, 0x47, 1, 2, 3))
        serve { _, body ->
            if (body.contains("\"modalities\"")) {
                MockResponse().setHeader("Content-Type", "application/json").setBody(
                    """{"choices":[{"message":{"role":"assistant","content":"Here you go","images":[{"type":"image_url","image_url":{"url":"data:image/png;base64,$png"}}]}}]}""",
                )
            } else {
                sse(chunk("Cat picture"))
            }
        }
        val id = runBlocking { graph.engine.startChat("nano-banana", "A cat in space", emptyList()) }
        val reply = waitForReply(id) { it.status == MessageStatus.DONE }
        assertEquals("Here you go", reply.content)
        assertEquals(1, reply.attachments.size)
        assertTrue(File(reply.attachments[0].path).exists())
        assertTrue(requests.any { JSONObject(it.second).optString("model") == "google/gemini-2.5-flash-image" })
    }

    @Test
    fun clearContextHidesEarlierMessagesFromTheBot() {
        graph.settings.setApiKey(Provider.OPENROUTER, "k")
        serve { _, body -> if (body.contains("gpt-4.1-nano")) sse(chunk("T")) else sse(chunk("ok")) }
        val id = runBlocking { graph.engine.startChat(BotCatalog.ASSISTANT_ID, "My secret is 42", emptyList()) }
        waitForReply(id) { it.status == MessageStatus.DONE }
        waitFor { id !in graph.engine.busy.value }
        graph.engine.clearContext(id)
        waitFor { graph.repository.messagesNow(id).last().role == Role.DIVIDER }
        requests.clear()
        graph.engine.send(id, "What is my secret?", emptyList())
        waitFor { graph.repository.messagesNow(id).count { it.role == Role.BOT && it.status == MessageStatus.DONE } == 2 }
        val body = requests.first { !it.second.contains("gpt-4.1-nano") }.second
        assertFalse(body.contains("My secret is 42"))
        assertTrue(body.contains("What is my secret?"))
    }

    @Test
    fun mentionSendsTheMessageToAnotherBot() {
        graph.settings.setApiKey(Provider.OPENROUTER, "k")
        serve { _, body -> if (body.contains("gpt-4.1-nano")) sse(chunk("T")) else sse(chunk("from mention")) }
        val id = runBlocking { graph.engine.startChat(BotCatalog.ASSISTANT_ID, "@GPT-5-mini hello", emptyList()) }
        val reply = waitForReply(id) { it.status == MessageStatus.DONE }
        assertEquals("gpt-5-mini", reply.botId)
        val body = JSONObject(requests.first { !it.second.contains("gpt-4.1-nano") }.second)
        assertEquals("openai/gpt-5-mini", body.getString("model"))
        assertEquals("hello", body.getJSONArray("messages").let { it.getJSONObject(it.length() - 1) }.getString("content"))
    }
}

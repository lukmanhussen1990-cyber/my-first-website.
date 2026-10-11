package com.imran.jarvis.ai

import com.imran.jarvis.data.Role
import java.util.concurrent.TimeUnit
import kotlinx.coroutines.cancelAndJoin
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.withTimeout
import okhttp3.OkHttpClient
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import okhttp3.mockwebserver.SocketPolicy
import org.json.JSONObject
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Assert.fail
import org.junit.Before
import org.junit.Test

/** Runs the real clients against a fake web server: what is sent, what is understood, what goes wrong. */
class AiClientsTest {

    private lateinit var server: MockWebServer
    private lateinit var baseUrl: String
    private val http = HttpJson(
        OkHttpClient.Builder()
            .readTimeout(400, TimeUnit.MILLISECONDS)
            .callTimeout(2, TimeUnit.SECONDS)
            .build(),
    )

    @Before
    fun setUp() {
        server = MockWebServer()
        server.start()
        baseUrl = server.url("/").toString().trimEnd('/')
    }

    @After
    fun tearDown() {
        server.shutdown()
    }

    private fun request(model: String, key: String = "KEY123") = AiRequest(
        apiKey = key,
        model = model,
        systemPrompt = "You are JARVIS.",
        turns = listOf(
            AiTurn(Role.USER, "hello"),
            AiTurn(Role.ASSISTANT, """{"reply":"hi","action":"none","target":""}"""),
            AiTurn(Role.USER, "open youtube"),
        ),
    )

    private val jarvisJson = """{"reply":"Opening YouTube.","action":"open_app","target":"YouTube"}"""

    private fun json(text: String) = JSONObject.quote(text) // a JSON string literal, quotes included

    private fun ok(body: String) = MockResponse().setResponseCode(200).setBody(body)
    private fun error(code: Int, body: String) = MockResponse().setResponseCode(code).setBody(body)

    private fun <T> expectFailure(block: suspend () -> T): AiException = runBlocking {
        try {
            block()
            fail("expected an AiException")
            throw IllegalStateException()
        } catch (e: AiException) {
            e
        }
    }

    // ------------------------------------------------------------------------------------------
    // Gemini
    // ------------------------------------------------------------------------------------------

    private fun gemini() = GeminiClient(http, baseUrl)

    private fun geminiAnswer(text: String) =
        """{"candidates":[{"content":{"role":"model","parts":[{"text":${json(text)}}]},"finishReason":"STOP"}]}"""

    @Test
    fun `gemini sends the key in a header and asks for JSON`() = runBlocking {
        server.enqueue(ok(geminiAnswer(jarvisJson)))
        val text = gemini().chat(request("gemini-3.5-flash-lite"))
        assertEquals(jarvisJson, text)

        val recorded = server.takeRequest()
        assertEquals("/v1beta/models/gemini-3.5-flash-lite:generateContent", recorded.path)
        assertEquals("KEY123", recorded.getHeader("x-goog-api-key"))
        assertFalse("the key must never be in the URL", recorded.path!!.contains("KEY123"))

        val body = JSONObject(recorded.body.readUtf8())
        assertEquals("You are JARVIS.", body.getJSONObject("systemInstruction").getJSONArray("parts").getJSONObject(0).getString("text"))
        assertEquals("application/json", body.getJSONObject("generationConfig").getString("responseMimeType"))
        val contents = body.getJSONArray("contents")
        assertEquals(listOf("user", "model", "user"), (0 until contents.length()).map { contents.getJSONObject(it).getString("role") })
        // Flash-Lite thinks minimally by default, so nothing is added.
        assertFalse(body.getJSONObject("generationConfig").has("thinkingConfig"))
    }

    @Test
    fun `gemini flash models are told to think less`() = runBlocking {
        server.enqueue(ok(geminiAnswer(jarvisJson)))
        gemini().chat(request("gemini-3.8-flash"))
        val body = JSONObject(server.takeRequest().body.readUtf8())
        assertEquals("low", body.getJSONObject("generationConfig").getJSONObject("thinkingConfig").getString("thinkingLevel"))
    }

    @Test
    fun `gemini retries without the speed-up option when the model refuses it, and remembers`() = runBlocking {
        server.enqueue(error(400, """{"error":{"code":400,"message":"Invalid JSON payload received. Unknown name \"thinkingLevel\" at 'generation_config.thinking_config'","status":"INVALID_ARGUMENT"}}"""))
        server.enqueue(ok(geminiAnswer(jarvisJson)))
        val client = gemini()
        assertEquals(jarvisJson, client.chat(request("gemini-3.9-flash")))

        val first = JSONObject(server.takeRequest().body.readUtf8())
        val second = JSONObject(server.takeRequest().body.readUtf8())
        assertTrue(first.getJSONObject("generationConfig").has("thinkingConfig"))
        assertFalse(second.getJSONObject("generationConfig").has("thinkingConfig"))
        assertFalse(second.getJSONObject("generationConfig").has("responseMimeType"))

        // Next question for the same model goes out clean straight away.
        server.enqueue(ok(geminiAnswer(jarvisJson)))
        client.chat(request("gemini-3.9-flash"))
        assertEquals(3, server.requestCount)
        assertFalse(JSONObject(server.takeRequest().body.readUtf8()).getJSONObject("generationConfig").has("thinkingConfig"))
    }

    @Test
    fun `gemini wrong key is reported as invalid key, even though it is HTTP 400`() {
        server.enqueue(error(400, """{"error":{"code":400,"message":"API key not valid. Please pass a valid API key.","status":"INVALID_ARGUMENT","details":[{"@type":"type.googleapis.com/google.rpc.ErrorInfo","reason":"API_KEY_INVALID"}]}}"""))
        assertTrue(expectFailure { gemini().chat(request("gemini-3.5-flash-lite")) } is AiException.InvalidApiKey)
        assertEquals(1, server.requestCount) // not retried: it was not about the optional option
    }

    @Test
    fun `gemini error codes`() {
        val cases = listOf(
            404 to AiException.ModelNotFound::class.java,
            429 to AiException.RateLimited::class.java,
            503 to AiException.ServerError::class.java,
            403 to AiException.PermissionDenied::class.java,
            401 to AiException.InvalidApiKey::class.java,
        )
        for ((code, expected) in cases) {
            server.enqueue(error(code, """{"error":{"code":$code,"message":"x","status":"X"}}"""))
            val e = expectFailure { gemini().chat(request("gemini-3.5-flash-lite")) }
            assertEquals("HTTP $code", expected, e.javaClass)
        }
    }

    @Test
    fun `gemini skips private thoughts and blocked prompts are reported`() = runBlocking {
        server.enqueue(ok("""{"candidates":[{"content":{"parts":[{"text":"secret","thought":true},{"text":${json(jarvisJson)}}]}}]}"""))
        assertEquals(jarvisJson, gemini().chat(request("gemini-3.5-flash-lite")))

        server.enqueue(ok("""{"promptFeedback":{"blockReason":"SAFETY"}}"""))
        assertTrue(expectFailure { gemini().chat(request("gemini-3.5-flash-lite")) } is AiException.Blocked)

        server.enqueue(ok("""{"candidates":[{"content":{"parts":[]},"finishReason":"STOP"}]}"""))
        assertTrue(expectFailure { gemini().chat(request("gemini-3.5-flash-lite")) } is AiException.EmptyReply)
    }

    // ------------------------------------------------------------------------------------------
    // OpenAI
    // ------------------------------------------------------------------------------------------

    private fun openai() = OpenAiClient(http, baseUrl)

    private fun openaiAnswer(text: String) =
        """{"choices":[{"index":0,"message":{"role":"assistant","content":${json(text)}},"finish_reason":"stop"}]}"""

    @Test
    fun `openai request shape`() = runBlocking {
        server.enqueue(ok(openaiAnswer(jarvisJson)))
        assertEquals(jarvisJson, openai().chat(request("gpt-6-luna")))

        val recorded = server.takeRequest()
        assertEquals("/v1/chat/completions", recorded.path)
        assertEquals("Bearer KEY123", recorded.getHeader("Authorization"))
        val body = JSONObject(recorded.body.readUtf8())
        assertEquals("gpt-6-luna", body.getString("model"))
        assertEquals("json_object", body.getJSONObject("response_format").getString("type"))
        assertEquals("none", body.getString("reasoning_effort"))
        assertFalse(body.has("temperature"))
        assertFalse(body.has("max_tokens"))
        val messages = body.getJSONArray("messages")
        assertEquals(listOf("system", "user", "assistant", "user"), (0 until messages.length()).map { messages.getJSONObject(it).getString("role") })
    }

    @Test
    fun `openai reasoning setting depends on the model family`() {
        assertEquals("none", OpenAiClient.reasoningEffortFor("gpt-6-luna"))
        assertEquals("low", OpenAiClient.reasoningEffortFor("gpt-6.1-sol"))
        assertEquals("low", OpenAiClient.reasoningEffortFor("gpt-6-astra"))
        assertEquals("none", OpenAiClient.reasoningEffortFor("gpt-5.1"))
        assertEquals("minimal", OpenAiClient.reasoningEffortFor("gpt-5-mini"))
        assertEquals("low", OpenAiClient.reasoningEffortFor("o4-mini"))
        assertNull(OpenAiClient.reasoningEffortFor("gpt-4.1-mini"))
        assertNull(OpenAiClient.reasoningEffortFor("gpt-4o-mini"))
    }

    @Test
    fun `openai retries without reasoning setting when refused`() = runBlocking {
        server.enqueue(error(400, """{"error":{"message":"Unsupported value: 'minimal' is not supported with this model. Supported values: reasoning_effort ...","type":"invalid_request_error","param":"reasoning_effort","code":"unsupported_value"}}"""))
        server.enqueue(ok(openaiAnswer(jarvisJson)))
        assertEquals(jarvisJson, openai().chat(request("gpt-5-mini")))
        val first = JSONObject(server.takeRequest().body.readUtf8())
        val second = JSONObject(server.takeRequest().body.readUtf8())
        assertTrue(first.has("reasoning_effort"))
        assertFalse(second.has("reasoning_effort"))
        assertFalse(second.has("response_format"))
    }

    @Test
    fun `openai error codes`() {
        val quota = """{"error":{"message":"You exceeded your current quota","type":"insufficient_quota","code":"insufficient_quota"}}"""
        server.enqueue(error(429, quota))
        assertTrue(expectFailure { openai().chat(request("gpt-6-luna")) } is AiException.QuotaOrBilling)

        server.enqueue(error(429, """{"error":{"message":"Rate limit reached","type":"requests","code":"rate_limit_exceeded"}}"""))
        assertTrue(expectFailure { openai().chat(request("gpt-6-luna")) } is AiException.RateLimited)

        server.enqueue(error(401, """{"error":{"message":"Incorrect API key provided: sk-***","type":"invalid_request_error","code":"invalid_api_key"}}"""))
        assertTrue(expectFailure { openai().chat(request("gpt-6-luna")) } is AiException.InvalidApiKey)

        server.enqueue(error(404, """{"error":{"message":"The model `gpt-9` does not exist","type":"invalid_request_error","code":"model_not_found"}}"""))
        val notFound = expectFailure { openai().chat(request("gpt-9")) }
        assertTrue(notFound is AiException.ModelNotFound)
        assertEquals("gpt-9", (notFound as AiException.ModelNotFound).model)

        server.enqueue(error(500, "oops"))
        assertTrue(expectFailure { openai().chat(request("gpt-6-luna")) } is AiException.ServerError)
    }

    @Test
    fun `openai refusal and empty answers`() {
        server.enqueue(ok("""{"choices":[{"message":{"role":"assistant","content":null,"refusal":"I can't help with that."},"finish_reason":"stop"}]}"""))
        assertTrue(expectFailure { openai().chat(request("gpt-6-luna")) } is AiException.Blocked)
        server.enqueue(ok("""{"choices":[]}"""))
        assertTrue(expectFailure { openai().chat(request("gpt-6-luna")) } is AiException.EmptyReply)
    }

    // ------------------------------------------------------------------------------------------
    // Claude
    // ------------------------------------------------------------------------------------------

    private fun claude() = ClaudeClient(http, baseUrl)

    private fun claudeAnswer(text: String) =
        """{"id":"msg_1","type":"message","role":"assistant","content":[{"type":"thinking","thinking":"","signature":"abc"},{"type":"text","text":${json(text)}}],"stop_reason":"end_turn"}"""

    @Test
    fun `claude request shape`() = runBlocking {
        server.enqueue(ok(claudeAnswer(jarvisJson)))
        // The answer starts with a thinking block, and the text is still found.
        assertEquals(jarvisJson, claude().chat(request("claude-haiku-5-5")))

        val recorded = server.takeRequest()
        assertEquals("/v1/messages", recorded.path)
        assertEquals("KEY123", recorded.getHeader("x-api-key"))
        assertEquals("2023-06-01", recorded.getHeader("anthropic-version"))
        val body = JSONObject(recorded.body.readUtf8())
        assertEquals("claude-haiku-5-5", body.getString("model"))
        assertEquals("You are JARVIS.", body.getString("system"))
        assertEquals("low", body.getJSONObject("output_config").getString("effort"))
        assertTrue(body.getInt("max_tokens") >= 1024)
        assertFalse(body.has("temperature"))
        val messages = body.getJSONArray("messages")
        assertEquals(listOf("user", "assistant", "user"), (0 until messages.length()).map { messages.getJSONObject(it).getString("role") })
        // The conversation must end with the user's message (no "prefill").
        assertEquals("user", messages.getJSONObject(messages.length() - 1).getString("role"))
    }

    @Test
    fun `claude effort is only sent to models that support it`() {
        assertTrue(ClaudeClient.supportsEffort("claude-haiku-5-5"))
        assertTrue(ClaudeClient.supportsEffort("claude-sonnet-5-5"))
        assertTrue(ClaudeClient.supportsEffort("claude-opus-5-5"))
        assertTrue(ClaudeClient.supportsEffort("claude-opus-4-8"))
        assertFalse(ClaudeClient.supportsEffort("claude-haiku-4-5"))
        assertFalse(ClaudeClient.supportsEffort("claude-sonnet-4-5"))
    }

    @Test
    fun `claude retries without effort when refused`() = runBlocking {
        server.enqueue(error(400, """{"type":"error","error":{"type":"invalid_request_error","message":"output_config.effort: this setting is not supported for this model"}}"""))
        server.enqueue(ok(claudeAnswer(jarvisJson)))
        assertEquals(jarvisJson, claude().chat(request("claude-haiku-5-5")))

        val first = JSONObject(server.takeRequest().body.readUtf8())
        val second = JSONObject(server.takeRequest().body.readUtf8())
        assertTrue(first.has("output_config"))
        assertFalse(second.has("output_config"))
    }

    @Test
    fun `claude does not send effort to old models`() = runBlocking {
        server.enqueue(ok(claudeAnswer(jarvisJson)))
        claude().chat(request("claude-haiku-4-5"))
        assertFalse(JSONObject(server.takeRequest().body.readUtf8()).has("output_config"))
    }

    @Test
    fun `claude error codes`() {
        val cases = listOf(
            401 to "authentication_error" to AiException.InvalidApiKey::class.java,
            403 to "permission_error" to AiException.PermissionDenied::class.java,
            404 to "not_found_error" to AiException.ModelNotFound::class.java,
            429 to "rate_limit_error" to AiException.RateLimited::class.java,
            529 to "overloaded_error" to AiException.ServerError::class.java,
            500 to "api_error" to AiException.ServerError::class.java,
        )
        for ((codeAndType, expected) in cases) {
            val (code, type) = codeAndType
            server.enqueue(error(code, """{"type":"error","error":{"type":"$type","message":"x"}}"""))
            assertEquals("HTTP $code", expected, expectFailure { claude().chat(request("claude-haiku-5-5")) }.javaClass)
        }
    }

    @Test
    fun `claude empty credit balance is a billing problem`() {
        server.enqueue(error(400, """{"type":"error","error":{"type":"invalid_request_error","message":"Your credit balance is too low to access the Anthropic API."}}"""))
        assertTrue(expectFailure { claude().chat(request("claude-haiku-5-5")) } is AiException.QuotaOrBilling)
    }

    @Test
    fun `claude refusal`() {
        server.enqueue(ok("""{"content":[],"stop_reason":"refusal","stop_details":{"type":"refusal","category":"cyber"}}"""))
        assertTrue(expectFailure { claude().chat(request("claude-haiku-5-5")) } is AiException.Blocked)
    }

    // ------------------------------------------------------------------------------------------
    // Shared behaviour
    // ------------------------------------------------------------------------------------------

    @Test
    fun `a missing key is reported before anything is sent`() {
        val e = expectFailure { gemini().chat(request("gemini-3.5-flash-lite", key = "  ")) }
        assertTrue(e is AiException.NoApiKey)
        assertEquals(0, server.requestCount)
    }

    @Test
    fun `no connection is reported as no internet`() {
        server.shutdown() // nothing is listening any more
        val e = expectFailure { openai().chat(request("gpt-6-luna")) }
        assertTrue(e is AiException.NoInternet)
    }

    @Test
    fun `a server that never answers is reported as a timeout`() {
        server.enqueue(MockResponse().setSocketPolicy(SocketPolicy.NO_RESPONSE))
        val e = expectFailure { claude().chat(request("claude-haiku-5-5")) }
        assertTrue("was $e", e is AiException.Timeout)
    }

    @Test
    fun `cancelling the coroutine stops the request quickly`() = runBlocking {
        server.enqueue(MockResponse().setSocketPolicy(SocketPolicy.NO_RESPONSE))
        val slow = OpenAiClient(
            HttpJson(OkHttpClient.Builder().readTimeout(30, TimeUnit.SECONDS).callTimeout(60, TimeUnit.SECONDS).build()),
            baseUrl,
        )
        val job = launch { slow.chat(request("gpt-6-luna")) }
        delay(300)
        withTimeout(2_000) { job.cancelAndJoin() } // would hang for 30 s if cancellation did not reach OkHttp
        assertTrue(job.isCancelled)
    }

    @Test
    fun `models can be typed with the models prefix for gemini`() = runBlocking {
        server.enqueue(ok(geminiAnswer(jarvisJson)))
        gemini().chat(request("models/gemini-3.5-flash-lite"))
        assertEquals("/v1beta/models/gemini-3.5-flash-lite:generateContent", server.takeRequest().path)
    }

    @Test
    fun `error info understands all three error shapes and bad bodies`() {
        assertEquals("boom", ErrorInfo.parse("""{"error":{"message":"boom","type":"t","code":"c","status":"S"}}""").message)
        assertEquals("flat", ErrorInfo.parse("""{"message":"flat"}""").message)
        assertEquals("not json", ErrorInfo.parse("not json").message)
        assertEquals("", ErrorInfo.parse("").message)
        assertEquals("429", ErrorInfo.parse("""{"error":{"message":"m","code":429}}""").code)
    }
}

package com.loe.chat.r8

import com.loe.chat.ai.AnthropicBackend
import com.loe.chat.ai.ApiException
import com.loe.chat.ai.ChatRequest
import com.loe.chat.ai.ChatTurn
import com.loe.chat.ai.Endpoints
import com.loe.chat.ai.ImagePart
import com.loe.chat.ai.Purpose
import com.loe.chat.ai.Route
import com.loe.chat.ai.StreamEvent
import com.loe.chat.data.Provider
import kotlinx.coroutines.flow.collect
import kotlinx.coroutines.runBlocking

/**
 * Not a unit test: an entry point run against the R8-shrunk release classes (see tools/verify-r8.sh)
 * to prove the Claude SDK still serializes requests and parses streams after shrinking.
 */
object R8Harness {
    @JvmStatic
    fun main(args: Array<String>) {
        Endpoints.override(Provider.ANTHROPIC, args[0])
        val backend = AnthropicBackend()
        var failures = 0

        fun run(name: String, request: ChatRequest, check: (String, StreamEvent.Finished?) -> Boolean) {
            val text = StringBuilder()
            var finished: StreamEvent.Finished? = null
            val outcome = try {
                runBlocking {
                    backend.stream(request).collect { event ->
                        when (event) {
                            is StreamEvent.TextDelta -> text.append(event.text)
                            is StreamEvent.Finished -> finished = event
                            else -> Unit
                        }
                    }
                }
                if (check(text.toString(), finished)) "PASS" else "FAIL"
            } catch (e: Throwable) {
                if (name.startsWith("error") && e is ApiException && check(e.code + ":" + e.message, null)) "PASS" else {
                    e.printStackTrace()
                    "FAIL ($e)"
                }
            }
            if (outcome != "PASS") failures++
            println("$outcome  $name  text=\"$text\" finished=$finished")
        }

        val route = Route(Provider.ANTHROPIC, "claude-opus-5-5", "good-key")
        run("stream with fallbacks + image", ChatRequest(
            route, "You are a test.",
            listOf(
                ChatTurn(true, "Hello", listOf(ImagePart("image/jpeg", "aGVsbG8="))),
                ChatTurn(false, "Hi!"),
                ChatTurn(true, "How are you?"),
            ),
        )) { text, fin -> text == "Hi from Claude" && fin?.refused == false }
        run("refusal", ChatRequest(route, null, listOf(ChatTurn(true, "REFUSE please")))) { _, fin -> fin?.refused == true }
        run("title with low effort", ChatRequest(route.copy(model = "claude-haiku-5-5"), "t", listOf(ChatTurn(true, "x")), purpose = Purpose.TITLE)) { text, _ -> text == "Hi from Claude" }
        run("error 401", ChatRequest(route.copy(apiKey = "bad-key"), null, listOf(ChatTurn(true, "x")))) { msg, _ -> msg.startsWith("auth:") }
        val keyResult = runCatching { backend.testKey("good-key") }
        println((if (keyResult.isSuccess) "PASS" else "FAIL").also { if (it == "FAIL") failures++ } + "  models().list() -> $keyResult")
        println(if (failures == 0) "ALL PASSED" else "$failures FAILED")
        kotlin.system.exitProcess(if (failures == 0) 0 else 1)
    }
}

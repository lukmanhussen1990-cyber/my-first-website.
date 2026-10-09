package com.loe.chat

import android.graphics.Bitmap
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.test.hasScrollAction
import androidx.compose.ui.test.hasText
import androidx.compose.ui.test.hasClickAction
import androidx.compose.ui.test.hasContentDescription
import androidx.activity.ComponentActivity
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onFirst
import androidx.compose.ui.test.onAllNodesWithContentDescription
import androidx.compose.ui.test.performSemanticsAction
import androidx.compose.ui.semantics.SemanticsActions
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollToNode
import androidx.compose.ui.test.performTextInput
import androidx.compose.ui.test.hasSetTextAction
import com.loe.chat.ai.Endpoints
import com.loe.chat.data.MessageStatus
import com.loe.chat.data.Provider
import com.loe.chat.data.Role
import com.loe.chat.data.ThemeMode
import com.loe.chat.ui.LoeApp
import com.loe.chat.ui.theme.LoeTheme
import com.loe.chat.ui.theme.isLoeDark
import kotlinx.coroutines.runBlocking
import okhttp3.mockwebserver.Dispatcher
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import okhttp3.mockwebserver.RecordedRequest
import org.junit.After
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode
import java.io.File
import java.util.concurrent.TimeUnit

/**
 * Walks through the app like the reference video and saves a PNG of every screen to
 * app/build/screenshots (720×1616, the same size as the video).
 */
@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = [35], qualifiers = "w360dp-h808dp-xhdpi")
class ScreenshotTest {
    @get:Rule
    val compose = createAndroidComposeRule<ComponentActivity>()

    private lateinit var server: MockWebServer
    private val outDir = File("build/screenshots").apply { mkdirs() }

    @Before
    fun setUp() {
        server = MockWebServer()
        server.dispatcher = object : Dispatcher() {
            override fun dispatch(request: RecordedRequest): MockResponse {
                val body = request.body.readUtf8()
                if (body.contains("gpt-4.1-nano")) return sse("{\"choices\":[{\"delta\":{\"content\":\"Gi Conversation\"}}]}")
                // A slow reply so the "Thinking…" state and the Stop button can be captured.
                val text = "Xin chào! Bạn muốn mình giúp gì cụ thể? 😊"
                return sse("{\"choices\":[{\"delta\":{\"content\":\"${text}\"}}]}")
                    .setBodyDelay(4, TimeUnit.SECONDS)
            }
        }
        server.start()
        Endpoints.override(Provider.OPENROUTER, server.url("/api/v1").toString())
    }

    @After
    fun tearDown() {
        server.shutdown()
        Endpoints.reset()
    }

    private fun sse(vararg data: String) = MockResponse()
        .setHeader("Content-Type", "text/event-stream")
        .setBody(data.joinToString("") { "data: $it\n\n" } + "data: [DONE]\n\n")

    private fun pump(ms: Long = 800) {
        compose.mainClock.advanceTimeBy(ms)
        compose.waitForIdle()
    }

    private fun waitForText(text: String, timeoutMs: Long = 10_000) {
        val deadline = System.currentTimeMillis() + timeoutMs
        while (System.currentTimeMillis() < deadline) {
            pump(64)
            if (compose.onAllNodesWithText(text, substring = true).fetchSemanticsNodes().isNotEmpty()) return
            Thread.sleep(30)
        }
        throw AssertionError("Text not found: $text")
    }

    private fun snap(name: String) {
        pump(600)
        val view = compose.activity.window.decorView
        val bitmap = Bitmap.createBitmap(view.width, view.height, Bitmap.Config.ARGB_8888)
        compose.runOnUiThread { view.draw(android.graphics.Canvas(bitmap)) }
        File(outDir, "$name.png").outputStream().use { bitmap.compress(Bitmap.CompressFormat.PNG, 100, it) }
    }

    private fun clickText(text: String) {
        compose.onAllNodes(hasText(text) and hasClickAction()).onFirst().performSemanticsAction(SemanticsActions.OnClick)
        pump(900)
    }

    private fun clickDescription(description: String) {
        compose.onAllNodes((hasContentDescription(description) or hasText(description)) and hasClickAction())
            .onFirst().performSemanticsAction(SemanticsActions.OnClick)
        pump(900)
    }

    private fun seed(graph: AppGraph) = runBlocking {
        val repo = graph.repository
        suspend fun chat(botId: String, title: String, user: String, reply: String, unread: Boolean) {
            val id = repo.createConversation(botId)
            repo.insertMessage(id, Role.USER, null, user, status = MessageStatus.SENT)
            repo.insertMessage(id, Role.BOT, botId, reply, status = MessageStatus.DONE)
            repo.setTitle(id, title)
            repo.touchConversation(id, reply, graph.bots.getOrAssistant(botId).name, incrementUnread = unread)
            Thread.sleep(5)
        }
        chat("deepseek-v4-flash", "Goku Ultra Instinct Mario", "Who would win?", "Thinking about it, Goku's Ultra Instinct…", false)
        chat("grok-4.7", "Page Curve Unitarity Proof", "Explain the Page curve", "The Page curve describes how entanglement entropy…", true)
        chat("claude-fable-5.1", "Greeting", "Hello!", "Hello! How can I help you today?", true)
        chat("gpt-6-astra", "Greeting", "Hi", "Hi! What would you like to work on?", true)
        chat("claude-fable-5.1", "F", "F", "It looks like you sent just the letter F. How can I help?", true)
    }

    @Test
    fun appTour() {
        val graph = Loe.graph
        graph.settings.setApiKey(Provider.OPENROUTER, "test-key")
        seed(graph)
        compose.setContent {
            val settings by graph.settings.state.collectAsState()
            LoeTheme(dark = isLoeDark(settings.theme)) {
                LoeApp(graph, openConversationId = null, onOpenedConversation = {})
            }
        }
        // First launch: welcome screen.
        waitForText("Welcome to Loe")
        snap("00_welcome")
        compose.onAllNodes(hasSetTextAction()).onFirst().performTextInput("Sam Lee")
        pump()
        clickText("Continue")

        waitForText("Official bots")
        snap("01_home")

        clickDescription("Explore")
        waitForText("Search for bots or people")
        snap("02_explore")

        clickDescription("History")
        waitForText("Page Curve Unitarity Proof")
        snap("03_history")

        clickDescription("Menu")
        waitForText("Send feedback")
        snap("04_menu")

        clickText("Settings")
        waitForText("Free plan")
        snap("05_settings_top")
        compose.onAllNodes(hasScrollAction()).onFirst().performScrollToNode(hasText("Device appearance"))
        snap("06_settings_middle")
        compose.onAllNodes(hasScrollAction()).onFirst().performScrollToNode(hasText("Delete account"))
        snap("07_settings_bottom")

        clickDescription("Menu")
        pump()
        clickText("Profile")
        waitForText("Followers")
        snap("08_profile")

        clickDescription("Menu")
        pump()
        clickText("Subscribe")
        snap("09_subscribe")

        clickDescription("Home")
        waitForText("Official bots")
        compose.onAllNodes(hasText("Astra", substring = true) and hasClickAction()).onFirst().performSemanticsAction(SemanticsActions.OnClick)
        pump(900)
        waitForText("View details")
        snap("10_new_chat")

        // Send a message and capture the thinking state, then the reply.
        compose.onAllNodes(hasSetTextAction()).onFirst().performTextInput("Gi")
        pump(300)
        snap("11_typing")
        // The Stop button spinner animates forever, so drive the clock by hand until the reply lands.
        compose.mainClock.autoAdvance = false
        clickDescription("Send")
        pump(400)
        Thread.sleep(2300)
        pump(400)
        snap("12_thinking")
        waitForText("Xin chào", timeoutMs = 15_000)
        Thread.sleep(500)
        pump(500)
        compose.mainClock.autoAdvance = true
        waitForText("Gi Conversation", timeoutMs = 10_000)
        snap("13_reply")

        clickDescription("Back")
        pump()
        snap("14_home_after")

        // Dark theme.
        graph.settings.setTheme(ThemeMode.DARK)
        pump()
        clickDescription("History")
        pump()
        clickText("Gi Conversation")
        waitForText("Xin chào")
        snap("15_chat_dark")
    }
}

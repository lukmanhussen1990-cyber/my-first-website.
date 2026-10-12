package com.weplay.guesserai.service

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import androidx.room.Room
import androidx.test.core.app.ApplicationProvider
import com.weplay.guesserai.data.HistoryRepository
import com.weplay.guesserai.data.WordBankRepository
import com.weplay.guesserai.data.db.AppDatabase
import com.weplay.guesserai.data.settings.SecretCipher
import com.weplay.guesserai.data.settings.SettingsRepository
import com.weplay.guesserai.domain.AppSettings
import com.weplay.guesserai.domain.FrameAnalysis
import com.weplay.guesserai.domain.FrameImages
import com.weplay.guesserai.domain.Guess
import com.weplay.guesserai.domain.HintPattern
import com.weplay.guesserai.domain.PartialAnalysis
import com.weplay.guesserai.domain.PromptHints
import com.weplay.guesserai.domain.ScreenLayout
import com.weplay.guesserai.domain.ScreenState
import com.weplay.guesserai.domain.VisionAnalyzer
import com.weplay.guesserai.domain.VisionException
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.TestScope
import kotlinx.coroutines.test.advanceTimeBy
import kotlinx.coroutines.test.runCurrent
import kotlinx.coroutines.test.runTest
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode
import java.util.concurrent.Executor

/**
 * The in-game loop end to end, on the JVM: real capture processing (fingerprints, crops, JPEGs),
 * real round logic and learning database, with a drawn WePlay-like screen and a fake model, in
 * virtual time. Each test is a minute or so of play that runs in about a second.
 */
@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = [34])
class SessionJourneyTest {
    private val ctx: Context = ApplicationProvider.getApplicationContext()
    private val direct = Executor { it.run() }
    private val db = Room.inMemoryDatabaseBuilder(ctx, AppDatabase::class.java)
        .allowMainThreadQueries().setQueryExecutor(direct).setTransactionExecutor(direct).build()

    @After fun tearDown() = db.close()

    /** A WePlay screen as the capturer delivers it (1280 px on the long side). */
    private class Screen : FrameSource {
        val w = 574
        val h = 1280
        val layout = ScreenLayout.weplayDefault(h.toFloat() / w)!!
        var hint = "4 letters|A state"
        /** Pixels the hint has scrolled, for a hint too long for the bar. */
        var scroll = 0
        var strokes = 0
        /** Round-over popup text over the canvas, e.g. "Word: utah". */
        var popup: String? = null
        private val bitmap = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888)
        private val text = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Color.WHITE; textSize = 28f }
        private val ink = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Color.BLACK; strokeWidth = 6f }
        private val popupText = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Color.BLACK; textSize = 30f }
        override val scale = 1f

        override fun capture(): Frame {
            val c = Canvas(bitmap)
            c.drawColor(Color.WHITE)
            val barTop = layout.hint[1] * h
            val barBottom = layout.hint[3] * h
            c.drawRect(0f, 0f, w.toFloat(), barBottom, Paint().apply { color = Color.rgb(120, 194, 98) })
            c.save()
            c.clipRect(0.25f * w, barTop, 0.78f * w, barBottom)
            val loop = text.measureText(hint) + 60f
            val x = 0.25f * w - scroll % loop
            c.drawText(hint, x, barTop + 38f, text)
            if (scroll > 0) c.drawText(hint, x + loop, barTop + 38f, text)
            c.restore()
            // Chat area under the canvas: the part of the screen that must never be saved.
            c.drawRect(0f, layout.canvas[3] * h, w.toFloat(), h.toFloat(), Paint().apply { color = Color.rgb(30, 30, 60) })
            for (k in 0 until strokes) c.drawLine(80f, 220f + 40f * k, 480f, 250f + 40f * k, ink)
            popup?.let {
                c.drawRect(60f, 250f, 514f, 420f, Paint().apply { color = Color.rgb(250, 250, 250) })
                c.drawRect(60f, 250f, 514f, 420f, Paint().apply { color = Color.GRAY; style = Paint.Style.STROKE; strokeWidth = 3f })
                c.drawText(it, 120f, 340f, popupText)
            }
            return Frame(bitmap, w, h)
        }
    }

    /** Stands in for the model: answers from what the screen shows, after [latency] ms. */
    private class FakeAi(private val screen: Screen, private val scope: TestScope) : VisionAnalyzer {
        class Call(val at: Long, val images: FrameImages, val hints: PromptHints)
        val calls = mutableListOf<Call>()
        var latency = 1_200L
        var failNext: Throwable? = null
        var guesses = listOf(Guess("Utah", 80), Guess("Ohio", 40))
        val hint = HintPattern(1, 4, clue = "A state")
        private var running = 0
        var maxRunning = 0

        override suspend fun analyze(images: FrameImages, hints: PromptHints, settings: AppSettings, onPartial: (PartialAnalysis) -> Unit): FrameAnalysis {
            calls += Call(scope.testScheduler.currentTime, images, hints)
            running++
            maxRunning = maxOf(maxRunning, running)
            try {
                delay(latency)
            } finally {
                running--
            }
            failNext?.let { failNext = null; throw it }
            val popup = screen.popup
            return FrameAnalysis(
                isDrawingGame = true, canvasEmpty = screen.strokes == 0 && popup == null,
                detectedObject = "map", category = "Place", emoji = "🗺",
                hint = hint, canvasBox = screen.layout.canvas, hintBox = screen.layout.hint,
                guesses = if (popup == null) guesses else emptyList(),
                modelUsed = settings.modelId,
                screenState = if (popup == null) ScreenState.GUESSING else ScreenState.ROUND_OVER,
                revealedAnswer = popup?.removePrefix("Word: ") ?: "",
            )
        }

        override suspend fun testConnection(settings: AppSettings) = Result.success("ok")
    }

    private object PlainCipher : SecretCipher {
        override fun encrypt(plain: String) = plain.reversed()
        override fun decrypt(encoded: String) = encoded.reversed()
    }

    private inner class Game(val test: TestScope) {
        val screen = Screen()
        val ai = FakeAi(screen, test)
        val settings = SettingsRepository(ctx, PlainCipher).apply {
            update { AppSettings(apiKey = "sk-test", accuracyBoost = false, autoPauseWhenGameClosed = false) }
        }
        val history = HistoryRepository(ctx, db.drawingDao(), io = StandardTestDispatcher(test.testScheduler))
        val session = AssistantSession(
            scope = test.backgroundScope,
            capturer = screen,
            analyzer = ai,
            history = history,
            settingsRepo = settings,
            wordBanks = WordBankRepository(ctx),
            gameMonitor = GameAppMonitor(ctx),
            isScreenOn = { true },
            overlayRect = { null },
            work = StandardTestDispatcher(test.testScheduler),
            clock = { test.testScheduler.currentTime },
        )

        fun play(ms: Long) {
            test.advanceTimeBy(ms)
            test.runCurrent()
        }

        /** Seconds (from the start) at which frames were sent. */
        fun sentAt(): List<Long> = ai.calls.map { it.at / 1000 }
    }

    private fun game(body: suspend Game.() -> Unit) = runTest {
        val g = Game(this)
        g.screen.strokes = 1
        g.session.start()
        g.body()
        g.session.stop()
    }

    @Test fun `a still drawing is sent once, each new stroke at once`() = game {
        play(10_000)
        screen.strokes = 2
        play(10_000)
        screen.strokes = 3
        play(10_000)
        assertEquals(listOf(0L, 10L, 20L), sentAt())
        assertEquals("Utah", session.state.value.guesses.first().answer)
        assertEquals(AiStatus.WATCHING, session.state.value.status)
    }

    @Test fun `a scrolling hint over a still drawing does not keep sending it`() = game {
        screen.hint = "2 words 9 letters|Organ"
        repeat(60) { screen.scroll += 60; play(1_000) }
        println("SESSION marquee: ${ai.calls.size} requests in 60 s")
        assertTrue("sent ${ai.calls.size} in a minute", ai.calls.size <= 3)
    }

    @Test fun `the overlay does not redraw while nothing changes`() = game {
        val states = mutableListOf<OverlayUiState>()
        test.backgroundScope.launch { session.state.collect { states += it } }
        play(3_000) // first answer is on screen
        val settled = states.size
        screen.hint = "2 words 9 letters|Organ" // even with the hint scrolling
        repeat(30) { screen.scroll += 60; play(1_000) }
        val during = states.drop(settled)
        println("SESSION overlay states: $settled to show the first answer, ${during.size} in the next 30 s")
        // Only the one re-read of the hint when it started moving; nothing while it scrolls.
        assertTrue("overlay changed ${during.size} times: ${during.map { it.status to it.message }}", during.size <= 4)
        val last10s = states.size
        repeat(10) { screen.scroll += 60; play(1_000) }
        assertEquals(last10s, states.size)
    }

    @Test fun `never more than two requests in flight while the drawing grows`() = game {
        ai.latency = 3_500
        repeat(20) { screen.strokes++; play(1_000) }
        assertEquals(2, ai.maxRunning)
    }

    @Test fun `the drawing saved for a learned answer is the canvas, never the whole screen`() = game {
        play(3_000) // first look is the whole screen; the model answers "Utah"
        screen.popup = "Word: utah"
        play(3_000)
        val record = db.drawingDao().observeAll().first().single()
        assertEquals("utah", record.correctAnswer.lowercase())
        val path = record.imagePath
        assertNotNull("no drawing saved", path)
        val size = BitmapFactory.Options().apply { inJustDecodeBounds = true }.also { BitmapFactory.decodeFile(path!!, it) }
        val ratio = size.outHeight.toFloat() / size.outWidth
        val canvasRatio = (screen.layout.canvas[3] - screen.layout.canvas[1]) * screen.h / screen.w
        assertEquals("saved ${size.outWidth}x${size.outHeight}", canvasRatio, ratio, 0.05f)
    }

    @Test fun `a failed request shows the error and the next beat recovers`() = game {
        ai.failNext = VisionException.Network()
        play(1_500)
        assertEquals(AiStatus.ERROR, session.state.value.status)
        assertEquals("Network error", session.state.value.message)
        play(5_000)
        assertEquals("Utah", session.state.value.guesses.first().answer)
        assertTrue(session.state.value.status != AiStatus.ERROR)
    }

    @Test fun `an invalid key pauses the assistant until it is resumed`() = game {
        ai.failNext = VisionException.InvalidKey()
        play(1_500)
        assertEquals(AiStatus.PAUSED, session.state.value.status)
        assertEquals("Invalid API key — check Settings", session.state.value.problem)
        play(30_000)
        assertEquals(1, ai.calls.size)
        session.togglePause()
        assertEquals(null, session.state.value.problem)
        play(2_000)
        assertEquals(2, ai.calls.size)
        assertEquals("Utah", session.state.value.guesses.first().answer)
    }

    @Test fun `a new key from Settings retries on its own once typing stops`() = game {
        ai.failNext = VisionException.InvalidKey()
        play(1_500)
        assertEquals(AiStatus.PAUSED, session.state.value.status)
        var typed = ""
        "sk-ant-new".forEach { ch -> typed += ch; settings.update { it.copy(apiKey = typed) }; play(200) }
        assertEquals("no request with a half-typed key", 1, ai.calls.size)
        play(2_500)
        assertEquals(2, ai.calls.size)
        assertEquals(null, session.state.value.problem)
        assertEquals("Utah", session.state.value.guesses.first().answer)
    }

    @Test fun `other settings changes do not resume a paused assistant`() = game {
        ai.failNext = VisionException.InvalidKey()
        play(1_500)
        settings.update { it.copy(fastMode = !it.fastMode) }
        play(5_000)
        assertEquals(1, ai.calls.size)
        assertEquals(AiStatus.PAUSED, session.state.value.status)
    }

    @Test fun `next guess drops the top answer and tells the model it was wrong`() = game {
        play(2_000)
        assertEquals("Ohio", session.nextGuess())
        screen.strokes = 2
        play(2_000)
        assertEquals(listOf("Utah"), ai.calls.last().hints.rejected)
        assertTrue(session.state.value.guesses.none { it.answer == "Utah" })
    }
}

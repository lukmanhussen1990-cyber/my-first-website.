package com.weplay.guesserai.overlay

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.longClick
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.onRoot
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performTouchInput
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.github.takahirom.roborazzi.captureRoboImage
import com.weplay.guesserai.domain.HintPattern
import com.weplay.guesserai.domain.OverlaySize
import com.weplay.guesserai.domain.RankedGuess
import com.weplay.guesserai.service.AiStatus
import com.weplay.guesserai.service.OverlayUiState
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode

/** The floating window's three sizes, as a user and a screen reader meet them. */
@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = [34], qualifiers = "w393dp-h852dp-xxhdpi")
class OverlayContentTest {
    @get:Rule val compose = createComposeRule()

    private val calls = mutableListOf<String>()
    private val actions = object : OverlayActions {
        override fun onMinimize() { calls += "minimize" }
        override fun onExpand() { calls += "expand" }
        override fun onClose() { calls += "close" }
        override fun onNextGuess() { calls += "next" }
        override fun onRefresh() { calls += "refresh" }
        override fun onTogglePause() { calls += "pause" }
        override fun onCopy(guess: RankedGuess) { calls += "copy ${guess.answer}" }
        override fun onMarkCorrect(guess: RankedGuess) { calls += "correct ${guess.answer}" }
        override fun onAdjustHint(dWords: Int, dLetters: Int) { calls += "hint $dWords $dLetters" }
        override fun onAutoHint() { calls += "auto" }
    }

    private val live = OverlayUiState(
        status = AiStatus.WATCHING,
        message = "Live • Haiku 1.2s",
        guesses = listOf(
            RankedGuess("Heart Beat", 82, "", matchesHint = true, learned = false),
            RankedGuess("Heartbeat", 44, "", matchesHint = false, learned = false),
            RankedGuess("Pulse Rate", 30, "", matchesHint = true, learned = true),
            RankedGuess("Love", 12, "", matchesHint = false, learned = false),
        ),
        hint = HintPattern(2, 9, clue = "Organ"),
        detectedObject = "Heart with a pulse line", category = "Body", emoji = "❤",
    )

    private fun show(state: OverlayUiState, size: OverlaySize, width: Dp) = compose.setContent {
        // The game shows through the window; a dark backdrop stands in for it.
        Box(Modifier.background(Color(0xFF2B6E2B))) { OverlayRoot(state, size, width, actions) }
    }

    private fun snapshot(name: String) = compose.onRoot().captureRoboImage("build/outputs/roborazzi/$name.png")

    @Test fun `mini bar buttons are named for screen readers and work`() {
        show(live, OverlaySize.MINI, 377.dp)
        snapshot("overlay_mini")
        compose.onNodeWithContentDescription("Next answer").performClick()
        compose.onNodeWithContentDescription("Open the panel").performClick()
        assertEquals(listOf("next", "expand"), calls)
    }

    @Test fun `chips copy on tap and mark correct on hold`() {
        show(live, OverlaySize.MINI, 377.dp)
        compose.onNodeWithText("Heart Beat", substring = true).performClick()
        compose.onNodeWithText("Heart Beat", substring = true).performTouchInput { longClick() }
        assertEquals(listOf("copy Heart Beat", "correct Heart Beat"), calls)
    }

    @Test fun `mini bar says why the AI stopped`() {
        val bad = "Invalid API key — check Settings"
        show(live.copy(status = AiStatus.PAUSED, message = bad, problem = bad), OverlaySize.MINI, 377.dp)
        snapshot("overlay_mini_problem")
        compose.onNodeWithText("⚠ $bad").performClick()
        assertEquals(listOf("pause"), calls) // tapping it tries again
        compose.onNodeWithText("Heart Beat", substring = true).assertDoesNotExist()
    }

    @Test fun `paused by hand, the mini bar keeps the answers to copy`() {
        show(live.copy(status = AiStatus.PAUSED, message = "AI paused"), OverlaySize.MINI, 377.dp)
        compose.onNodeWithText("Heart Beat", substring = true).assertExists()
        compose.onNodeWithContentDescription("AI Paused").assertExists()
    }

    @Test fun `compact panel buttons are named`() {
        show(live, OverlaySize.COMPACT, 150.dp)
        snapshot("overlay_compact")
        listOf("Minimize", "Close", "Refresh", "Pause AI").forEach { compose.onNodeWithContentDescription(it).assertExists() }
        compose.onNodeWithContentDescription("Refresh").performClick()
        assertEquals(listOf("refresh"), calls)
    }

    @Test fun `large panel`() {
        show(live.copy(answer = "Heart Beat"), OverlaySize.LARGE, 220.dp)
        snapshot("overlay_large")
        compose.onNodeWithContentDescription("Minimize").assertExists()
        compose.onNodeWithText("Heart Beat ✓", substring = true).assertDoesNotExist()
    }
}

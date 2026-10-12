package com.weplay.guesserai.overlay

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.SemanticsActions
import androidx.compose.ui.test.SemanticsNodeInteraction
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.onRoot
import androidx.compose.ui.text.TextLayoutResult
import androidx.compose.ui.unit.dp
import com.github.takahirom.roborazzi.captureRoboImage
import com.weplay.guesserai.domain.HintPattern
import com.weplay.guesserai.domain.OverlaySize
import com.weplay.guesserai.domain.RankedGuess
import com.weplay.guesserai.service.AiStatus
import com.weplay.guesserai.service.OverlayUiState
import org.junit.Assert.assertFalse
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode

/** With a large system font the fixed-size window must still show whole answers, not "He…". */
@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = [34], qualifiers = "w393dp-h852dp-xxhdpi", fontScale = 2.0f)
class OverlayFontScaleTest {
    @get:Rule val compose = createComposeRule()

    private val actions = object : OverlayActions {
        override fun onMinimize() {}
        override fun onExpand() {}
        override fun onClose() {}
        override fun onNextGuess() {}
        override fun onRefresh() {}
        override fun onTogglePause() {}
        override fun onCopy(guess: RankedGuess) {}
        override fun onMarkCorrect(guess: RankedGuess) {}
        override fun onAdjustHint(dWords: Int, dLetters: Int) {}
        override fun onAutoHint() {}
    }

    private val live = OverlayUiState(
        status = AiStatus.WATCHING, message = "Live • Haiku 1.2s",
        guesses = listOf(
            RankedGuess("Heart Beat", 82, "", matchesHint = true, learned = false),
            RankedGuess("Heartbeat", 44, "", matchesHint = false, learned = false),
            RankedGuess("Pulse Rate", 30, "", matchesHint = true, learned = true),
        ),
        hint = HintPattern(2, 9, clue = "Organ"),
    )

    /** Text that does not fully show: ellipsized ("He…"), or a word pushed off its single line ("➤" without "Next"). */
    private fun SemanticsNodeInteraction.cutOff(): Boolean {
        val layouts = mutableListOf<TextLayoutResult>()
        fetchSemanticsNode().config[SemanticsActions.GetTextLayoutResult].action?.invoke(layouts)
        val l = layouts.first()
        return l.isLineEllipsized(0) || l.getLineEnd(0, visibleEnd = true) < l.layoutInput.text.length ||
            l.multiParagraph.intrinsics.maxIntrinsicWidth - l.size.width > 2f
    }

    private fun show(size: OverlaySize, width: Int, name: String) {
        compose.setContent { Box(Modifier.background(Color(0xFF2B6E2B))) { OverlayRoot(live, size, width.dp, actions) } }
        compose.onRoot().captureRoboImage("build/outputs/roborazzi/overlay_${name}_font200.png")
    }

    @Test fun `mini bar shows whole answers at 200 percent font`() {
        show(OverlaySize.MINI, 377, "mini")
        assertFalse(compose.onNodeWithText("Heart Beat").cutOff())
        assertFalse(compose.onNodeWithText("Pulse Rate").cutOff())
    }

    @Test fun `narrowest large panel keeps every button label whole at 200 percent font`() {
        show(OverlaySize.LARGE, 140, "large")
        for (label in listOf("➤ Next Guess", "↻ Refresh", "❚❚ Pause AI")) assertFalse(label, compose.onNodeWithText(label).cutOff())
        assertFalse(compose.onNodeWithText("Heart Beat").cutOff())
    }

    @Test fun `narrowest compact panel shows whole answers and the Next label at 200 percent font`() {
        show(OverlaySize.COMPACT, 112, "compact")
        assertFalse(compose.onNodeWithText("Heart Beat").cutOff())
        assertFalse(compose.onNodeWithText("➤ Next").cutOff())
    }
}

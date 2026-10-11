package com.weplay.guesserai

import com.weplay.guesserai.domain.FrameAnalysis
import com.weplay.guesserai.domain.Guess
import com.weplay.guesserai.domain.HintPattern
import com.weplay.guesserai.domain.PartialAnalysis
import com.weplay.guesserai.domain.RoundBoard
import com.weplay.guesserai.domain.RoundTracker
import com.weplay.guesserai.domain.ScreenState
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/** Scenarios taken from real game screenshots. */
class RoundTrackerTest {
    private val ctx = RoundTracker.Context()
    private var seq = 0L

    private fun frame(
        hint: HintPattern?,
        vararg guesses: Pair<String, Int>,
        state: ScreenState = ScreenState.GUESSING,
        revealed: String = "",
        canvasEmpty: Boolean = false,
    ) = FrameAnalysis(
        isDrawingGame = state != ScreenState.NOT_GAME,
        canvasEmpty = canvasEmpty,
        detectedObject = "", category = "", emoji = "",
        hint = hint, canvasBox = null,
        guesses = guesses.map { Guess(it.first, it.second) },
        screenState = state, revealedAnswer = revealed,
    )

    private fun RoundTracker.feed(f: FrameAnalysis) = final(++seq, f, ctx)
    private fun RoundTracker.Outcome.top() = view.guesses.first().answer
    private fun RoundTracker.Outcome.answers() = view.guesses.map { it.answer }

    private val fourState = HintPattern(1, 4, clue = "A state")
    private val fourAnimal = HintPattern(1, 4, clue = "An animal")
    private val fiveFood = HintPattern(1, 5, clue = "A food")

    @Test fun `guesses from the previous word do not leak into the next word of the same length`() {
        val t = RoundTracker()
        t.feed(frame(fourAnimal, "Crab" to 95, "Lamp" to 90))
        // The round-over popup for that word…
        val over = t.feed(frame(fourAnimal, state = ScreenState.ROUND_OVER, revealed = "crab"))
        assertTrue(over.roundOver)
        assertEquals("Crab", over.learn)
        // …then the next 4-letter word ("fear"): only its own guesses.
        val next = t.feed(frame(fourState, "Fear" to 70, "Frog" to 30))
        assertEquals("Fear", next.top())
        assertFalse("Crab" in next.answers())
        assertFalse("Lamp" in next.answers())
        assertNull(next.view.answer)
    }

    @Test fun `a good guess survives a bad frame`() {
        val t = RoundTracker()
        t.feed(frame(fiveFood, "Halwa" to 90, "Kheer" to 40))
        val bad = t.feed(frame(fiveFood, "Tiger" to 47, "Snail" to 41))
        assertEquals("Halwa", bad.top())
        assertTrue(bad.view.guesses.first().confidence > 47)
    }

    @Test fun `a guess the model keeps missing fades away`() {
        val t = RoundTracker()
        t.feed(frame(fiveFood, "Pizza" to 60))
        var last = t.feed(frame(fiveFood, "Halwa" to 80))
        assertTrue(last.view.guesses.first { it.answer == "Pizza" }.confidence < 50)
        repeat(11) { last = t.feed(frame(fiveFood, "Halwa" to 80)) }
        assertEquals("Halwa", last.top())
        assertFalse("Pizza" in last.answers())
    }

    @Test fun `word shown in the top bar becomes the answer and is saved once`() {
        val t = RoundTracker()
        t.feed(frame(fiveFood, "Halwa" to 90))
        val first = t.feed(frame(HintPattern(1, 5), state = ScreenState.WORD_REVEALED, revealed = "halwa"))
        assertEquals("Halwa", first.learn)
        assertEquals("Halwa", first.view.answer)
        assertTrue(t.solved)
        val again = t.feed(frame(HintPattern(1, 5), state = ScreenState.WORD_REVEALED, revealed = "halwa"))
        assertNull(again.learn)
        // The popup at the end of the same round is not saved a second time either.
        val over = t.feed(frame(null, state = ScreenState.ROUND_OVER, revealed = "Halwa"))
        assertNull(over.learn)
        assertEquals("Halwa", over.view.answer)
    }

    @Test fun `a misread reveal that does not fit the hint is ignored`() {
        val t = RoundTracker()
        t.feed(frame(fourState, "Fear" to 70))
        val o = t.feed(frame(fourState, "Fear" to 75, state = ScreenState.WORD_REVEALED, revealed = "A state"))
        assertNull(o.learn)
        assertNull(o.view.answer)
        assertFalse(t.solved)
        assertEquals("Fear", o.top())
    }

    @Test fun `hint text is never accepted as an answer`() {
        val t = RoundTracker()
        val o = t.feed(frame(null, state = ScreenState.ROUND_OVER, revealed = "4 letters|A state"))
        assertNull(o.learn)
        assertFalse(o.roundOver)
    }

    @Test fun `round over without an answer changes nothing`() {
        val t = RoundTracker()
        t.feed(frame(fiveFood, "Halwa" to 90))
        val o = t.feed(frame(fiveFood, state = ScreenState.ROUND_OVER))
        assertFalse(o.roundOver)
        assertEquals("Halwa", o.top())
    }

    @Test fun `next word after the popup is taken at once, not after two votes`() {
        val t = RoundTracker()
        t.feed(frame(fourState, "Fear" to 70))
        t.feed(frame(fourState, state = ScreenState.ROUND_OVER, revealed = "fear"))
        val next = t.feed(frame(fiveFood, "Halwa" to 60))
        assertEquals(fiveFood, next.view.hint)
        assertEquals("Halwa", next.top())
    }

    @Test fun `one misread hint does not reset the word, two in a row do`() {
        val t = RoundTracker()
        t.feed(frame(fourState, "Fear" to 70))
        val misread = t.feed(frame(HintPattern(3, 11), "Fear" to 72))
        assertEquals(fourState, misread.view.hint)
        assertEquals("Fear", misread.top())
        t.feed(frame(fiveFood, "Halwa" to 50))
        assertEquals(fourState, t.hint)
        val switched = t.feed(frame(fiveFood, "Halwa" to 60))
        assertEquals(fiveFood, switched.view.hint)
        assertFalse("Fear" in switched.answers())
    }

    @Test fun `a new clue with the same length is a new word after two readings`() {
        val t = RoundTracker()
        t.feed(frame(fourState, "Fear" to 70))
        t.feed(frame(fourAnimal, "Crab" to 60))
        val o = t.feed(frame(fourAnimal, "Crab" to 65))
        assertEquals(fourAnimal, o.view.hint)
        assertFalse("Fear" in o.answers())
    }

    @Test fun `a reading without the clue refines but does not reset`() {
        val t = RoundTracker()
        t.feed(frame(HintPattern(1, 4), "Fear" to 70))
        val o = t.feed(frame(fourState, "Fear" to 70))
        assertEquals("A state", o.view.hint!!.clue)
        assertEquals("Fear", o.top())
    }

    @Test fun `after we solved it only a different clued hint starts the next word`() {
        val t = RoundTracker()
        t.feed(frame(fiveFood, "Halwa" to 90))
        t.feed(frame(HintPattern(1, 5), state = ScreenState.WORD_REVEALED, revealed = "halwa"))
        // The model sometimes calls the revealed bar "guessing" and reads "halwa" as 1 word, 5 letters.
        t.feed(frame(HintPattern(1, 5), "Halwa" to 90))
        t.feed(frame(HintPattern(1, 5), "Halwa" to 90))
        assertTrue(t.solved)
        // Same word's own hint (still "5 letters|A food") does not end it either.
        t.feed(frame(fiveFood, "Halwa" to 90))
        assertTrue(t.solved)
        val next = t.feed(frame(fourState, "Fear" to 50))
        assertFalse(t.solved)
        assertNull(next.view.answer)
        assertEquals("Fear", next.top())
    }

    @Test fun `long-pressed answer is saved once and does not reset the round`() {
        val t = RoundTracker()
        t.feed(frame(fiveFood, "Halwa" to 90, "Kheer" to 50))
        val marked = t.markCorrect("Halwa", ctx)
        assertEquals("Halwa", marked.learn)
        assertTrue(t.solved)
        assertEquals(fiveFood, t.hint)
        // The game then shows the word: not saved again.
        assertNull(t.feed(frame(HintPattern(1, 5), state = ScreenState.WORD_REVEALED, revealed = "halwa")).learn)
        // A fresh frame of the same word does not start a new round.
        t.feed(frame(fiveFood, "Halwa" to 90))
        assertTrue(t.solved)
    }

    @Test fun `next guess rejects the top answer for this word only`() {
        val t = RoundTracker()
        t.feed(frame(fourState, "Frog" to 80, "Fear" to 70))
        val r = t.next(ctx)!!
        assertEquals("Frog", r.rejected)
        assertEquals("Fear", r.view.guesses.first().answer)
        assertFalse("Frog" in t.feed(frame(fourState, "Frog" to 85, "Fear" to 70)).answers())
        t.feed(frame(fourState, state = ScreenState.ROUND_OVER, revealed = "fear"))
        assertTrue("Frog" in t.feed(frame(fourAnimal, "Frog" to 80)).answers())
    }

    @Test fun `manual hint locks until the next word`() {
        val t = RoundTracker()
        t.feed(frame(HintPattern(3, 11), "Slowest Snail" to 90, "Snails" to 50))
        val v = t.adjustHint(-2, -5, ctx)
        assertEquals(HintPattern(1, 6), v.hint)
        assertTrue(v.hintManual)
        assertEquals("Snails", v.guesses.first().answer)
        // The model keeps misreading: the hand-set hint stays.
        assertEquals(HintPattern(1, 6), t.feed(frame(HintPattern(3, 11), "Snails" to 60)).view.hint)
        t.feed(frame(HintPattern(1, 6), state = ScreenState.ROUND_OVER, revealed = "snails"))
        val next = t.feed(frame(fourState, "Fear" to 60))
        assertFalse(next.view.hintManual)
        assertEquals(fourState, next.view.hint)
    }

    @Test fun `partial results from the popup or empty canvas are ignored`() {
        val t = RoundTracker()
        assertNull(t.partial(1, PartialAnalysis(null, listOf(Guess("Fear", 90)), true, false, ScreenState.ROUND_OVER), ctx))
        assertNull(t.partial(2, PartialAnalysis(fourState, emptyList(), true, false, ScreenState.GUESSING), ctx))
        val v = t.partial(3, PartialAnalysis(fourState, listOf(Guess("Fear", 90)), true, false, ScreenState.GUESSING), ctx)
        assertEquals("Fear", v!!.guesses.first().answer)
    }

    @Test fun `partial keeps the board visible while the new answer streams in`() {
        val t = RoundTracker()
        t.feed(frame(fiveFood, "Halwa" to 90, "Kheer" to 60))
        val v = t.partial(++seq, PartialAnalysis(fiveFood, listOf(Guess("Kheer", 70)), true, false, ScreenState.GUESSING), ctx)!!
        assertEquals(listOf("Halwa", "Kheer"), v.guesses.map { it.answer }.take(2))
    }

    @Test fun `round board blends and fades`() {
        val b = RoundBoard()
        b.commit(listOf(Guess("Halwa", 90)))
        assertEquals(72, b.commit(listOf(Guess("Tiger", 47))).first { it.answer == "Halwa" }.confidence)
        assertEquals(87, b.commit(listOf(Guess("Halwa", 100))).first().confidence) // 0.55*100 + 0.45*72
        repeat(20) { b.commit(emptyList()) }
        assertTrue(b.isEmpty)
    }
}

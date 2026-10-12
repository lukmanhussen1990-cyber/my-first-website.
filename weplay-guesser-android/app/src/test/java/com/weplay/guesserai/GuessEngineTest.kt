package com.weplay.guesserai

import com.weplay.guesserai.domain.AnswerStats
import com.weplay.guesserai.domain.FrameChangeDetector
import com.weplay.guesserai.domain.Guess
import com.weplay.guesserai.domain.GuessEngine
import com.weplay.guesserai.domain.HintPattern
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class GuessEngineTest {
    private val engine = GuessEngine()

    @Test fun `answers that fit the hint come first, the others are still shown after them`() {
        val guesses = listOf(
            Guess("Red Car", 90), Guess("Fire Truck", 80), Guess("Blue Whale", 85), Guess("Cat House", 88), Guess("Ambulance", 70),
        )
        val r = engine.rank(guesses, HintPattern(2, 9), emptySet(), emptyMap())
        assertEquals(listOf("Blue Whale", "Fire Truck", "Red Car", "Cat House", "Ambulance"), r.guesses.map { it.answer })
        assertEquals(listOf(true, true, false, false, false), r.guesses.map { it.matchesHint })
        assertFalse(r.hintMismatch)
    }

    @Test fun `nothing the AI said is replaced, reshaped or invented`() {
        // Screenshot: "2 words 9 letters|Organ", heart with a pulse line. The AI's answers are shown as given.
        val r = engine.rank(listOf(Guess("Heartbeat", 80), Guess("Heart", 60)), HintPattern(2, 9, clue = "Organ"), emptySet(), emptyMap())
        assertEquals(listOf("Heartbeat", "Heart"), r.guesses.map { it.answer })
        assertEquals(listOf(80, 60), r.guesses.map { it.confidence })
        assertTrue(r.hintMismatch)
    }

    @Test fun `per-word lengths are enforced when known`() {
        val r = engine.rank(listOf(Guess("Fire Truck", 90), Guess("Black Cat", 95)), HintPattern(2, 9, listOf(4, 5)), emptySet(), emptyMap())
        assertEquals(listOf("Fire Truck", "Black Cat"), r.guesses.map { it.answer })
        assertEquals(listOf(true, false), r.guesses.map { it.matchesHint })
    }

    @Test fun `rejected answers are removed and duplicates merged`() {
        val r = engine.rank(
            listOf(Guess("fire truck", 70), Guess("Fire Truck!", 95), Guess("Fire Engine", 80)),
            null, setOf("fire engine"), emptyMap(),
        )
        assertEquals(listOf("Fire Truck"), r.guesses.map { it.answer })
        assertEquals(95, r.guesses.single().confidence)
    }

    @Test fun `confidence is exactly the AI's, history only marks confirmed answers`() {
        val r = engine.rank(listOf(Guess("Black Cat", 84), Guess("Cat House", 80)), null, emptySet(), mapOf("cat house" to AnswerStats(2, 0)))
        assertEquals(listOf("Black Cat" to 84, "Cat House" to 80), r.guesses.map { it.answer to it.confidence })
        assertTrue(r.guesses[1].learned)
        assertFalse(r.guesses[0].learned)
    }

    @Test fun `no hint means no filtering`() {
        val r = engine.rank(listOf(Guess("Sun", 50), Guess("Moon", 70)), null, emptySet(), emptyMap())
        assertEquals(listOf("Moon", "Sun"), r.guesses.map { it.answer })
        assertTrue(r.guesses.all { it.matchesHint })
    }

    @Test fun `hyphenated answers count letters only`() {
        assertTrue(GuessEngine.matches("T-Rex", HintPattern(2, 4)))
        assertEquals(listOf(4, 5), GuessEngine.wordLengths("Fire Truck"))
    }

    @Test fun `hint label`() {
        assertEquals("2 words • 12 letters", HintPattern(2, 12).label())
        assertEquals("_ _ _   _ _", HintPattern(2, 5, listOf(3, 2)).blanks())
    }

    @Test fun `frame change detector ignores tiny noise`() {
        val d = FrameChangeDetector()
        val a = IntArray(1600) { 230 }
        assertTrue(d.hasChanged(a)); d.accept(a)
        assertFalse(d.hasChanged(IntArray(1600) { if (it == 3) 240 else 230 }))
        assertTrue(d.hasChanged(IntArray(1600) { if (it < 100) 20 else 230 }))
    }

    @Test fun `a thin new stroke on the canvas counts as a change`() {
        val d = FrameChangeDetector()
        val white = IntArray(1600) { 240 }
        d.accept(white)
        // Three cells darkened by a stroke: the whole-image average moves only ~0.3.
        assertTrue(d.hasChanged(IntArray(1600) { if (it in 500..502) 150 else 240 }))
    }

    @Test fun `keeps the window off the drawing`() {
        val p = com.weplay.guesserai.domain.OverlayPlacement
        // Canvas 241..1174 px on a 2408 px screen; a 500 px window dropped on it moves just below.
        assertEquals(1174 + 20, p.yOutside(600, 500, 241, 1174, 2408, 20))
        // Barely touching the canvas edge: left alone.
        assertEquals(1150, p.yOutside(1150, 500, 241, 1174, 2408, 20))
        // No room below: goes above if possible, else stays.
        assertEquals(241 - 100 - 20, p.yOutside(300, 100, 241, 2300, 2408, 20))
        assertEquals(300, p.yOutside(300, 500, 100, 2300, 2408, 20))
    }
}

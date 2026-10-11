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

    @Test fun `keeps only answers matching 2 words and 9 letters, highest first`() {
        val guesses = listOf(
            Guess("Red Car", 90), Guess("Fire Truck", 80), Guess("Blue Whale", 85), Guess("Cat House", 88), Guess("Ambulance", 70),
        )
        val r = engine.rank(guesses, HintPattern(2, 9), emptySet(), emptyMap())
        assertEquals(listOf("Blue Whale", "Fire Truck"), r.guesses.map { it.answer })
        assertFalse(r.hintMismatch)
    }

    @Test fun `spec example - 2 words 12 letters`() {
        val guesses = listOf(Guess("Fire Truck", 95), Guess("Cat House", 80), Guess("Red Car", 60), Guess("Garbage Truck", 70), Guess("Monster Truck", 75))
        val r = engine.rank(guesses, HintPattern(2, 12), emptySet(), emptyMap())
        assertEquals(listOf("Monster Truck", "Garbage Truck"), r.guesses.map { it.answer })
    }

    @Test fun `per-word lengths are enforced when known`() {
        val r = engine.rank(listOf(Guess("Fire Truck", 90), Guess("Black Cat", 95)), HintPattern(2, 9, listOf(4, 5)), emptySet(), emptyMap())
        assertEquals(listOf("Fire Truck"), r.guesses.map { it.answer })
    }

    @Test fun `falls back to all answers when none match the hint`() {
        val r = engine.rank(listOf(Guess("Dog", 80), Guess("Puppy", 60)), HintPattern(2, 12), emptySet(), emptyMap())
        assertEquals(2, r.guesses.size)
        assertTrue(r.hintMismatch)
    }

    @Test fun `rejected answers are removed and duplicates merged`() {
        val r = engine.rank(
            listOf(Guess("fire truck", 70), Guess("Fire Truck!", 95), Guess("Fire Engine", 80)),
            null, setOf("fire engine"), emptyMap(),
        )
        assertEquals(listOf("Fire Truck"), r.guesses.map { it.answer })
        assertEquals(95, r.guesses.single().confidence)
    }

    @Test fun `learning history boosts confirmed answers above close rivals`() {
        val guesses = listOf(Guess("Black Cat", 84), Guess("Cat House", 80))
        val r = engine.rank(guesses, null, emptySet(), mapOf("cat house" to AnswerStats(correct = 2, rejected = 0)))
        assertEquals("Cat House", r.guesses.first().answer)
        assertTrue(r.guesses.first().learned)
    }

    @Test fun `answers rejected often are pushed down`() {
        assertTrue(GuessEngine.learningBoost(AnswerStats(0, 5)) < 0)
        assertEquals(0, GuessEngine.learningBoost(null))
    }

    @Test fun `confidence is smoothed across frames`() {
        val r = engine.rank(listOf(Guess("Cat", 40)), null, emptySet(), emptyMap(), previous = mapOf("cat" to 90))
        assertEquals(60, r.guesses.single().confidence)
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
        val a = IntArray(576) { 100 }
        assertTrue(d.hasChanged(a)); d.accept(a)
        assertFalse(d.hasChanged(IntArray(576) { if (it == 3) 110 else 100 }))
        assertTrue(d.hasChanged(IntArray(576) { if (it < 100) 20 else 100 }))
    }
}

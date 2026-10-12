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
        // "Cat House" (8 letters) is reshaped to "Cat Houses" (9) but ranks below the exact matches.
        assertEquals(listOf("Blue Whale", "Fire Truck", "Cat Houses"), r.guesses.map { it.answer })
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

    @Test fun `singular answer is turned plural to fit the hint`() {
        val r = engine.rank(listOf(Guess("Snail", 90), Guess("Slow Snail", 60)), HintPattern(1, 6), emptySet(), emptyMap())
        assertEquals("Snails", r.guesses.first().answer)
        assertFalse(r.hintMismatch)
    }

    @Test fun `a 1-letter first word becomes A`() {
        val r = engine.rank(listOf(Guess("Bike", 88), Guess("Bicycle", 70)), HintPattern(2, 5), emptySet(), emptyMap())
        assertEquals("A Bike", r.guesses.first().answer)
    }

    @Test fun `variants cover plural, article and joined forms`() {
        val v = GuessEngine.variantsOf("Fire Fly")
        assertTrue("Firefly" in v)
        assertTrue("Fire Flies" in v)
        assertTrue("A Fire Fly" in v)
        assertTrue("Box" in GuessEngine.variantsOf("Boxes"))
        assertTrue("Cherry" in GuessEngine.variantsOf("Cherries"))
        assertTrue("Apple" in GuessEngine.variantsOf("An Apple"))
        assertTrue("An Egg" in GuessEngine.variantsOf("Egg"))
    }

    @Test fun `a real AI match is not replaced by a variant`() {
        val r = engine.rank(listOf(Guess("Snails", 50), Guess("Snail", 90)), HintPattern(1, 6), emptySet(), emptyMap())
        assertEquals(listOf("Snails"), r.guesses.map { it.answer })
        assertEquals(80, r.guesses.single().confidence) // the stronger "Snail" reading, minus the reshape penalty
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

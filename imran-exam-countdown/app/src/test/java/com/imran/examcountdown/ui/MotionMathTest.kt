package com.imran.examcountdown.ui

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * The spring maths every animation is built on. A plain JVM test: it avoids [Ease], whose
 * interpolators need Android's native graphics.
 */
class MotionMathTest {

    private fun peak(damping: Float): Float = (0..1000).maxOf { spring(it / 1000f, damping) }

    @Test
    fun springStartsAtZeroAndLandsExactlyOnOne() {
        for (d in listOf(0.4f, 0.55f, 0.7f, 0.78f, 1f)) {
            assertEquals(0f, spring(0f, d), 0f)
            assertEquals(1f, spring(1f, d), 0f)
            // Out of range input is clamped, never extrapolated.
            assertEquals(0f, spring(-0.5f, d), 0f)
            assertEquals(1f, spring(1.5f, d), 0f)
        }
    }

    @Test
    fun overshootFollowsTheDamping() {
        assertTrue("0.4 is lively (~25 %): ${peak(0.4f)}", peak(0.4f) in 1.2f..1.3f)
        assertTrue("0.55 pops (~12 %): ${peak(0.55f)}", peak(0.55f) in 1.08f..1.16f)
        assertTrue("0.78 barely overshoots: ${peak(0.78f)}", peak(0.78f) in 1f..1.03f)
        assertTrue("1 never overshoots: ${peak(1f)}", peak(1f) <= 1f)
    }

    @Test
    fun theMotionHasDiedDownBeforeTheEnd() {
        // No visible jump when an animation snaps to exactly 1 at its last frame.
        for (d in listOf(0.4f, 0.55f, 0.7f, 1f)) {
            assertEquals("damping $d", 1f, spring(0.97f, d), 0.01f)
        }
    }

    @Test
    fun windowAndLerp() {
        assertEquals(0f, window(50f, 100f, 200f), 0f)
        assertEquals(0.5f, window(200f, 100f, 200f), 1e-6f)
        assertEquals(1f, window(900f, 100f, 200f), 0f)
        assertEquals(15f, lerp(10f, 20f, 0.5f), 1e-6f)
    }
}

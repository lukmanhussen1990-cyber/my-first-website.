package com.weplay.guesserai

import com.weplay.guesserai.domain.ChangeGate
import org.junit.Assert.assertEquals
import org.junit.Test

class ChangeGateTest {
    private val paper = IntArray(1600) { 240 }

    /** A hint bar row of text: dark glyph cells on a light bar, 24 × 4 cells like the app's grid. */
    private fun hint(seed: Int, shift: Int = 0) = IntArray(96) { i ->
        val col = (i % 24 + shift) % 24
        if ((col * 7 + seed * 13 + i / 24) % 5 < 2) 70 else 200
    }

    private fun strokes(n: Int) = paper.copyOf().also { for (k in 0 until n) for (c in 0..5) it[400 + k * 80 + c] = 60 }

    /** Ticks at which a capture would be sent. */
    private fun sends(frames: List<Pair<IntArray, IntArray>>): List<Int> {
        val gate = ChangeGate()
        return frames.indices.filter { t ->
            val (c, h) = frames[t]
            (gate.observe(c, h) || t == 0).also { if (it) gate.accept(c, h) }
        }
    }

    @Test fun `a still drawing under a scrolling hint is sent once, not on every beat`() {
        val minute = List(60) { t -> paper to hint(1, shift = t) }
        assertEquals(listOf(0, 1), sends(minute))
    }

    @Test fun `a new stroke under a scrolling hint is sent at once`() {
        val frames = List(15) { t -> strokes((if (t >= 6) 1 else 0) + (if (t >= 12) 1 else 0)) to hint(1, shift = t) }
        assertEquals(listOf(0, 1, 6, 12), sends(frames))
    }

    @Test fun `a hint that changes once is sent at once`() {
        val frames = List(10) { t -> paper to hint(if (t < 5) 1 else 2) }
        assertEquals(listOf(0, 5), sends(frames))
    }

    @Test fun `quick hint changes are each sent at once`() {
        val seeds = listOf(1, 1, 2, 2, 3, 3, 1, 1, 1, 1)
        assertEquals(listOf(0, 2, 4, 6), sends(seeds.map { paper to hint(it) }))
    }

    @Test fun `the answer replacing a scrolling hint is sent on the next beat`() {
        val frames = List(15) { t -> paper to (if (t < 10) hint(1, shift = t) else hint(4)) }
        assertEquals(listOf(0, 1, 11), sends(frames))
    }

    @Test fun `a still screen is sent once`() {
        assertEquals(listOf(0), sends(List(20) { paper to hint(1) }))
    }
}

package com.weplay.guesserai

import com.weplay.guesserai.domain.LayoutLearner
import com.weplay.guesserai.domain.ScreenLayout
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class ScreenLayoutTest {
    /** 1080 × 2408 phone from the screenshots. */
    private val aspect = 2408f / 1080f

    @Test fun `default layout matches the measured screenshots`() {
        val l = ScreenLayout.weplayDefault(aspect)!!
        // Canvas starts where the white begins (row 241 of 2408) and ends above the toolbar.
        assertEquals(0.1001f, l.canvas[1], 0.002f)
        assertEquals(0.4875f, l.canvas[3], 0.003f)
        assertEquals(0f, l.canvas[0], 0f); assertEquals(1f, l.canvas[2], 0f)
        // Hint crop covers the top bar text and leaves out the timer on the left.
        assertEquals(0.044f, l.hint[1], 0.002f)
        assertEquals(l.canvas[1], l.hint[3], 0.0001f)
        assertTrue(l.hint[0] > 0.22f)
    }

    @Test fun `no default for landscape`() {
        assertNull(ScreenLayout.weplayDefault(0.5f))
    }

    @Test fun `the round-over popup is not taken as the canvas`() {
        // The model outlined the "Word: fear" popup.
        assertNull(ScreenLayout.fromModel(listOf(0.08f, 0.23f, 0.92f, 0.75f), null, aspect))
    }

    @Test fun `learner keeps the measured layout when the model roughly agrees`() {
        val learner = LayoutLearner(aspect)
        val before = learner.layout
        assertFalse(learner.onFullLook(listOf(0f, 0.11f, 1f, 0.47f), listOf(0.3f, 0.05f, 0.7f, 0.09f)))
        assertEquals(before, learner.layout)
    }

    @Test fun `learner needs two matching looks before moving the crops`() {
        val learner = LayoutLearner(aspect)
        val other = listOf(0f, 0.25f, 1f, 0.6f)
        assertFalse(learner.onFullLook(other, null))
        assertFalse(learner.onFullLook(listOf(0f, 0.11f, 1f, 0.47f), null)) // back to normal: candidate dropped
        assertFalse(learner.onFullLook(other, null))
        assertTrue(learner.onFullLook(listOf(0f, 0.26f, 1f, 0.6f), null))
        assertEquals(0.26f, learner.layout!!.canvas[1], 0.0001f)
    }

    @Test fun `iou`() {
        assertEquals(1f, ScreenLayout.iou(listOf(0f, 0f, 1f, 1f), listOf(0f, 0f, 1f, 1f)), 1e-6f)
        assertEquals(0f, ScreenLayout.iou(listOf(0f, 0f, 0.5f, 0.5f), listOf(0.5f, 0.5f, 1f, 1f)), 1e-6f)
    }
}

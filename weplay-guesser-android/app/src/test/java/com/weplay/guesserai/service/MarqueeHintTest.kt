package com.weplay.guesserai.service

import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import com.weplay.guesserai.domain.ChangeGate
import com.weplay.guesserai.domain.FrameChangeDetector
import com.weplay.guesserai.domain.ScreenLayout
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode

/**
 * Real pixels through the real fingerprint: a WePlay-sized screen whose hint text scrolls like a
 * marquee while nobody draws. Before [ChangeGate] every capture of it went to the model.
 */
@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = [34])
class MarqueeHintTest {
    private val w = 1080
    private val h = 2408
    private val layout = ScreenLayout.weplayDefault(h.toFloat() / w)!!
    private val bitmap = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888)
    private val text = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Color.WHITE; textSize = 52f }
    private val ink = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Color.BLACK; strokeWidth = 10f }

    /** One capture: green bar with [hint] scrolled left by [scroll] px, white canvas with [strokes] lines. */
    private fun frame(hint: String, scroll: Int, strokes: Int): Frame {
        val c = Canvas(bitmap)
        c.drawColor(Color.WHITE)
        val barTop = layout.hint[1] * h
        val barBottom = layout.hint[3] * h
        c.drawRect(0f, 0f, w.toFloat(), barBottom, Paint().apply { color = Color.rgb(120, 194, 98) })
        c.save()
        c.clipRect(0.25f * w, barTop, 0.78f * w, barBottom)
        val loop = text.measureText(hint) + 120f
        val x = 0.25f * w - scroll % loop
        c.drawText(hint, x, barTop + 70f, text)
        c.drawText(hint, x + loop, barTop + 70f, text)
        c.restore()
        for (k in 0 until strokes) c.drawLine(200f, 500f + 90f * k, 800f, 560f + 90f * k, ink)
        return Frame(bitmap, w, h)
    }

    private fun fingerprints(f: Frame) =
        FrameTools.fingerprint(f, layout.canvas, 40, 40) to FrameTools.fingerprint(f, layout.hintCenter, 24, 4)

    @Test fun `scrolling hint over a still drawing`() {
        val speeds = listOf(5, 20, 60, 150) // px per one-second capture
        for (speed in speeds) {
            val old = FrameChangeDetector()
            val gate = ChangeGate()
            var before = 0
            var after = 0
            for (t in 0 until 60) {
                val (c, hfp) = fingerprints(frame("2 words 9 letters|Organ", speed * t, strokes = 1))
                if (t == 0 || old.hasChanged(c + hfp)) { before++; old.accept(c + hfp) }
                if (gate.observe(c, hfp) || t == 0) { after++; gate.accept(c, hfp) }
            }
            println("MARQUEE ${speed}px/s: requests per minute before=$before after=$after")
            assertTrue("old detector fired on the marquee at $speed px/s", before >= 20)
            assertTrue("gate sent $after requests at $speed px/s", after <= 2)
        }
    }

    @Test fun `new strokes and a new hint still go out under a scrolling hint`() {
        val gate = ChangeGate()
        val sent = mutableListOf<Int>()
        for (t in 0 until 16) {
            val strokes = 1 + (if (t >= 6) 1 else 0)
            val hint = if (t < 12) "2 words 9 letters|Organ" else "heart beat"
            val (c, hfp) = fingerprints(frame(hint, if (t < 12) 60 * t else 0, strokes))
            if (gate.observe(c, hfp) || t == 0) { sent += t; gate.accept(c, hfp) }
        }
        // Stroke at 6 at once; the answer that replaces the marquee at 12 is sent once it stands still (13).
        assertEquals(listOf(0, 1, 6, 13), sent)
    }
}

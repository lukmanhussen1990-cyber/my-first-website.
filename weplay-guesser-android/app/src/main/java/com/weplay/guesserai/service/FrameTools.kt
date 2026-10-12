package com.weplay.guesserai.service

import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Rect
import java.io.ByteArrayOutputStream
import kotlin.math.max
import kotlin.math.roundToInt

/** Bitmap helpers for the capture pipeline. Boxes are [left, top, right, bottom] fractions of the frame. */
object FrameTools {
    private val maskPaint = Paint().apply { color = Color.rgb(40, 40, 46) }

    /** Points across the canvas (as fractions of it) sampled to find the paper colour. */
    private val PAPER_SAMPLES = floatArrayOf(0.04f, 0.5f, 0.96f)

    /** Grey levels a fingerprint may span and still count as an empty canvas. */
    private const val BLANK_RANGE = 16

    /**
     * Paints over our own overlay so the model never "reads" it and its animations do not count as
     * changes. Where it covers the [canvas] box, the patch takes the paper's colour instead: a dark
     * block in the middle of the drawing would look like part of it.
     */
    fun maskRect(frame: Bitmap, rect: Rect?, canvas: List<Float>? = null) {
        if (rect == null || rect.isEmpty) return
        val area = canvas?.let { rectOf(frame, it) }
        val paper = area?.let { paperColor(frame, it, skip = rect) }
        val c = Canvas(frame)
        c.drawRect(rect, maskPaint)
        if (area != null && paper != null && area.intersect(rect)) c.drawRect(area, Paint().apply { color = paper })
    }

    /** The canvas background: the brightest of a few points spread over [area], ignoring those under [skip]. */
    private fun paperColor(frame: Bitmap, area: Rect, skip: Rect): Int {
        var best = Color.WHITE
        var bestLuma = -1
        for (fy in PAPER_SAMPLES) for (fx in PAPER_SAMPLES) {
            val x = (area.left + area.width() * fx).roundToInt().coerceIn(0, frame.width - 1)
            val y = (area.top + area.height() * fy).roundToInt().coerceIn(0, frame.height - 1)
            if (skip.contains(x, y)) continue
            val c = frame.getPixel(x, y)
            val l = luma(c)
            if (l > bestLuma) { best = c; bestLuma = l }
        }
        return best
    }

    fun rectOf(frame: Bitmap, box: List<Float>, pad: Float = 0f): Rect {
        val l = ((box[0] - pad) * frame.width).roundToInt().coerceIn(0, frame.width - 2)
        val t = ((box[1] - pad) * frame.height).roundToInt().coerceIn(0, frame.height - 2)
        val r = ((box[2] + pad) * frame.width).roundToInt().coerceIn(l + 1, frame.width)
        val b = ((box[3] + pad) * frame.height).roundToInt().coerceIn(t + 1, frame.height)
        return Rect(l, t, r, b)
    }

    private fun crop(frame: Bitmap, box: List<Float>?, pad: Float = 0f): Bitmap {
        if (box == null) return frame
        val r = rectOf(frame, box, pad)
        return Bitmap.createBitmap(frame, r.left, r.top, r.width(), r.height())
    }

    /** Grayscale grid (cols × rows) of a region, for change detection. */
    fun fingerprint(frame: Bitmap, box: List<Float>? = null, cols: Int = 32, rows: Int = 32): IntArray {
        val region = crop(frame, box)
        val small = Bitmap.createScaledBitmap(region, cols, rows, true)
        val px = IntArray(cols * rows)
        small.getPixels(px, 0, cols, 0, 0, cols, rows)
        if (small !== region) small.recycle()
        if (region !== frame) region.recycle()
        return IntArray(px.size) { i -> luma(px[i]) }
    }

    /** True when a [fingerprint] is one flat tone, like a canvas nobody has drawn on yet. */
    fun looksBlank(fingerprint: IntArray): Boolean =
        fingerprint.isNotEmpty() && fingerprint.max() - fingerprint.min() <= BLANK_RANGE

    /** JPEG of a region (or the whole frame), scaled down so its longest side is at most [maxSide]. */
    fun toJpeg(frame: Bitmap, box: List<Float>? = null, pad: Float = 0f, maxSide: Int = 896, quality: Int = 75): ByteArray {
        val region = crop(frame, box, pad)
        val s = (maxSide.toFloat() / max(region.width, region.height)).coerceAtMost(1f)
        val scaled = if (s < 1f) {
            Bitmap.createScaledBitmap(region, (region.width * s).roundToInt().coerceAtLeast(1), (region.height * s).roundToInt().coerceAtLeast(1), true)
        } else region
        val out = ByteArrayOutputStream()
        scaled.compress(Bitmap.CompressFormat.JPEG, quality, out)
        if (scaled !== region) scaled.recycle()
        if (region !== frame) region.recycle()
        return out.toByteArray()
    }

    /** Thumbnail of the drawing canvas; [box] defaults to the middle of the screen. */
    fun thumbnail(frame: Bitmap, box: List<Float>?, width: Int = 280): Bitmap {
        val crop = crop(frame, box ?: listOf(0.05f, 0.15f, 0.95f, 0.6f))
        val h = (width.toFloat() * crop.height / crop.width).roundToInt().coerceAtLeast(1)
        return Bitmap.createScaledBitmap(crop, width, h, true).also { if (it !== crop && crop !== frame) crop.recycle() }
    }

    /** Perceived brightness 0..255 of a colour. */
    private fun luma(c: Int): Int = (Color.red(c) * 299 + Color.green(c) * 587 + Color.blue(c) * 114) / 1000
}

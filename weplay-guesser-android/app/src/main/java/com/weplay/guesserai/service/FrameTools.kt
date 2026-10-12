package com.weplay.guesserai.service

import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Rect
import java.io.ByteArrayOutputStream
import kotlin.math.max
import kotlin.math.roundToInt

/**
 * One captured screen. [bitmap] is the capturer's reused buffer and may be wider than [width]
 * (row padding from the screen buffer); only the [width] × [height] area is the screen.
 */
class Frame(val bitmap: Bitmap, val width: Int, val height: Int)

/** Where the session gets its screen captures from (the screen mirror; a fake in tests). */
interface FrameSource {
    /** The current screen, in a buffer the next call may overwrite; null before the first frame. */
    fun capture(): Frame?

    /** Capture size divided by real screen size; maps overlay coordinates into the frame. */
    val scale: Float
}

/**
 * Bitmap helpers for the capture pipeline. Boxes are [left, top, right, bottom] fractions of the
 * frame. Work per capture is kept small: change detection samples the screen in place, and only
 * frames that are actually sent are cut out and encoded.
 */
object FrameTools {
    private val maskPaint = Paint().apply { color = Color.rgb(40, 40, 46) }
    private val paperPaint = Paint()

    /** Points across the canvas (as fractions of it) sampled to find the paper colour. */
    private val PAPER_SAMPLES = floatArrayOf(0.04f, 0.5f, 0.96f)

    /** Grey levels a fingerprint may span and still count as an empty canvas. */
    private const val BLANK_RANGE = 16

    /** Every [SAMPLE_STEP]-th pixel in each direction feeds the change-detection grid. */
    private const val SAMPLE_STEP = 2

    /**
     * Paints over our own overlay so the model never "reads" it and its updates do not count as
     * changes. Where it covers the [canvas] box, the patch takes the paper's colour instead: a dark
     * block in the middle of the drawing would look like part of it.
     */
    fun maskRect(frame: Frame, rect: Rect?, canvas: List<Float>? = null) {
        if (rect == null || rect.isEmpty) return
        val area = canvas?.let { rectOf(frame, it) }
        val paper = area?.let { paperColor(frame, it, skip = rect) }
        val c = Canvas(frame.bitmap)
        c.drawRect(rect, maskPaint)
        if (area != null && paper != null && area.intersect(rect)) c.drawRect(area, paperPaint.apply { color = paper })
    }

    /** The canvas background: the brightest of a few points spread over [area], ignoring those under [skip]. */
    private fun paperColor(frame: Frame, area: Rect, skip: Rect): Int {
        var best = Color.WHITE
        var bestLuma = -1
        for (fy in PAPER_SAMPLES) for (fx in PAPER_SAMPLES) {
            val x = (area.left + area.width() * fx).roundToInt().coerceIn(0, frame.width - 1)
            val y = (area.top + area.height() * fy).roundToInt().coerceIn(0, frame.height - 1)
            if (skip.contains(x, y)) continue
            val c = frame.bitmap.getPixel(x, y)
            val l = luma(c)
            if (l > bestLuma) { best = c; bestLuma = l }
        }
        return best
    }

    fun rectOf(frame: Frame, box: List<Float>, pad: Float = 0f): Rect {
        val l = ((box[0] - pad) * frame.width).roundToInt().coerceIn(0, frame.width - 2)
        val t = ((box[1] - pad) * frame.height).roundToInt().coerceIn(0, frame.height - 2)
        val r = ((box[2] + pad) * frame.width).roundToInt().coerceIn(l + 1, frame.width)
        val b = ((box[3] + pad) * frame.height).roundToInt().coerceIn(t + 1, frame.height)
        return Rect(l, t, r, b)
    }

    /** A new bitmap with the [box] area (the whole screen when null); the caller recycles it. */
    private fun crop(frame: Frame, box: List<Float>?, pad: Float = 0f): Bitmap {
        val r = if (box == null) Rect(0, 0, frame.width, frame.height) else rectOf(frame, box, pad)
        return Bitmap.createBitmap(frame.bitmap, r.left, r.top, r.width(), r.height())
    }

    /**
     * Average brightness of each cell of a [cols] × [rows] grid over a region, for change detection.
     * Averages over the cell (rather than sampling one point) so a thin new stroke anywhere in it
     * shows up, and reads the screen in place without copying it.
     */
    fun fingerprint(frame: Frame, box: List<Float>? = null, cols: Int = 32, rows: Int = 32): IntArray {
        val r = if (box == null) Rect(0, 0, frame.width, frame.height) else rectOf(frame, box)
        val w = r.width()
        val h = r.height()
        val sums = LongArray(cols * rows)
        val counts = IntArray(cols * rows)
        val line = IntArray(w)
        var y = 0
        while (y < h) {
            frame.bitmap.getPixels(line, 0, w, r.left, r.top + y, w, 1)
            val rowBase = (y * rows / h).coerceAtMost(rows - 1) * cols
            var x = 0
            while (x < w) {
                val i = rowBase + (x * cols / w).coerceAtMost(cols - 1)
                sums[i] += luma(line[x])
                counts[i]++
                x += SAMPLE_STEP
            }
            y += SAMPLE_STEP
        }
        return IntArray(cols * rows) { i -> if (counts[i] == 0) 255 else (sums[i] / counts[i]).toInt() }
    }

    /** True when a [fingerprint] is one flat tone, like a canvas nobody has drawn on yet. */
    fun looksBlank(fingerprint: IntArray): Boolean =
        fingerprint.isNotEmpty() && fingerprint.max() - fingerprint.min() <= BLANK_RANGE

    /** JPEG of a region (or the whole frame), scaled down so its longest side is at most [maxSide]. */
    fun toJpeg(frame: Frame, box: List<Float>? = null, pad: Float = 0f, maxSide: Int = 896, quality: Int = 75): ByteArray {
        val region = crop(frame, box, pad)
        val s = (maxSide.toFloat() / max(region.width, region.height)).coerceAtMost(1f)
        val scaled = if (s < 1f) {
            Bitmap.createScaledBitmap(region, (region.width * s).roundToInt().coerceAtLeast(1), (region.height * s).roundToInt().coerceAtLeast(1), true)
        } else region
        val out = ByteArrayOutputStream()
        scaled.compress(Bitmap.CompressFormat.JPEG, quality, out)
        if (scaled !== region) scaled.recycle()
        region.recycle()
        return out.toByteArray()
    }

    /** Thumbnail of the drawing canvas; [box] defaults to the middle of the screen. */
    fun thumbnail(frame: Frame, box: List<Float>?, width: Int = 280): Bitmap {
        val crop = crop(frame, box ?: listOf(0.05f, 0.15f, 0.95f, 0.6f))
        val h = (width.toFloat() * crop.height / crop.width).roundToInt().coerceAtLeast(1)
        return Bitmap.createScaledBitmap(crop, width, h, true).also { if (it !== crop) crop.recycle() }
    }

    /** Perceived brightness 0..255 of a colour. */
    private fun luma(c: Int): Int = ((c shr 16 and 0xFF) * 299 + (c shr 8 and 0xFF) * 587 + (c and 0xFF) * 114) / 1000
}

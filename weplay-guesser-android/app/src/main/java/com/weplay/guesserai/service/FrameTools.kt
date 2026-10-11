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

    /** Paints over our own overlay so the model never "reads" it and its animations do not count as changes. */
    fun maskRect(frame: Bitmap, rect: Rect?) {
        if (rect == null || rect.isEmpty) return
        Canvas(frame).drawRect(rect, maskPaint)
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
        return IntArray(px.size) { i ->
            val c = px[i]
            (Color.red(c) * 299 + Color.green(c) * 587 + Color.blue(c) * 114) / 1000
        }
    }

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
}

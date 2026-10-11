package com.weplay.guesserai.service

import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Rect
import java.io.ByteArrayOutputStream
import kotlin.math.max
import kotlin.math.roundToInt

/** Bitmap helpers for the capture pipeline. */
object FrameTools {
    private val maskPaint = Paint().apply { color = Color.rgb(40, 40, 46) }

    /** Paints over our own overlay so the model never "reads" it and its animations do not count as changes. */
    fun maskRect(frame: Bitmap, rect: Rect?) {
        if (rect == null || rect.isEmpty) return
        Canvas(frame).drawRect(rect, maskPaint)
    }

    /** 24×24 grayscale fingerprint for change detection. */
    fun fingerprint(frame: Bitmap): IntArray {
        val small = Bitmap.createScaledBitmap(frame, 24, 24, true)
        val px = IntArray(24 * 24)
        small.getPixels(px, 0, 24, 0, 0, 24, 24)
        if (small !== frame) small.recycle()
        return IntArray(px.size) { i ->
            val c = px[i]
            (Color.red(c) * 299 + Color.green(c) * 587 + Color.blue(c) * 114) / 1000
        }
    }

    fun toJpeg(frame: Bitmap, maxSide: Int = 896, quality: Int = 75): ByteArray {
        val s = (maxSide.toFloat() / max(frame.width, frame.height)).coerceAtMost(1f)
        val scaled = if (s < 1f) Bitmap.createScaledBitmap(frame, (frame.width * s).roundToInt(), (frame.height * s).roundToInt(), true) else frame
        val out = ByteArrayOutputStream()
        scaled.compress(Bitmap.CompressFormat.JPEG, quality, out)
        if (scaled !== frame) scaled.recycle()
        return out.toByteArray()
    }

    /** Thumbnail of the drawing canvas; [box] is [l, t, r, b] in 0..1, defaults to the middle of the screen. */
    fun thumbnail(frame: Bitmap, box: List<Float>?, width: Int = 280): Bitmap {
        val b = box ?: listOf(0.05f, 0.15f, 0.95f, 0.6f)
        val l = (b[0] * frame.width).roundToInt().coerceIn(0, frame.width - 2)
        val t = (b[1] * frame.height).roundToInt().coerceIn(0, frame.height - 2)
        val r = (b[2] * frame.width).roundToInt().coerceIn(l + 1, frame.width)
        val btm = (b[3] * frame.height).roundToInt().coerceIn(t + 1, frame.height)
        val crop = Bitmap.createBitmap(frame, l, t, r - l, btm - t)
        val h = (width.toFloat() * crop.height / crop.width).roundToInt().coerceAtLeast(1)
        return Bitmap.createScaledBitmap(crop, width, h, true).also { if (it !== crop) crop.recycle() }
    }
}

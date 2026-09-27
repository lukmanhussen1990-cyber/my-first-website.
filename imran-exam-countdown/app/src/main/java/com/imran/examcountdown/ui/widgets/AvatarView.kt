package com.imran.examcountdown.ui.widgets

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapShader
import android.graphics.Canvas
import android.graphics.Matrix
import android.graphics.Paint
import android.graphics.Shader
import android.view.View
import com.imran.examcountdown.ui.Fonts
import com.imran.examcountdown.ui.Ui
import com.imran.examcountdown.ui.dpf
import kotlin.math.max
import kotlin.math.min

/** Imran's personal avatar: his photo in a circle, or his initials. Separate from the school emblem. */
class AvatarView(context: Context) : View(context) {

    var initials: String = "IH"
        set(value) {
            field = value
            invalidate()
        }

    private var photo: Bitmap? = null
    private val photoPaint = Paint(Paint.ANTI_ALIAS_FLAG or Paint.FILTER_BITMAP_FLAG)
    private val circle = Paint(Paint.ANTI_ALIAS_FLAG)
    private val ring = Paint(Paint.ANTI_ALIAS_FLAG).apply { style = Paint.Style.STROKE }
    private val letters = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        textAlign = Paint.Align.CENTER
        typeface = Fonts.serif
    }
    private val matrix = Matrix()

    val hasPhoto: Boolean get() = photo != null

    fun setPhoto(bitmap: Bitmap?) {
        photo = bitmap
        photoPaint.shader = bitmap?.let { BitmapShader(it, Shader.TileMode.CLAMP, Shader.TileMode.CLAMP) }
        updateMatrix()
        invalidate()
    }

    override fun onSizeChanged(w: Int, h: Int, oldw: Int, oldh: Int) = updateMatrix()

    private fun updateMatrix() {
        val b = photo ?: return
        val size = min(width, height).toFloat()
        if (size <= 0f) return
        val scale = size / min(b.width, b.height)
        matrix.setScale(scale, scale)
        matrix.postTranslate((width - b.width * scale) / 2f, (height - b.height * scale) / 2f)
        photoPaint.shader?.setLocalMatrix(matrix)
    }

    override fun onDraw(canvas: Canvas) {
        val c = Ui.c
        val cx = width / 2f
        val cy = height / 2f
        val r = min(width, height) / 2f
        if (photo != null) {
            canvas.drawCircle(cx, cy, r, photoPaint)
        } else {
            circle.color = c.green
            canvas.drawCircle(cx, cy, r, circle)
            letters.color = c.onGreen
            letters.textSize = r * 0.78f
            val y = cy - (letters.descent() + letters.ascent()) / 2f
            canvas.drawText(initials, cx, y, letters)
        }
        ring.color = Ui.withAlpha(c.gold, 0.9f)
        ring.strokeWidth = max(dpf(1.5f), r * 0.05f)
        canvas.drawCircle(cx, cy, r - ring.strokeWidth / 2, ring)
    }
}

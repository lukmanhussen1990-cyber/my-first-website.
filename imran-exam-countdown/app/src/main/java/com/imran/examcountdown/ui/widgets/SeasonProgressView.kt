package com.imran.examcountdown.ui.widgets

import android.animation.ValueAnimator
import android.content.Context
import android.graphics.Canvas
import android.graphics.LinearGradient
import android.graphics.Matrix
import android.graphics.Paint
import android.graphics.RectF
import android.graphics.Shader
import android.view.View
import android.view.animation.LinearInterpolator
import com.imran.examcountdown.ui.Ui
import com.imran.examcountdown.ui.dp
import com.imran.examcountdown.ui.dpf
import com.imran.examcountdown.ui.Ease
import com.imran.examcountdown.ui.window
import kotlin.math.sin

/**
 * One short bar per exam: green when done, gold for today or the paper in progress.
 * The reveal fills the done bars one after another, each chased by a glint; the live (or
 * today's) bar breathes gently while the ambient clock runs.
 */
class SeasonProgressView(context: Context) : View(context) {

    enum class Segment { DONE, LIVE, TODAY, UPCOMING }

    var segments: List<Segment> = emptyList()
        set(value) {
            if (field == value) return
            field = value
            invalidate()
        }

    /** 0..1, one breath of the live/today bar; negative when still. */
    var pulse = -1f
        set(value) {
            if (field == value) return
            field = value
            if (segments.any { it == Segment.LIVE || it == Segment.TODAY }) invalidate()
        }

    private var revealMs = REVEAL_MS
    private val rect = RectF()
    private val gap = dpf(4)
    private val paint = Paint(Paint.ANTI_ALIAS_FLAG)
    private val stroke = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        style = Paint.Style.STROKE
        strokeWidth = dpf(1.5f)
    }
    private val glint = Paint(Paint.ANTI_ALIAS_FLAG)
    private val glintMatrix = Matrix()
    private val glintShader = LinearGradient(
        -dpf(14), 0f, dpf(14), 0f,
        intArrayOf(0x00FFFFFF, 0xB3FFFFFF.toInt(), 0x00FFFFFF), null, Shader.TileMode.CLAMP,
    )

    init {
        importantForAccessibility = IMPORTANT_FOR_ACCESSIBILITY_NO
        glint.shader = glintShader
    }

    /** Fills the done segments one after another. */
    fun playReveal() {
        ValueAnimator.ofFloat(0f, REVEAL_MS).apply {
            duration = REVEAL_MS.toLong()
            interpolator = LinearInterpolator()
            addUpdateListener {
                revealMs = it.animatedValue as Float
                invalidate()
            }
            start()
        }
    }

    override fun onMeasure(widthMeasureSpec: Int, heightMeasureSpec: Int) {
        setMeasuredDimension(resolveSize(dp(200), widthMeasureSpec), resolveSize(dp(6), heightMeasureSpec))
    }

    override fun onDraw(canvas: Canvas) {
        val n = segments.size
        if (n == 0) return
        val c = Ui.c
        val h = height.toFloat()
        val w = (width - gap * (n - 1)) / n
        val r = h / 2f
        val breath = if (pulse >= 0f) 0.5f + 0.5f * sin(pulse * 6.283f) else 0f
        for (i in 0 until n) {
            val left = i * (w + gap)
            rect.set(left, 0f, left + w, h)
            paint.color = c.track
            canvas.drawRoundRect(rect, r, r, paint)
            val local = revealMs - i * STAGGER_MS
            when (segments[i]) {
                Segment.DONE -> {
                    val f = Ease.cubicOut(window(local, 0f, 300f))
                    if (f > 0f) {
                        rect.right = left + w * f
                        paint.color = c.green
                        canvas.drawRoundRect(rect, r, r, paint)
                        // A glint runs along the bar just after it fills.
                        val g = window(local, 160f, 320f)
                        if (g > 0f && g < 1f) {
                            canvas.save()
                            canvas.clipRect(rect)
                            glintMatrix.setTranslate(left - dpf(14) + (w + dpf(28)) * g, 0f)
                            glintShader.setLocalMatrix(glintMatrix)
                            canvas.drawRect(rect, glint)
                            canvas.restore()
                        }
                    }
                }
                Segment.LIVE -> {
                    paint.color = c.gold
                    canvas.drawRoundRect(rect, r, r, paint)
                    if (breath > 0f) {
                        paint.color = Ui.withAlpha(0xFFFFFFFF.toInt(), 0.35f * breath)
                        canvas.drawRoundRect(rect, r, r, paint)
                    }
                }
                Segment.TODAY -> {
                    stroke.color = Ui.withAlpha(c.gold, 0.55f + 0.45f * (1f - breath))
                    rect.inset(stroke.strokeWidth / 2, stroke.strokeWidth / 2)
                    canvas.drawRoundRect(rect, r, r, stroke)
                    if (breath > 0f) {
                        paint.color = Ui.withAlpha(c.gold, 0.28f * breath)
                        canvas.drawRoundRect(rect, r, r, paint)
                    }
                }
                Segment.UPCOMING -> Unit
            }
        }
    }

    companion object {
        private const val REVEAL_MS = 800f
        private const val STAGGER_MS = 50f
    }
}

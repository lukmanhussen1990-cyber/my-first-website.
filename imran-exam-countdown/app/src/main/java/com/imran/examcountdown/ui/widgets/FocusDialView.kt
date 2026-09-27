package com.imran.examcountdown.ui.widgets

import android.animation.ValueAnimator
import android.content.Context
import android.graphics.Canvas
import android.graphics.Matrix
import android.graphics.Paint
import android.graphics.RectF
import android.graphics.SweepGradient
import android.view.View
import android.view.animation.DecelerateInterpolator
import com.imran.examcountdown.core.FocusMode
import com.imran.examcountdown.ui.Palette
import com.imran.examcountdown.ui.dpf
import kotlin.math.cos
import kotlin.math.min
import kotlin.math.sin

/** Circular focus timer: the arc shows the time left in the current session. */
class FocusDialView(context: Context) : View(context) {

    var mode = FocusMode.FOCUS
        set(value) {
            if (field == value) return
            field = value
            updateShader()
            invalidate()
        }

    private var fraction = 1f
    private var animator: ValueAnimator? = null
    private val stroke = dpf(10)
    private val oval = RectF()
    private var cx = 0f
    private var cy = 0f
    private var radius = 0f

    private val track = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        style = Paint.Style.STROKE
        strokeWidth = stroke
        color = Palette.TRACK
    }
    private val arc = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        style = Paint.Style.STROKE
        strokeWidth = stroke
        strokeCap = Paint.Cap.ROUND
    }
    private val ticks = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        strokeWidth = dpf(1.4f)
        strokeCap = Paint.Cap.ROUND
    }
    private val head = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Palette.WHITE }

    init {
        importantForAccessibility = IMPORTANT_FOR_ACCESSIBILITY_NO
    }

    /** [value] is the fraction of the session left (1 = full). */
    fun setFraction(value: Float, animate: Boolean) {
        val v = value.coerceIn(0f, 1f)
        animator?.cancel()
        if (animate && isAttachedToWindow) {
            animator = ValueAnimator.ofFloat(fraction, v).apply {
                duration = 600
                interpolator = DecelerateInterpolator()
                addUpdateListener {
                    fraction = it.animatedValue as Float
                    invalidate()
                }
                start()
            }
        } else {
            fraction = v
            invalidate()
        }
    }

    override fun onSizeChanged(w: Int, h: Int, oldw: Int, oldh: Int) {
        cx = w / 2f
        cy = h / 2f
        radius = min(w, h) / 2f - stroke / 2f - dpf(12)
        oval.set(cx - radius, cy - radius, cx + radius, cy + radius)
        updateShader()
    }

    private fun updateShader() {
        if (width == 0) return
        val colors = if (mode == FocusMode.FOCUS) {
            intArrayOf(Palette.BLUE, Palette.VIOLET, Palette.VIOLET_LIGHT, Palette.BLUE)
        } else {
            intArrayOf(Palette.GREEN, Palette.CYAN, Palette.GREEN, Palette.GREEN)
        }
        arc.shader = SweepGradient(cx, cy, colors, floatArrayOf(0f, 0.5f, 0.85f, 1f)).apply {
            setLocalMatrix(Matrix().apply { setRotate(-90f, cx, cy) })
        }
    }

    override fun onDraw(canvas: Canvas) {
        if (radius <= 0f) return
        val count = mode.minutes
        val inner = radius + stroke / 2f + dpf(5)
        for (i in 0 until count) {
            val a = Math.toRadians(i * 360.0 / count - 90.0)
            val passed = i.toFloat() / count >= fraction
            ticks.color = Palette.withAlpha(Palette.TEXT, if (passed) 0.1f else 0.3f)
            val c = cos(a).toFloat()
            val s = sin(a).toFloat()
            canvas.drawLine(cx + c * inner, cy + s * inner, cx + c * (inner + dpf(5)), cy + s * (inner + dpf(5)), ticks)
        }
        canvas.drawCircle(cx, cy, radius, track)
        val sweep = 360f * fraction
        if (sweep > 0.5f) canvas.drawArc(oval, -90f, sweep, false, arc)
        if (fraction in 0.002f..0.998f) {
            val a = Math.toRadians((-90f + sweep).toDouble())
            canvas.drawCircle(cx + radius * cos(a).toFloat(), cy + radius * sin(a).toFloat(), stroke * 0.32f, head)
        }
    }
}

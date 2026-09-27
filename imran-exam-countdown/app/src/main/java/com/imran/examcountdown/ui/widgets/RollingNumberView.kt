package com.imran.examcountdown.ui.widgets

import android.animation.ValueAnimator
import android.content.Context
import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.Rect
import android.graphics.Typeface
import android.view.View
import android.view.animation.PathInterpolator
import com.imran.examcountdown.ui.Fonts
import com.imran.examcountdown.ui.Ui

/**
 * A number whose changed digits slide gently into place. Every digit has a fixed-width slot,
 * so the number never shifts sideways, and unchanged digits stay perfectly still.
 */
class RollingNumberView(context: Context) : View(context) {

    private val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Ui.c.text
        typeface = Fonts.serif
        textAlign = Paint.Align.CENTER
        fontFeatureSettings = "tnum, lnum"
    }
    private val bounds = Rect()
    private var digitWidth = 0f
    private var digitHeight = 0f

    private var current = "00"
    private var previous = "00"
    private var progress = 1f

    /** Minimum number of digits (zero padded). */
    var minDigits = 2
        set(value) {
            if (field == value) return
            field = value
            current = current.padStart(value, '0')
            requestLayout()
        }

    /** Space above and below the digits, in pixels. Equal gaps keep mixed sizes on one baseline. */
    var verticalGapPx = -1f
        set(value) {
            field = value
            requestLayout()
        }

    /** When false (reduced motion), digits change instantly. */
    var animateChanges = true

    private val animator = ValueAnimator.ofFloat(0f, 1f).apply {
        duration = 380
        interpolator = PathInterpolator(0.25f, 0.8f, 0.3f, 1f)
        addUpdateListener {
            progress = it.animatedValue as Float
            invalidate()
        }
    }

    var textSizePx: Float
        get() = paint.textSize
        set(value) {
            if (paint.textSize == value) return
            paint.textSize = value
            measureDigits()
        }

    var color: Int
        get() = paint.color
        set(value) {
            paint.color = value
            invalidate()
        }

    var font: Typeface
        get() = paint.typeface
        set(value) {
            paint.typeface = value
            measureDigits()
        }

    init {
        importantForAccessibility = IMPORTANT_FOR_ACCESSIBILITY_NO
        measureDigits()
    }

    val value: String get() = current

    fun setValue(number: Long, animate: Boolean = animateChanges) {
        val next = number.coerceAtLeast(0).toString().padStart(minDigits, '0')
        if (next == current) return
        val lengthChanged = next.length != current.length
        previous = current
        current = next
        if (lengthChanged) requestLayout()
        if (animate && animateChanges && isAttachedToWindow && isShown) {
            animator.cancel()
            progress = 0f
            animator.start()
        } else {
            animator.cancel()
            progress = 1f
            invalidate()
        }
    }

    private fun measureDigits() {
        digitWidth = (0..9).maxOf { paint.measureText(it.toString()) }
        paint.getTextBounds("0123456789", 0, 10, bounds)
        digitHeight = bounds.height().toFloat()
        requestLayout()
        invalidate()
    }

    private fun gap(): Float = if (verticalGapPx >= 0f) verticalGapPx else digitHeight * 0.16f

    override fun onMeasure(widthMeasureSpec: Int, heightMeasureSpec: Int) {
        val w = (digitWidth * current.length).toInt() + paddingLeft + paddingRight
        val h = (digitHeight + 2 * gap()).toInt() + paddingTop + paddingBottom
        setMeasuredDimension(resolveSize(w, widthMeasureSpec), resolveSize(h, heightMeasureSpec))
    }

    override fun onDetachedFromWindow() {
        animator.cancel()
        progress = 1f
        super.onDetachedFromWindow()
    }

    override fun onDraw(canvas: Canvas) {
        val h = height.toFloat()
        val baseline = h - paddingBottom - gap() - bounds.bottom
        val n = current.length
        val old = if (previous.length >= n) previous.takeLast(n) else previous.padStart(n, ' ')
        val left = paddingLeft + (width - paddingLeft - paddingRight - digitWidth * n) / 2f
        val baseAlpha = paint.alpha
        canvas.save()
        canvas.clipRect(0, 0, width, height)
        for (i in 0 until n) {
            val cx = left + digitWidth * (i + 0.5f)
            val newChar = current[i]
            val oldChar = old[i]
            if (progress >= 1f || newChar == oldChar) {
                paint.alpha = baseAlpha
                canvas.drawText(newChar.toString(), cx, baseline, paint)
            } else {
                // Only changed digits move: the old one slides down and fades, the new one follows.
                val travel = digitHeight * 0.55f
                if (oldChar != ' ') {
                    paint.alpha = (baseAlpha * (1f - progress)).toInt()
                    canvas.drawText(oldChar.toString(), cx, baseline + travel * progress, paint)
                }
                paint.alpha = (baseAlpha * progress).toInt()
                canvas.drawText(newChar.toString(), cx, baseline - travel * (1f - progress), paint)
            }
        }
        paint.alpha = baseAlpha
        canvas.restore()
    }
}

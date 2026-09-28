package com.imran.examcountdown.ui.widgets

import android.content.Context
import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.Rect
import android.graphics.Typeface
import android.os.SystemClock
import android.view.View
import com.imran.examcountdown.ui.Ease
import com.imran.examcountdown.ui.Fonts
import com.imran.examcountdown.ui.Ui
import com.imran.examcountdown.ui.window

/**
 * A number whose digits slide vertically when they change: the old figure slides out and fades
 * as the new one slides in (from above when counting down). Only digits that actually change
 * move, every digit has its own fixed-width slot (tabular figures), so the number never shifts
 * sideways, and when several change at once they follow each other right to left, like a carry.
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
    private var slides = arrayOf<Slide?>()

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

    /**
     * Which way the figures move: true for countdowns (the new one arrives from above), false
     * for counting up, null to follow the change in value.
     */
    var countsDown: Boolean? = null

    var textSizePx: Float
        get() = paint.textSize
        set(value) {
            if (paint.textSize == value) return
            paint.textSize = value
            measureDigits()
        }

    var color: Int = Ui.c.text
        set(value) {
            field = value
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

    /** True while any digit is still sliding. */
    val isAnimating: Boolean
        get() {
            val now = SystemClock.uptimeMillis()
            return slides.any { it != null && !it.done(now) }
        }

    fun setValue(number: Long, animate: Boolean = animateChanges) {
        val next = number.coerceAtLeast(0).toString().padStart(minDigits, '0')
        if (next == current) return
        val previous = current
        current = next
        if (next.length != previous.length) requestLayout()
        if (!(animate && animateChanges && isAttachedToWindow && isShown) || next.length != previous.length) {
            slides = arrayOfNulls(next.length)
            invalidate()
            return
        }
        val down = countsDown ?: ((next.toLongOrNull() ?: 0L) < (previous.toLongOrNull() ?: 0L))
        val now = SystemClock.uptimeMillis()
        val fresh = arrayOfNulls<Slide>(next.length)
        var carry = 0
        for (i in next.indices.reversed()) {
            val running = slides.getOrNull(i)?.takeIf { !it.done(now) }
            if (next[i] == previous[i]) {
                // Unchanged: stays perfectly still (or finishes a slide already under way).
                fresh[i] = running
                continue
            }
            fresh[i] = Slide(previous[i], next[i], now + carry * CARRY_MS, down)
            carry++
        }
        slides = fresh
        postInvalidateOnAnimation()
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
        slides = arrayOfNulls(current.length)
        super.onDetachedFromWindow()
    }

    override fun onDraw(canvas: Canvas) {
        val now = SystemClock.uptimeMillis()
        val baseline = height - paddingBottom - gap() - bounds.bottom
        // How far a figure travels: just past the edge of its slot.
        val travel = digitHeight + gap() * 2f
        val n = current.length
        val left = paddingLeft + (width - paddingLeft - paddingRight - digitWidth * n) / 2f
        if (slides.size != n) slides = arrayOfNulls(n)
        var busy = false
        canvas.save()
        canvas.clipRect(0, 0, width, height)
        for (i in 0 until n) {
            val cx = left + digitWidth * (i + 0.5f)
            val slide = slides[i]
            if (slide == null || slide.done(now)) {
                slides[i] = null
                paint.color = color
                canvas.drawText(current, i, i + 1, cx, baseline, paint)
                continue
            }
            busy = true
            val p = Ease.cubicOut(window((now - slide.start).toFloat(), 0f, SLIDE_MS))
            // Countdown: the new figure comes down from above while the old one drops away.
            val dir = if (slide.down) 1f else -1f
            paint.color = Ui.withAlpha(color, (color ushr 24) / 255f * (1f - window(p, 0f, 0.7f)))
            drawDigit(canvas, slide.from, cx, baseline + dir * travel * p)
            paint.color = Ui.withAlpha(color, (color ushr 24) / 255f * window(p, 0.2f, 0.8f))
            drawDigit(canvas, slide.to, cx, baseline - dir * travel * (1f - p))
        }
        canvas.restore()
        paint.color = color
        if (busy) postInvalidateOnAnimation()
    }

    private fun drawDigit(canvas: Canvas, digit: Char, cx: Float, baseline: Float) {
        val d = digit - '0'
        if (d in 0..9) canvas.drawText(DIGITS, d, d + 1, cx, baseline, paint)
    }

    /** One digit changing from [from] to [to], starting at [start] (uptime ms). */
    private class Slide(val from: Char, val to: Char, val start: Long, val down: Boolean) {
        fun done(now: Long) = now - start >= SLIDE_MS
    }

    companion object {
        private const val DIGITS = "0123456789"

        /** A digit's slide, ms. */
        const val SLIDE_MS = 280f
        private const val CARRY_MS = 30L
    }
}

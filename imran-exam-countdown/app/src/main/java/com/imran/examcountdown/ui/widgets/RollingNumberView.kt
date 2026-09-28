package com.imran.examcountdown.ui.widgets

import android.content.Context
import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.Rect
import android.graphics.Typeface
import android.os.SystemClock
import android.view.View
import com.imran.examcountdown.ui.Fonts
import com.imran.examcountdown.ui.Ui
import com.imran.examcountdown.ui.lerpColor
import com.imran.examcountdown.ui.spring
import com.imran.examcountdown.ui.window
import kotlin.math.abs
import kotlin.math.cos
import kotlin.math.floor
import kotlin.math.max
import kotlin.math.min
import kotlin.math.pow
import kotlin.math.sin

/**
 * A number printed on little drums, like a mechanical counter. When a digit changes its drum
 * turns — the old figure rolls away over the curve as the new one comes round, blurred while it
 * moves fast, and lands with a small spring. Several digits changing at once turn right to left,
 * like a carry. Every digit has a fixed-width slot, so the number never shifts sideways, and
 * unchanged digits stay perfectly still. [spinIn] spins every drum like a slot machine.
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
    private var slots = arrayOf<Drum?>()

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

    /** Changed digits flash in this colour as they land, then settle back (null: no flash). */
    var flashColor: Int? = null

    /**
     * Which way the drums prefer to turn when both ways are equally short: true for countdowns
     * (figures arrive from above), false for counting up, null to follow the change in value.
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

    /** True while any drum is still turning (or fading out of its landing flash). */
    val isAnimating: Boolean
        get() {
            val now = SystemClock.uptimeMillis()
            return slots.any { it != null && !it.finished(now, flashColor != null) }
        }

    fun setValue(number: Long, animate: Boolean = animateChanges) {
        val next = number.coerceAtLeast(0).toString().padStart(minDigits, '0')
        if (next == current) return
        val previous = current
        current = next
        if (next.length != previous.length) requestLayout()
        if (!(animate && animateChanges && isAttachedToWindow && isShown)) {
            slots = arrayOfNulls(next.length)
            invalidate()
            return
        }
        val down = countsDown ?: ((next.toLongOrNull() ?: 0L) < (previous.toLongOrNull() ?: 0L))
        val old = if (previous.length >= next.length) previous.takeLast(next.length) else previous.padStart(next.length, ' ')
        val now = SystemClock.uptimeMillis()
        val fresh = arrayOfNulls<Drum>(next.length)
        var carry = 0
        for (i in next.indices.reversed()) {
            val to = next[i] - '0'
            val running = slots.getOrNull(i + (slots.size - next.length))?.takeIf { !it.landed(now) }
            if (running != null && running.spin) {
                // Mid slot-machine spin: keep spinning, just aim at the new figure.
                fresh[i] = if (next[i] == old[i]) running else running.retarget(to, now)
                continue
            }
            if (next[i] == old[i] && running == null) continue
            // Continue from wherever (and as fast as) a still-turning drum is right now.
            val from = running?.position(now) ?: if (old[i] == ' ') (to + if (down) 1f else -1f) else (old[i] - '0').toFloat()
            fresh[i] = Drum.roll(from, to, down, if (running != null) now else now + carry * CARRY_MS, running?.velocity(now) ?: 0f)
            if (next[i] != old[i]) carry++
        }
        slots = fresh
        postInvalidateOnAnimation()
    }

    /**
     * Spins every drum like a slot machine and stops them one by one, left to right, on the
     * current value. Does nothing with reduced motion.
     */
    fun spinIn(delayMs: Long = 0L, turnsPerSlot: Int = 1) {
        if (!animateChanges) return
        val now = SystemClock.uptimeMillis() + delayMs
        slots = Array(current.length) { i ->
            val to = current[i] - '0'
            Drum.spin(to, (i + 1) * turnsPerSlot, now + i * 110L, 1050L + i * 170L)
        }
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
        slots = arrayOfNulls(current.length)
        super.onDetachedFromWindow()
    }

    override fun onDraw(canvas: Canvas) {
        val now = SystemClock.uptimeMillis()
        val h = height.toFloat()
        val baseline = h - paddingBottom - gap() - bounds.bottom
        // Vertical centre of the figures, the axis the drums turn about.
        val axis = baseline - digitHeight / 2f
        val step = digitHeight * 1.15f
        val n = current.length
        val left = paddingLeft + (width - paddingLeft - paddingRight - digitWidth * n) / 2f
        if (slots.size != n) slots = arrayOfNulls(n)
        var busy = false
        canvas.save()
        canvas.clipRect(0, 0, width, height)
        for (i in 0 until n) {
            val cx = left + digitWidth * (i + 0.5f)
            val drum = slots[i]
            if (drum != null && drum.finished(now, flashColor != null)) slots[i] = null
            if (drum == null || drum.landed(now)) {
                // At rest (possibly still fading out of its landing flash).
                if (slots[i] != null) busy = true
                tint(slots[i], now)
                canvas.drawText(current, i, i + 1, cx, baseline, paint)
                continue
            }
            busy = true
            val p = drum.position(now)
            val velocity = (p - drum.position(now - 16)) / 16f
            tint(drum, now)
            val base = paint.color
            // Motion blur: faint copies trailing behind a fast-moving drum.
            val speed = min(abs(velocity) * 60f, 1f)
            if (speed > 0.15f) {
                val trail = -velocity.let { if (it > 0f) 1f else -1f } * 0.16f
                drawDrum(canvas, cx, axis, baseline, step, p + trail, base, 0.32f * speed)
                drawDrum(canvas, cx, axis, baseline, step, p + trail * 2f, base, 0.14f * speed)
            }
            drawDrum(canvas, cx, axis, baseline, step, p, base, 1f)
        }
        canvas.restore()
        paint.color = color
        if (busy) postInvalidateOnAnimation()
    }

    /** Draws the figures visible on a drum turned to [position] (fractional digit index). */
    private fun drawDrum(canvas: Canvas, cx: Float, axis: Float, baseline: Float, step: Float, position: Float, color: Int, alpha: Float) {
        val first = floor(position).toInt()
        for (j in first..first + 1) {
            // Offset of figure j from the front of the drum, in figures (+ = below).
            val y = j - position
            if (abs(y) >= 1f) continue
            val theta = y * (Math.PI / 2 * 0.92).toFloat()
            val facing = cos(theta)
            if (facing <= 0.02f) continue
            paint.color = Ui.withAlpha(color, (color ushr 24) / 255f * alpha * facing.pow(1.4f))
            canvas.save()
            canvas.translate(0f, sin(theta) * step * 0.78f)
            canvas.scale(1f, facing, cx, axis)
            val digit = ((j % 10) + 10) % 10
            canvas.drawText(DIGITS, digit, digit + 1, cx, baseline, paint)
            canvas.restore()
        }
    }

    /** Sets the paint colour for a digit: [flashColor] as it lands, fading back to [color]. */
    private fun tint(drum: Drum?, now: Long) {
        val accent = flashColor
        paint.color = if (accent == null || drum == null || drum.spin) color else lerpColor(accent, color, drum.flashFade(now))
    }

    /**
     * One drum's motion: a damped spring from [from] to [to] (drum positions, where figure k sits
     * at k, k ± 10…) starting at [start], lasting [duration] ms, with [damping] as in [spring].
     * [v0] is its speed at the start (positions per ms), so a drum can change target mid-turn
     * without a jolt.
     */
    private class Drum(
        val from: Float,
        val to: Float,
        val start: Long,
        val duration: Long,
        val damping: Float,
        val spin: Boolean,
        private val v0: Float = 0f,
    ) {
        fun position(now: Long): Float {
            val t = ((now - start).toFloat() / duration).coerceIn(0f, 1f)
            if (v0 == 0f) return from + (to - from) * spring(t, damping)
            if (t >= 1f) return to
            // General solution, in time normalised to the duration (see spring()).
            val z = damping.coerceIn(0.05f, 1f)
            val w = 7f / z
            val a = from - to
            val v = v0 * duration
            val decay = kotlin.math.exp(-z * w * t)
            if (z >= 0.999f) return to + decay * (a + (v + w * a) * t)
            val wd = w * kotlin.math.sqrt(1f - z * z)
            val b = (v + z * w * a) / wd
            return to + decay * (a * cos(wd * t) + b * sin(wd * t))
        }

        /** Current speed, in positions per ms. */
        fun velocity(now: Long): Float = (position(now + 4) - position(now - 4)) / 8f

        /** The drum has stopped turning. */
        fun landed(now: Long) = now - start >= duration

        /** The same spin, still turning the same way at the same speed, re-aimed to land on [digit]. */
        fun retarget(digit: Int, now: Long): Drum {
            val p = position(now)
            // The nearest place at or below the current position that shows [digit].
            val target = floor((p - digit) / 10f) * 10f + digit
            return Drum(p, target, now, (start + duration - now).coerceAtLeast(420L), damping, spin = true, v0 = velocity(now))
        }

        /** 1 = plain colour; dips to 0 (full flash) as the drum turns, then fades back out. */
        fun flashFade(now: Long): Float {
            val elapsed = (now - start).toFloat()
            val rampIn = window(elapsed, 0f, duration * 0.25f)
            val fadeOut = window(elapsed, duration * 0.35f, FLASH_MS)
            return 1f - rampIn * (1f - fadeOut)
        }

        /** Nothing left to draw: landed, and its flash (if any) has faded. */
        fun finished(now: Long, flashing: Boolean) = landed(now) && (!flashing || spin || flashFade(now) >= 1f)

        companion object {
            /**
             * A change of one figure. The drum turns the shorter way; when both ways are equally
             * long it turns [down] (figures arriving from above), as a countdown would.
             */
            fun roll(from: Float, to: Int, down: Boolean, start: Long, v0: Float = 0f): Drum {
                val here = ((from % 10f) + 10f) % 10f
                val below = ((here - to) % 10f + 10f) % 10f // distance turning down (index falls)
                val above = ((to - here) % 10f + 10f) % 10f // distance turning up
                val turnDown = if (abs(below - above) < 0.01f) down else below < above
                val target = if (turnDown) from - below else from + above
                val steps = abs(target - from)
                val duration = (540 + 60 * max(0f, steps - 1f)).toLong().coerceAtMost(900L)
                return Drum(from, target, start, duration, 0.6f, spin = false, v0 = v0)
            }

            /** Slot machine: [turns] whole turns, then land on [to]. */
            fun spin(to: Int, turns: Int, start: Long, duration: Long): Drum =
                Drum(to + 10f * turns, to.toFloat(), start, duration, 0.74f, spin = true)
        }
    }

    companion object {
        private const val DIGITS = "0123456789"
        private const val CARRY_MS = 55L
        private const val FLASH_MS = 700f
    }
}

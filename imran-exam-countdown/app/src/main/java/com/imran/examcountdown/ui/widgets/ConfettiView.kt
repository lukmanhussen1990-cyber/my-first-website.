package com.imran.examcountdown.ui.widgets

import android.content.Context
import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.RectF
import android.os.SystemClock
import android.view.View
import com.imran.examcountdown.ui.Palette
import com.imran.examcountdown.ui.dpf
import kotlin.math.cos
import kotlin.math.exp
import kotlin.math.sin
import kotlin.random.Random

/** Celebration confetti fired from both bottom corners. Runs for a few seconds, then stops. */
class ConfettiView(context: Context) : View(context) {

    private class Piece(
        var x: Float,
        var y: Float,
        var vx: Float,
        var vy: Float,
        var rotation: Float,
        val spin: Float,
        val w: Float,
        val h: Float,
        val color: Int,
        val round: Boolean,
        val flutter: Float,
    )

    private val pieces = ArrayList<Piece>()
    private val paint = Paint(Paint.ANTI_ALIAS_FLAG)
    private val rect = RectF()
    private val random = Random(SystemClock.uptimeMillis())
    private var start = 0L
    private var last = 0L
    private val colors = intArrayOf(
        Palette.BLUE, Palette.CYAN, Palette.VIOLET, Palette.VIOLET_LIGHT,
        Palette.PINK, Palette.AMBER, Palette.GREEN, Palette.WHITE,
    )

    init {
        importantForAccessibility = IMPORTANT_FOR_ACCESSIBILITY_NO
        isClickable = false
    }

    val isRunning: Boolean get() = pieces.isNotEmpty()

    fun burst() {
        if (width == 0 || height == 0) {
            post { burst() }
            return
        }
        pieces.clear()
        val h = height.toFloat()
        val w = width.toFloat()
        repeat(150) { i ->
            val fromLeft = i % 2 == 0
            val angle = Math.toRadians(if (fromLeft) -62.0 + random.nextDouble(-16.0, 16.0) else -118.0 + random.nextDouble(-16.0, 16.0))
            val speed = dpf(880 + random.nextFloat() * 700)
            pieces += Piece(
                x = if (fromLeft) -dpf(8) else w + dpf(8),
                y = h * (0.82f + random.nextFloat() * 0.1f),
                vx = (cos(angle) * speed).toFloat(),
                vy = (sin(angle) * speed).toFloat(),
                rotation = random.nextFloat() * 360f,
                spin = (random.nextFloat() - 0.5f) * 720f,
                w = dpf(6 + random.nextFloat() * 6),
                h = dpf(9 + random.nextFloat() * 8),
                color = colors[random.nextInt(colors.size)],
                round = random.nextInt(5) == 0,
                flutter = random.nextFloat() * 10f,
            )
        }
        start = SystemClock.uptimeMillis()
        last = start
        postInvalidateOnAnimation()
    }

    fun stop() {
        pieces.clear()
        invalidate()
    }

    override fun onDraw(canvas: Canvas) {
        if (pieces.isEmpty()) return
        val now = SystemClock.uptimeMillis()
        val dt = ((now - last).coerceIn(0, 50)) / 1000f
        last = now
        val age = (now - start) / 1000f
        val gravity = dpf(1150)
        val drag = exp(-1.25f * dt)
        val fade = if (age > 2.6f) (1f - (age - 2.6f) / 1.1f).coerceIn(0f, 1f) else 1f
        for (p in pieces) {
            p.vy += gravity * dt
            p.vx *= drag
            p.vy *= drag
            p.x += p.vx * dt
            p.y += p.vy * dt
            p.rotation += p.spin * dt
            paint.color = p.color
            paint.alpha = (255 * fade).toInt()
            canvas.save()
            canvas.translate(p.x, p.y)
            canvas.rotate(p.rotation)
            // Squash horizontally over time so pieces look like they flutter in 3D.
            canvas.scale(cos(age * 6f + p.flutter), 1f)
            rect.set(-p.w / 2, -p.h / 2, p.w / 2, p.h / 2)
            if (p.round) canvas.drawOval(rect, paint) else canvas.drawRoundRect(rect, dpf(1.5f), dpf(1.5f), paint)
            canvas.restore()
        }
        if (age < 3.8f) postInvalidateOnAnimation() else pieces.clear()
    }
}

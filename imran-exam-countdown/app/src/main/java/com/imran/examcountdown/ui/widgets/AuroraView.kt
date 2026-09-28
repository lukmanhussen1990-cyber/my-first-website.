package com.imran.examcountdown.ui.widgets

import android.content.Context
import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.RadialGradient
import android.graphics.Shader
import android.view.View
import com.imran.examcountdown.ui.Ui
import com.imran.examcountdown.ui.dpf
import kotlin.math.cos
import kotlin.math.sin
import kotlin.random.Random

/**
 * Home's living background: soft pools of green and gold light drifting slowly behind the
 * content, with a few specks of gold dust rising and twinkling. The contrast is kept very low so
 * text stays crisp. It moves only while continuous effects are allowed (not in Battery Saver or
 * with reduced motion); otherwise it is drawn once, still, and costs nothing.
 */
class AuroraView(context: Context) : View(context) {

    private class Glow(
        val fx: Float,
        val fy: Float,
        val size: Float,
        val color: Int,
        val orbitDp: Float,
        val period: Float,
        val phase: Float,
    ) {
        var shader: RadialGradient? = null
    }

    private class Mote(val fx: Float, val fy: Float, val speedDp: Float, val size: Float, val sway: Float, val phase: Float)

    /** Whether the light drifts and the dust rises (continuous effects allowed). */
    var moving = false
        set(value) {
            if (field == value) return
            field = value
            invalidate()
        }

    /** Scroll position of the content above, for a gentle parallax. */
    var scroll = 0
        set(value) {
            if (field == value) return
            field = value
            invalidate()
        }

    private var seconds = 0f
    private val c = Ui.c
    private val glows = listOf(
        Glow(0.92f, 0.1f, 0.85f, Ui.withAlpha(c.gold, if (c.dark) 0.11f else 0.15f), 34f, 17f, 0f),
        Glow(0.04f, 0.3f, 0.95f, Ui.withAlpha(if (c.dark) c.green else c.greenText, if (c.dark) 0.3f else 0.07f), 42f, 23f, 2.1f),
        Glow(0.62f, 0.56f, 0.7f, Ui.withAlpha(c.gold, if (c.dark) 0.06f else 0.08f), 28f, 29f, 4.2f),
    )
    private val motes = Random(47).let { rnd ->
        List(16) { Mote(rnd.nextFloat(), rnd.nextFloat(), 7f + rnd.nextFloat() * 12f, 0.8f + rnd.nextFloat() * 1.3f, 6f + rnd.nextFloat() * 10f, rnd.nextFloat() * 6.28f) }
    }
    private val glowPaint = Paint(Paint.ANTI_ALIAS_FLAG)
    private val motePaint = Paint(Paint.ANTI_ALIAS_FLAG)

    init {
        importantForAccessibility = IMPORTANT_FOR_ACCESSIBILITY_NO
    }

    /** Advances the drift; driven by the app's shared ambient clock. */
    fun frame(frameTimeMs: Long) {
        if (!moving) return
        seconds = (frameTimeMs % 3_600_000L) / 1000f
        invalidate()
    }

    override fun onSizeChanged(w: Int, h: Int, oldw: Int, oldh: Int) {
        // One unit-radius gradient per glow; drawing scales it, so nothing is allocated per frame.
        for (g in glows) g.shader = RadialGradient(0f, 0f, 1f, intArrayOf(g.color, Ui.withAlpha(g.color, 0f)), null, Shader.TileMode.CLAMP)
    }

    override fun onDraw(canvas: Canvas) {
        val w = width.toFloat()
        val h = height.toFloat()
        if (w == 0f) return
        val t = if (moving) seconds else 0f
        val parallax = -scroll * 0.35f
        for (g in glows) {
            val a = t / g.period * 6.283f + g.phase
            val x = g.fx * w + cos(a) * dpf(g.orbitDp)
            val y = g.fy * h + sin(a * 0.8f) * dpf(g.orbitDp) + parallax
            val r = g.size * w * (1f + 0.06f * sin(a * 1.3f))
            glowPaint.shader = g.shader
            canvas.save()
            canvas.translate(x, y)
            canvas.scale(r, r)
            canvas.drawCircle(0f, 0f, 1f, glowPaint)
            canvas.restore()
        }
        if (!moving) return
        // Gold dust drifting up through the top half, twinkling.
        for (m in motes) {
            val span = h * 0.62f
            val rise = (t * dpf(m.speedDp) + m.fy * span) % span
            val y = span - rise + parallax * 0.6f
            val x = m.fx * w + sin(t * 0.7f + m.phase) * dpf(m.sway)
            val edge = (rise / span).let { if (it < 0.15f) it / 0.15f else if (it > 0.8f) (1f - it) / 0.2f else 1f }
            val twinkle = 0.5f + 0.5f * sin(t * 2.3f + m.phase * 3f)
            motePaint.color = Ui.withAlpha(if (c.dark) c.goldText else c.gold, (if (c.dark) 0.55f else 0.5f) * edge * twinkle)
            canvas.drawCircle(x, y, dpf(m.size), motePaint)
        }
    }
}

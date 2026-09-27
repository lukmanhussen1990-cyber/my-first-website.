package com.imran.examcountdown.ui.widgets

import android.content.Context
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.PorterDuff
import android.graphics.PorterDuffColorFilter
import android.graphics.RadialGradient
import android.graphics.RectF
import android.graphics.Shader
import android.view.View
import com.imran.examcountdown.ui.AmbientListener
import com.imran.examcountdown.ui.Palette
import com.imran.examcountdown.ui.dpf
import kotlin.math.PI
import kotlin.math.min
import kotlin.math.sin
import kotlin.random.Random

/**
 * Subtle floating particles behind the content. One pre-rendered soft dot is reused for
 * every particle, and it only moves while the ambient clock is running.
 */
class ParticleFieldView(context: Context) : View(context), AmbientListener {

    private class Particle(
        var x: Float,
        var y: Float,
        val radius: Float,
        val speed: Float,
        val swayAmp: Float,
        val swayPeriod: Float,
        val twinklePeriod: Float,
        val phase: Float,
        val alpha: Float,
        val paint: Int,
    )

    private val random = Random(2026)
    private val particles = ArrayList<Particle>()
    private val dot: Bitmap = makeDot(64)
    private val dst = RectF()
    private val paints: Array<Paint> = arrayOf(Palette.WHITE, Palette.CYAN, Palette.BLUE, Palette.VIOLET_LIGHT).map { c ->
        Paint(Paint.FILTER_BITMAP_FLAG).apply {
            if (c != Palette.WHITE) colorFilter = PorterDuffColorFilter(c, PorterDuff.Mode.SRC_IN)
        }
    }.toTypedArray()

    private var lastFrame = -1L
    private var clock = 0L

    /** Set by the host: true only while the ambient clock may drive this view. */
    var animating = false
        set(value) {
            field = value
            lastFrame = -1L
        }

    init {
        importantForAccessibility = IMPORTANT_FOR_ACCESSIBILITY_NO
    }

    override fun onSizeChanged(w: Int, h: Int, oldw: Int, oldh: Int) {
        if (w == 0 || h == 0) return
        particles.clear()
        val area = w.toFloat() * h
        val cell = dpf(88)
        val count = (area / (cell * cell)).toInt().coerceIn(14, 34)
        repeat(count) { particles += spawn(w, h, random.nextFloat() * h, bokeh = false) }
        repeat(5) { particles += spawn(w, h, random.nextFloat() * h, bokeh = true) }
    }

    private fun spawn(w: Int, h: Int, y: Float, bokeh: Boolean): Particle {
        val radius = if (bokeh) dpf(10 + random.nextFloat() * 16) else dpf(0.9f + random.nextFloat() * 2.1f)
        return Particle(
            x = random.nextFloat() * w,
            y = y,
            radius = radius,
            speed = dpf(if (bokeh) 3 + random.nextFloat() * 5 else 5 + random.nextFloat() * 12),
            swayAmp = dpf(4 + random.nextFloat() * 14),
            swayPeriod = 7000f + random.nextFloat() * 9000f,
            twinklePeriod = 2200f + random.nextFloat() * 3800f,
            phase = random.nextFloat() * (2 * PI).toFloat(),
            alpha = if (bokeh) 0.05f + random.nextFloat() * 0.06f else 0.25f + random.nextFloat() * 0.5f,
            paint = if (bokeh) 2 + random.nextInt(2) else random.nextInt(paints.size),
        )
    }

    override fun onAmbientFrame(frameTimeMs: Long) {
        if (!animating || particles.isEmpty()) return
        val dt = if (lastFrame < 0) 0L else min(frameTimeMs - lastFrame, 100L)
        lastFrame = frameTimeMs
        clock += dt
        val seconds = dt / 1000f
        val h = height.toFloat()
        for (p in particles) {
            p.y -= p.speed * seconds
            if (p.y < -p.radius * 3) {
                p.y = h + p.radius * 3
                p.x = random.nextFloat() * width
            }
        }
        invalidate()
    }

    override fun onDraw(canvas: Canvas) {
        val t = clock.toFloat()
        for (p in particles) {
            val sway = sin(2 * PI * t / p.swayPeriod + p.phase).toFloat() * p.swayAmp
            val twinkle = 0.6f + 0.4f * sin(2 * PI * t / p.twinklePeriod + p.phase).toFloat()
            val r = p.radius * 3f
            val x = p.x + sway
            dst.set(x - r, p.y - r, x + r, p.y + r)
            val paint = paints[p.paint]
            paint.alpha = (255 * p.alpha * twinkle).toInt().coerceIn(0, 255)
            canvas.drawBitmap(dot, null, dst, paint)
        }
    }

    private fun makeDot(size: Int): Bitmap {
        val bitmap = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888)
        val c = Canvas(bitmap)
        val half = size / 2f
        val p = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            shader = RadialGradient(
                half, half, half,
                intArrayOf(0xFFFFFFFF.toInt(), 0x99FFFFFF.toInt(), 0x22FFFFFF, 0),
                floatArrayOf(0f, 0.18f, 0.45f, 1f),
                Shader.TileMode.CLAMP,
            )
        }
        c.drawCircle(half, half, half, p)
        return bitmap
    }
}

package com.imran.examcountdown.ui.widgets

import android.animation.ValueAnimator
import android.content.Context
import android.graphics.Bitmap
import android.graphics.BlurMaskFilter
import android.graphics.Canvas
import android.graphics.Matrix
import android.graphics.Paint
import android.graphics.RadialGradient
import android.graphics.RectF
import android.graphics.Shader
import android.graphics.SweepGradient
import android.view.View
import android.view.animation.DecelerateInterpolator
import com.imran.examcountdown.ui.AmbientListener
import com.imran.examcountdown.ui.Palette
import com.imran.examcountdown.ui.dpf
import kotlin.math.abs
import kotlin.math.cos
import kotlin.math.min
import kotlin.math.sin

/**
 * The softly glowing countdown ring. The arc fills as the next exam approaches; a ring of
 * ticks marks the passing seconds. The glow is blurred once into a small cached bitmap and
 * only re-rendered when the arc actually changes, so breathing costs almost nothing.
 */
class CountdownRingView(context: Context) : View(context), AmbientListener {

    enum class Mode { COUNTDOWN, LIVE, CELEBRATE }

    var mode: Mode = Mode.COUNTDOWN
        set(value) {
            if (field == value) return
            field = value
            updateShaders()
            glowDirty = true
            invalidate()
        }

    /** Movement allowed (the fill animates in). */
    var motion = true

    /** Breathing glow and smooth seconds allowed. */
    var ambient = false
        set(value) {
            field = value
            invalidate()
        }

    /** Position within the current minute, 0..1, supplied by the host. */
    var secondsProvider: () -> Float = { 0f }

    private var target = 0f
    private var shown = 0f
    private var intro: ValueAnimator? = null
    private var introWhenAttached = false
    private var breath = 0.65f

    private val stroke = dpf(12)
    private val tickGap = dpf(9)
    private val tickLong = dpf(7)
    private val tickShort = dpf(3.5f)
    private var cx = 0f
    private var cy = 0f
    private var radius = 0f
    private val oval = RectF()

    private val trackPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        style = Paint.Style.STROKE
        strokeWidth = stroke
        color = Palette.TRACK
    }
    private val arcPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        style = Paint.Style.STROKE
        strokeWidth = stroke
        strokeCap = Paint.Cap.ROUND
    }
    private val tickPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        style = Paint.Style.STROKE
        strokeCap = Paint.Cap.ROUND
        strokeWidth = dpf(1.6f)
    }
    private val haloPaint = Paint(Paint.ANTI_ALIAS_FLAG)
    private val headPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Palette.WHITE }
    private val headGlowPaint = Paint(Paint.ANTI_ALIAS_FLAG)
    private val glowPaint = Paint(Paint.FILTER_BITMAP_FLAG or Paint.ANTI_ALIAS_FLAG)

    private var glow: Bitmap? = null
    private var glowFor = -1f
    private var glowDirty = true
    private val glowDst = RectF()

    init {
        importantForAccessibility = IMPORTANT_FOR_ACCESSIBILITY_NO
    }

    /** Sets how full the ring is (0..1). On first show it sweeps in when motion is allowed. */
    fun setProgress(value: Float, animate: Boolean) {
        val v = value.coerceIn(0f, 1f)
        if (abs(v - target) < 0.00001f && intro == null) return
        target = v
        if (animate && motion && !isAttachedToWindow) {
            // Sweep in once the view is on screen (e.g. right after launch).
            introWhenAttached = true
            shown = 0f
            return
        }
        if (animate && motion) {
            intro?.cancel()
            intro = ValueAnimator.ofFloat(shown, v).apply {
                duration = 1300
                interpolator = DecelerateInterpolator(2f)
                addUpdateListener {
                    shown = it.animatedValue as Float
                    invalidate()
                }
                addListener(object : android.animation.AnimatorListenerAdapter() {
                    override fun onAnimationEnd(animation: android.animation.Animator) {
                        intro = null
                        glowDirty = true
                        invalidate()
                    }
                })
                start()
            }
        } else if (intro == null && !introWhenAttached) {
            shown = v
            invalidate()
        }
    }

    override fun onAmbientFrame(frameTimeMs: Long) {
        val period = if (mode == Mode.LIVE) 1800.0 else 4200.0
        breath = (0.5 + 0.5 * sin(2 * Math.PI * (frameTimeMs % period.toLong()) / period)).toFloat()
        invalidate()
    }

    override fun onSizeChanged(w: Int, h: Int, oldw: Int, oldh: Int) {
        cx = w / 2f
        cy = h / 2f
        radius = min(w, h) / 2f - stroke / 2f - tickGap - tickLong - dpf(4)
        oval.set(cx - radius, cy - radius, cx + radius, cy + radius)
        updateShaders()
        glow?.recycle()
        glow = null
        glowDirty = true
    }

    private fun updateShaders() {
        if (width == 0) return
        val colors = when (mode) {
            Mode.COUNTDOWN -> intArrayOf(Palette.CYAN, Palette.BLUE, Palette.VIOLET, Palette.VIOLET_LIGHT, Palette.CYAN)
            Mode.LIVE -> intArrayOf(Palette.VIOLET, Palette.PINK, Palette.VIOLET_LIGHT, Palette.BLUE, Palette.VIOLET)
            Mode.CELEBRATE -> intArrayOf(Palette.AMBER, Palette.PINK, Palette.VIOLET, Palette.CYAN, Palette.AMBER)
        }
        val positions = floatArrayOf(0f, 0.34f, 0.68f, 0.92f, 1f)
        arcPaint.shader = SweepGradient(cx, cy, colors, positions).apply {
            setLocalMatrix(Matrix().apply { setRotate(-90f, cx, cy) })
        }
        val haloColor = when (mode) {
            Mode.COUNTDOWN -> Palette.BLUE
            Mode.LIVE -> Palette.PINK
            Mode.CELEBRATE -> Palette.AMBER
        }
        haloPaint.shader = RadialGradient(
            cx, cy, radius + stroke * 2.2f,
            intArrayOf(Palette.withAlpha(haloColor, 0.20f), Palette.withAlpha(Palette.VIOLET, 0.10f), 0),
            floatArrayOf(0.55f, 0.85f, 1f),
            Shader.TileMode.CLAMP,
        )
        headGlowPaint.shader = RadialGradient(
            0f, 0f, stroke * 1.7f,
            intArrayOf(0xE6FFFFFF.toInt(), 0x66FFFFFF, 0),
            floatArrayOf(0f, 0.35f, 1f),
            Shader.TileMode.CLAMP,
        )
    }

    private fun isFull() = mode != Mode.COUNTDOWN || shown >= 0.9995f

    private fun ensureGlow() {
        if (width == 0 || height == 0) return
        val sweep = if (isFull()) 1f else shown
        if (!glowDirty && glow != null && abs(glowFor - sweep) < 0.004f) return
        // Rendered at half size: the blur hides the lower resolution and it is 4x cheaper.
        val bw = (width / 2).coerceAtLeast(1)
        val bh = (height / 2).coerceAtLeast(1)
        val bitmap = glow?.takeIf { it.width == bw && it.height == bh }
            ?: Bitmap.createBitmap(bw, bh, Bitmap.Config.ARGB_8888).also { glow = it }
        bitmap.eraseColor(0)
        val c = Canvas(bitmap)
        c.scale(0.5f, 0.5f)
        val p = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            style = Paint.Style.STROKE
            strokeWidth = stroke * 1.7f
            strokeCap = Paint.Cap.ROUND
            shader = arcPaint.shader
            maskFilter = BlurMaskFilter(dpf(15), BlurMaskFilter.Blur.NORMAL)
        }
        if (sweep >= 0.9995f) c.drawCircle(cx, cy, radius, p) else c.drawArc(oval, -90f, 360f * sweep, false, p)
        glowFor = sweep
        glowDirty = false
    }

    override fun onDraw(canvas: Canvas) {
        if (radius <= 0f) return
        val b = if (ambient) breath else 0.65f

        haloPaint.alpha = (150 + 105 * b).toInt()
        canvas.drawCircle(cx, cy, radius + stroke * 2.2f, haloPaint)

        drawTicks(canvas)
        canvas.drawCircle(cx, cy, radius, trackPaint)

        val full = isFull()
        val sweep = if (full) 360f else 360f * shown
        if (intro == null && sweep > 0.5f) {
            ensureGlow()
            glow?.let {
                glowPaint.alpha = (110 + 120 * b).toInt()
                glowDst.set(0f, 0f, width.toFloat(), height.toFloat())
                canvas.drawBitmap(it, null, glowDst, glowPaint)
            }
        }
        if (full) {
            canvas.drawCircle(cx, cy, radius, arcPaint.apply { strokeCap = Paint.Cap.BUTT })
            arcPaint.strokeCap = Paint.Cap.ROUND
        } else if (sweep > 0.5f) {
            canvas.drawArc(oval, -90f, sweep, false, arcPaint)
        }

        if (!full && shown > 0.002f) {
            val angle = Math.toRadians((-90f + sweep).toDouble())
            val hx = cx + radius * cos(angle).toFloat()
            val hy = cy + radius * sin(angle).toFloat()
            canvas.save()
            canvas.translate(hx, hy)
            headGlowPaint.alpha = (170 + 85 * b).toInt()
            canvas.drawCircle(0f, 0f, stroke * 1.7f, headGlowPaint)
            canvas.drawCircle(0f, 0f, stroke * 0.36f, headPaint)
            canvas.restore()
        }
    }

    /** Sixty ticks outside the ring; a bright comet tail marks the seconds. */
    private fun drawTicks(canvas: Canvas) {
        val inner = radius + stroke / 2f + tickGap
        val position = (secondsProvider().coerceIn(0f, 1f) * 60f).let { if (ambient) it else kotlin.math.floor(it) }
        val head = position.toInt() % 60
        for (i in 0 until 60) {
            val major = i % 5 == 0
            val length = if (major) tickLong else tickShort
            // Distance behind the moving head, for the comet tail.
            val behind = ((head - i) + 60) % 60 + (position - kotlin.math.floor(position))
            val tail = if (mode == Mode.COUNTDOWN && behind < 9f) 1f - behind / 9f else 0f
            val base = if (major) 0.26f else 0.12f
            val alpha = (base + (1f - base) * tail * tail).coerceAtMost(1f)
            tickPaint.color = if (tail > 0f) Palette.withAlpha(Palette.CYAN, alpha) else Palette.withAlpha(Palette.TEXT, alpha)
            tickPaint.strokeWidth = if (tail > 0.5f) dpf(2.2f) else dpf(1.6f)
            val a = Math.toRadians((i * 6.0) - 90.0)
            val ca = cos(a).toFloat()
            val sa = sin(a).toFloat()
            canvas.drawLine(cx + ca * inner, cy + sa * inner, cx + ca * (inner + length), cy + sa * (inner + length), tickPaint)
        }
    }

    override fun onAttachedToWindow() {
        super.onAttachedToWindow()
        if (introWhenAttached) {
            introWhenAttached = false
            val to = target
            target = -1f
            setProgress(to, animate = true)
        }
    }

    override fun onDetachedFromWindow() {
        introWhenAttached = false
        intro?.cancel()
        intro = null
        shown = target
        super.onDetachedFromWindow()
    }
}

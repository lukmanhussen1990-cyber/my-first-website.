package com.imran.examcountdown.ui.widgets

import android.animation.ValueAnimator
import android.content.Context
import android.graphics.Canvas
import android.graphics.LinearGradient
import android.graphics.Paint
import android.graphics.RectF
import android.graphics.Shader
import android.view.View
import android.view.animation.DecelerateInterpolator
import com.imran.examcountdown.ui.AmbientListener
import com.imran.examcountdown.ui.Palette
import com.imran.examcountdown.ui.dp
import com.imran.examcountdown.ui.dpf
import kotlin.math.sin

/** One segment per exam: done ones glow in a continuous blue-to-violet gradient. */
class SeasonProgressView(context: Context) : View(context), AmbientListener {

    enum class Segment { DONE, LIVE, TODAY, UPCOMING }

    var segments: List<Segment> = emptyList()
        set(value) {
            if (field == value) return
            field = value
            invalidate()
        }

    var ambient = false
    private var pulse = 0.5f
    private var reveal = 1f
    private val rect = RectF()
    private val gap = dpf(5)
    private val doneShader = Paint(Paint.ANTI_ALIAS_FLAG)
    private val livePaint = Paint(Paint.ANTI_ALIAS_FLAG)
    private val trackPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Palette.TRACK }
    private val todayStroke = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        style = Paint.Style.STROKE
        strokeWidth = dpf(1.5f)
        color = Palette.AMBER
    }
    private val todayFill = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Palette.withAlpha(Palette.AMBER, 0.16f) }

    init {
        importantForAccessibility = IMPORTANT_FOR_ACCESSIBILITY_NO
    }

    /** Fills the done segments one after another. */
    fun playReveal() {
        ValueAnimator.ofFloat(0f, 1f).apply {
            duration = 900
            interpolator = DecelerateInterpolator(1.6f)
            addUpdateListener {
                reveal = it.animatedValue as Float
                invalidate()
            }
            start()
        }
    }

    override fun onAmbientFrame(frameTimeMs: Long) {
        if (Segment.LIVE !in segments && Segment.TODAY !in segments) return
        pulse = (0.5 + 0.5 * sin(2 * Math.PI * (frameTimeMs % 1600L) / 1600.0)).toFloat()
        invalidate()
    }

    override fun onMeasure(widthMeasureSpec: Int, heightMeasureSpec: Int) {
        setMeasuredDimension(resolveSize(dp(200), widthMeasureSpec), resolveSize(dp(12), heightMeasureSpec))
    }

    override fun onSizeChanged(w: Int, h: Int, oldw: Int, oldh: Int) {
        doneShader.shader = LinearGradient(
            0f, 0f, w.toFloat(), 0f,
            intArrayOf(Palette.CYAN, Palette.BLUE, Palette.VIOLET),
            null, Shader.TileMode.CLAMP,
        )
        livePaint.shader = LinearGradient(
            0f, 0f, w.toFloat(), 0f,
            intArrayOf(Palette.VIOLET, Palette.PINK),
            null, Shader.TileMode.CLAMP,
        )
    }

    override fun onDraw(canvas: Canvas) {
        val n = segments.size
        if (n == 0) return
        val h = height.toFloat()
        val segW = (width - gap * (n - 1)) / n
        val radius = h / 2f
        val p = if (ambient) pulse else 0.7f
        for (i in 0 until n) {
            val left = i * (segW + gap)
            rect.set(left, 0f, left + segW, h)
            canvas.drawRoundRect(rect, radius, radius, trackPaint)
            // Staggered reveal: segment i fills during its slice of the animation.
            val local = ((reveal * n) - i).coerceIn(0f, 1f)
            when (segments[i]) {
                Segment.DONE -> if (local > 0f) {
                    rect.right = left + segW * local
                    canvas.drawRoundRect(rect, radius, radius, doneShader)
                }
                Segment.LIVE -> {
                    livePaint.alpha = (140 + 115 * p).toInt()
                    canvas.drawRoundRect(rect, radius, radius, livePaint)
                }
                Segment.TODAY -> {
                    todayFill.alpha = (25 + 40 * p).toInt()
                    canvas.drawRoundRect(rect, radius, radius, todayFill)
                    rect.inset(todayStroke.strokeWidth / 2, todayStroke.strokeWidth / 2)
                    canvas.drawRoundRect(rect, radius, radius, todayStroke)
                }
                Segment.UPCOMING -> Unit
            }
        }
    }
}

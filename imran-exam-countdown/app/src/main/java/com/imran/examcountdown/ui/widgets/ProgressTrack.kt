package com.imran.examcountdown.ui.widgets

import android.animation.ValueAnimator
import android.content.Context
import android.graphics.Canvas
import android.graphics.LinearGradient
import android.graphics.Matrix
import android.graphics.Paint
import android.graphics.RadialGradient
import android.graphics.RectF
import android.graphics.Shader
import android.view.View
import com.imran.examcountdown.ui.Spring
import com.imran.examcountdown.ui.Ui
import com.imran.examcountdown.ui.dp
import com.imran.examcountdown.ui.dpf
import kotlin.math.abs

/**
 * A thin rounded progress line. Its meaning is always explained by a caption beside it.
 *
 * The line is drawn centred in the view, which may be taller than the line itself: the room
 * around it holds the soft glow at the head of the fill. A highlight can sweep along the filled
 * part ([shimmer], 0..1, driven by the ambient clock; negative for none).
 */
class ProgressTrack(context: Context) : View(context) {

    var fillColor = Ui.c.gold
        set(value) {
            field = value
            glowShader = null
            invalidate()
        }

    /** Position of the travelling highlight along the fill (0..1), or negative for none. */
    var shimmer = -1f
        set(value) {
            if (field == value) return
            field = value
            if (shown > 0f) invalidate()
        }

    private var shown = 0f
    private var target = 0f
    private var animator: ValueAnimator? = null
    private val rect = RectF()
    private val track = Paint(Paint.ANTI_ALIAS_FLAG)
    private val fill = Paint(Paint.ANTI_ALIAS_FLAG)
    private val glow = Paint(Paint.ANTI_ALIAS_FLAG)
    private val shine = Paint(Paint.ANTI_ALIAS_FLAG)
    private val shineMatrix = Matrix()
    private var glowShader: RadialGradient? = null
    private val lineHeight = dpf(4)
    private val shineShader = LinearGradient(
        -dpf(28), 0f, dpf(28), 0f,
        intArrayOf(0x00FFFFFF, 0x99FFFFFF.toInt(), 0x00FFFFFF), null, Shader.TileMode.CLAMP,
    )

    init {
        importantForAccessibility = IMPORTANT_FOR_ACCESSIBILITY_NO
        shine.shader = shineShader
    }

    val fraction: Float get() = target

    /** Sets the fill (0..1). With [animate] it springs there; small per-second steps are drawn directly. */
    fun set(value: Float, animate: Boolean) {
        val v = value.coerceIn(0f, 1f)
        target = v
        if (animate && isAttachedToWindow && abs(v - shown) > 0.002f) {
            animator?.cancel()
            animator = ValueAnimator.ofFloat(shown, v).apply {
                duration = 900
                interpolator = Spring(0.8f)
                addUpdateListener {
                    shown = (it.animatedValue as Float).coerceIn(0f, 1f)
                    invalidate()
                }
                start()
            }
        } else if (animator?.isRunning != true) {
            shown = v
            invalidate()
        }
    }

    override fun onMeasure(widthMeasureSpec: Int, heightMeasureSpec: Int) {
        setMeasuredDimension(resolveSize(dp(200), widthMeasureSpec), resolveSize(dp(4), heightMeasureSpec))
    }

    override fun onDraw(canvas: Canvas) {
        val lh = minOf(lineHeight, height.toFloat())
        val top = (height - lh) / 2f
        val r = lh / 2f
        rect.set(0f, top, width.toFloat(), top + lh)
        track.color = Ui.c.track
        canvas.drawRoundRect(rect, r, r, track)
        if (shown <= 0f) return
        val end = (width * shown).coerceAtLeast(lh)
        rect.right = end
        fill.color = fillColor
        canvas.drawRoundRect(rect, r, r, fill)
        // A light sweeping along the fill.
        if (shimmer >= 0f && end > dpf(24)) {
            canvas.save()
            canvas.clipRect(rect)
            shineMatrix.setTranslate(-dpf(28) + (end + dpf(56)) * shimmer, 0f)
            shineShader.setLocalMatrix(shineMatrix)
            shine.alpha = if (Ui.c.dark) 110 else 150
            canvas.drawRect(rect, shine)
            canvas.restore()
        }
        // The head of the fill glows softly, when there's room around the line for it.
        val room = (height - lh) / 2f
        if (room >= dpf(3)) {
            val gr = room + r
            val shader = glowShader ?: RadialGradient(0f, 0f, 1f, Ui.withAlpha(fillColor, 0.55f), Ui.withAlpha(fillColor, 0f), Shader.TileMode.CLAMP).also { glowShader = it }
            glow.shader = shader
            canvas.save()
            canvas.translate(end - r, height / 2f)
            canvas.scale(gr * 1.6f, gr)
            canvas.drawCircle(0f, 0f, 1f, glow)
            canvas.restore()
            fill.color = Ui.withAlpha(if (Ui.c.dark) Ui.c.onGreen else 0xFFFFFFFF.toInt(), 0.9f)
            canvas.drawCircle(end - r, height / 2f, r * 0.55f, fill)
        }
    }
}

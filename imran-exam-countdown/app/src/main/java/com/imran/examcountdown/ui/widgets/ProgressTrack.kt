package com.imran.examcountdown.ui.widgets

import android.animation.ValueAnimator
import android.content.Context
import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.RectF
import android.view.View
import android.view.animation.DecelerateInterpolator
import com.imran.examcountdown.ui.Ui
import com.imran.examcountdown.ui.dp
import kotlin.math.abs

/** A thin rounded progress line. Its meaning is always explained by a caption beside it. */
class ProgressTrack(context: Context) : View(context) {

    var fillColor = Ui.c.gold
        set(value) {
            field = value
            invalidate()
        }

    private var shown = 0f
    private var target = 0f
    private var animator: ValueAnimator? = null
    private val rect = RectF()
    private val track = Paint(Paint.ANTI_ALIAS_FLAG)
    private val fill = Paint(Paint.ANTI_ALIAS_FLAG)

    init {
        importantForAccessibility = IMPORTANT_FOR_ACCESSIBILITY_NO
    }

    val fraction: Float get() = target

    /** Sets the fill (0..1). With [animate] it glides there; small per-second steps are drawn directly. */
    fun set(value: Float, animate: Boolean) {
        val v = value.coerceIn(0f, 1f)
        target = v
        if (animate && isAttachedToWindow && abs(v - shown) > 0.002f) {
            animator?.cancel()
            animator = ValueAnimator.ofFloat(shown, v).apply {
                duration = 700
                interpolator = DecelerateInterpolator(1.6f)
                addUpdateListener {
                    shown = it.animatedValue as Float
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
        val h = height.toFloat()
        rect.set(0f, 0f, width.toFloat(), h)
        track.color = Ui.c.track
        canvas.drawRoundRect(rect, h / 2, h / 2, track)
        if (shown > 0f) {
            rect.right = (width * shown).coerceAtLeast(h)
            fill.color = fillColor
            canvas.drawRoundRect(rect, h / 2, h / 2, fill)
        }
    }
}

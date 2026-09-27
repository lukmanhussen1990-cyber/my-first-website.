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
import com.imran.examcountdown.ui.dpf

/** One short bar per exam: green when done, gold for today or the paper in progress. */
class SeasonProgressView(context: Context) : View(context) {

    enum class Segment { DONE, LIVE, TODAY, UPCOMING }

    var segments: List<Segment> = emptyList()
        set(value) {
            if (field == value) return
            field = value
            invalidate()
        }

    private var reveal = 1f
    private val rect = RectF()
    private val gap = dpf(4)
    private val paint = Paint(Paint.ANTI_ALIAS_FLAG)
    private val stroke = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        style = Paint.Style.STROKE
        strokeWidth = dpf(1.5f)
    }

    init {
        importantForAccessibility = IMPORTANT_FOR_ACCESSIBILITY_NO
    }

    /** Fills the done segments one after another. */
    fun playReveal() {
        ValueAnimator.ofFloat(0f, 1f).apply {
            duration = 700
            interpolator = DecelerateInterpolator(1.4f)
            addUpdateListener {
                reveal = it.animatedValue as Float
                invalidate()
            }
            start()
        }
    }

    override fun onMeasure(widthMeasureSpec: Int, heightMeasureSpec: Int) {
        setMeasuredDimension(resolveSize(dp(200), widthMeasureSpec), resolveSize(dp(6), heightMeasureSpec))
    }

    override fun onDraw(canvas: Canvas) {
        val n = segments.size
        if (n == 0) return
        val c = Ui.c
        val h = height.toFloat()
        val w = (width - gap * (n - 1)) / n
        val r = h / 2f
        for (i in 0 until n) {
            val left = i * (w + gap)
            rect.set(left, 0f, left + w, h)
            paint.color = c.track
            canvas.drawRoundRect(rect, r, r, paint)
            val local = ((reveal * n) - i).coerceIn(0f, 1f)
            when (segments[i]) {
                Segment.DONE -> if (local > 0f) {
                    rect.right = left + w * local
                    paint.color = c.green
                    canvas.drawRoundRect(rect, r, r, paint)
                }
                Segment.LIVE -> {
                    paint.color = c.gold
                    canvas.drawRoundRect(rect, r, r, paint)
                }
                Segment.TODAY -> {
                    stroke.color = c.gold
                    rect.inset(stroke.strokeWidth / 2, stroke.strokeWidth / 2)
                    canvas.drawRoundRect(rect, r, r, stroke)
                }
                Segment.UPCOMING -> Unit
            }
        }
    }
}

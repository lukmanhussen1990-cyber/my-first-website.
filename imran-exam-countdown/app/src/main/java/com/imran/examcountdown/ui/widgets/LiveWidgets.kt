package com.imran.examcountdown.ui.widgets

import android.content.Context
import android.graphics.Canvas
import android.graphics.LinearGradient
import android.graphics.Matrix
import android.graphics.Paint
import android.graphics.Path
import android.graphics.RectF
import android.graphics.Shader
import android.view.View
import android.widget.LinearLayout
import com.imran.examcountdown.ui.Ease
import com.imran.examcountdown.ui.Ui
import com.imran.examcountdown.ui.dpf
import com.imran.examcountdown.ui.window
import kotlin.math.sin

/**
 * A status dot that sends out radar pings, for "exam in progress". [phase] (0..1) is one ping,
 * driven by the ambient clock; negative keeps it still (a plain dot).
 */
class PulseDot(context: Context, private val color: Int) : View(context) {

    var phase = -1f
        set(value) {
            if (field == value) return
            field = value
            invalidate()
        }

    private val dot = Paint(Paint.ANTI_ALIAS_FLAG)
    private val ring = Paint(Paint.ANTI_ALIAS_FLAG).apply { style = Paint.Style.STROKE }

    init {
        importantForAccessibility = IMPORTANT_FOR_ACCESSIBILITY_NO
    }

    override fun onDraw(canvas: Canvas) {
        val cx = width / 2f
        val cy = height / 2f
        val r = dpf(4)
        val reach = minOf(cx, cy) - dpf(1)
        if (phase >= 0f) {
            // Two pings, half a cycle apart, rolling outward and fading.
            for (k in 0..1) {
                val p = (phase + k * 0.5f) % 1f
                val e = Ease.cubicOut(p)
                ring.strokeWidth = dpf(1.6f) * (1f - p) + dpf(0.4f)
                ring.color = Ui.withAlpha(color, 0.7f * (1f - p))
                canvas.drawCircle(cx, cy, r + (reach - r) * e, ring)
            }
        }
        dot.color = color
        val breath = if (phase >= 0f) 1f + 0.12f * sin(phase * 6.283f) else 1f
        canvas.drawCircle(cx, cy, r * breath, dot)
    }
}

/**
 * A rounded card whose surface catches the light: every few seconds a soft diagonal glint
 * sweeps across it, under its content. [sheen] (0..1) is one cycle; negative for none.
 */
class SheenCard(context: Context, private val radiusDp: Float) : LinearLayout(context) {

    var sheen = -1f
        set(value) {
            if (field == value) return
            field = value
            if (value in 0f..SWEEP) invalidate() else if (field != -1f && lastDrawn) invalidate()
        }

    private var lastDrawn = false
    private val clip = Path()
    private val box = RectF()
    private val paint = Paint(Paint.ANTI_ALIAS_FLAG)
    private val matrix = Matrix()
    private val shader = LinearGradient(
        -dpf(60), 0f, dpf(60), 0f,
        intArrayOf(0x00FFFFFF, 0x2EFFFFFF, 0x00FFFFFF), null, Shader.TileMode.CLAMP,
    )

    init {
        paint.shader = shader
    }

    override fun dispatchDraw(canvas: Canvas) {
        val p = if (sheen >= 0f) window(sheen, 0f, SWEEP) else 0f
        lastDrawn = p > 0f && p < 1f
        if (lastDrawn) {
            val w = width.toFloat()
            val h = height.toFloat()
            box.set(0f, 0f, w, h)
            clip.reset()
            clip.addRoundRect(box, dpf(radiusDp), dpf(radiusDp), Path.Direction.CW)
            canvas.save()
            canvas.clipPath(clip)
            matrix.setTranslate(-dpf(60) + (w + dpf(120)) * Ease.cubicInOut(p), 0f)
            matrix.postRotate(-20f, w / 2f, h / 2f)
            shader.setLocalMatrix(matrix)
            canvas.drawRect(box, paint)
            canvas.restore()
        }
        super.dispatchDraw(canvas)
    }

    companion object {
        /** Part of each cycle taken by the sweep; the rest is a pause. */
        private const val SWEEP = 0.32f
    }
}

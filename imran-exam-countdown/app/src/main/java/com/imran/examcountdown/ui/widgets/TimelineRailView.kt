package com.imran.examcountdown.ui.widgets

import android.content.Context
import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.Path
import android.view.View
import com.imran.examcountdown.ui.Ui
import com.imran.examcountdown.ui.dpf

/** The thin vertical line and node for one timetable row. */
class TimelineRailView(context: Context) : View(context) {

    enum class Node { DONE, LIVE, TODAY, UPCOMING }

    var node = Node.UPCOMING
    var hasTop = true
    var hasBottom = true

    /** Line above the node is green (the previous exam is done). */
    var topLit = false

    /** Line below the node is green (this exam is done). */
    var bottomLit = false

    /** Vertical centre of the node, from the top of the row. */
    var nodeY = dpf(22)

    /** 0..1 gentle pulse for the live/today node; driven by the host. */
    var pulse = 0f
        set(value) {
            field = value
            if (node == Node.LIVE || node == Node.TODAY) invalidate()
        }

    /** 0..1 portion of the rail drawn, for the entrance animation. */
    var reveal = 1f
        set(value) {
            field = value
            invalidate()
        }

    private val nodeRadius = dpf(8)
    private val line = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        strokeWidth = dpf(2f)
        strokeCap = Paint.Cap.ROUND
    }
    private val fill = Paint(Paint.ANTI_ALIAS_FLAG)
    private val ring = Paint(Paint.ANTI_ALIAS_FLAG).apply { style = Paint.Style.STROKE }
    private val check = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        style = Paint.Style.STROKE
        strokeWidth = dpf(1.8f)
        strokeCap = Paint.Cap.ROUND
        strokeJoin = Paint.Join.ROUND
    }
    private val checkPath = Path()

    init {
        importantForAccessibility = IMPORTANT_FOR_ACCESSIBILITY_NO
    }

    override fun onDraw(canvas: Canvas) {
        val c = Ui.c
        val x = width / 2f
        val drawnTo = height * reveal
        val gapAround = nodeRadius + dpf(4)
        if (hasTop) {
            val end = (nodeY - gapAround).coerceAtMost(drawnTo)
            if (end > 0f) {
                line.color = if (topLit) c.green else c.separator
                canvas.drawLine(x, 0f, x, end, line)
            }
        }
        if (hasBottom && drawnTo > nodeY + gapAround) {
            line.color = if (bottomLit) c.green else c.separator
            canvas.drawLine(x, nodeY + gapAround, x, drawnTo, line)
        }
        if (reveal < 0.1f) return
        val s = ((reveal - 0.1f) / 0.25f).coerceIn(0f, 1f)
        canvas.save()
        canvas.translate(x, nodeY)
        canvas.scale(s, s)
        when (node) {
            Node.DONE -> {
                fill.color = c.green
                canvas.drawCircle(0f, 0f, nodeRadius, fill)
                val r = nodeRadius
                checkPath.reset()
                checkPath.moveTo(-r * 0.42f, r * 0.02f)
                checkPath.lineTo(-r * 0.1f, r * 0.34f)
                checkPath.lineTo(r * 0.45f, -r * 0.3f)
                check.color = c.onGreen
                canvas.drawPath(checkPath, check)
            }
            Node.LIVE -> {
                drawPulse(canvas, c.gold)
                fill.color = c.gold
                canvas.drawCircle(0f, 0f, nodeRadius, fill)
            }
            Node.TODAY -> {
                drawPulse(canvas, c.gold)
                fill.color = c.bg
                canvas.drawCircle(0f, 0f, nodeRadius, fill)
                ring.color = c.gold
                ring.strokeWidth = dpf(2.2f)
                canvas.drawCircle(0f, 0f, nodeRadius - dpf(1.1f), ring)
            }
            Node.UPCOMING -> {
                fill.color = c.bg
                canvas.drawCircle(0f, 0f, nodeRadius, fill)
                ring.color = c.text3
                ring.strokeWidth = dpf(1.5f)
                canvas.drawCircle(0f, 0f, nodeRadius * 0.7f, ring)
            }
        }
        canvas.restore()
    }

    private fun drawPulse(canvas: Canvas, color: Int) {
        if (pulse <= 0f) return
        ring.color = Ui.withAlpha(color, 0.35f * (1f - pulse))
        ring.strokeWidth = dpf(1.5f)
        canvas.drawCircle(0f, 0f, nodeRadius + dpf(7) * pulse, ring)
    }
}

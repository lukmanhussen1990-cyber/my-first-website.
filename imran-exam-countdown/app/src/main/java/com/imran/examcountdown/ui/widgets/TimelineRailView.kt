package com.imran.examcountdown.ui.widgets

import android.content.Context
import android.graphics.Canvas
import android.graphics.LinearGradient
import android.graphics.Paint
import android.graphics.Path
import android.graphics.Shader
import android.view.View
import com.imran.examcountdown.ui.Palette
import com.imran.examcountdown.ui.dpf

/** The vertical line and node for one timeline row. */
class TimelineRailView(context: Context) : View(context) {

    enum class Node { DONE, LIVE, TODAY, UPCOMING }

    var node = Node.UPCOMING
    var hasTop = true
    var hasBottom = true

    /** Line above the node is bright (the previous exam is done). */
    var topLit = false

    /** Line below the node is bright (this exam is done). */
    var bottomLit = false

    /** Vertical centre of the node, from the top of the row. */
    var nodeY = dpf(30)

    /** 0..1 pulse for live/today nodes; set by the host from the ambient clock. */
    var pulse = 0f
        set(value) {
            field = value
            if (node == Node.LIVE || node == Node.TODAY) invalidate()
        }

    /** 0..1: how much of the rail is drawn, for the entrance animation. */
    var reveal = 1f
        set(value) {
            field = value
            invalidate()
        }

    private val lineWidth = dpf(2.5f)
    private val nodeRadius = dpf(12)
    private val dimPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Palette.TRACK
        strokeWidth = lineWidth
        strokeCap = Paint.Cap.ROUND
    }
    private val litPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        strokeWidth = lineWidth
        strokeCap = Paint.Cap.ROUND
    }
    private val fill = Paint(Paint.ANTI_ALIAS_FLAG)
    private val ring = Paint(Paint.ANTI_ALIAS_FLAG).apply { style = Paint.Style.STROKE }
    private val check = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        style = Paint.Style.STROKE
        strokeWidth = dpf(2.4f)
        strokeCap = Paint.Cap.ROUND
        strokeJoin = Paint.Join.ROUND
        color = Palette.BG_TOP
    }
    private val checkPath = Path()

    // Node shaders are in node-local coordinates (the canvas is translated to the node).
    private val doneShader = LinearGradient(-nodeRadius, -nodeRadius, nodeRadius, nodeRadius, Palette.GREEN, Palette.CYAN, Shader.TileMode.CLAMP)
    private val liveShader = LinearGradient(-nodeRadius, -nodeRadius, nodeRadius, nodeRadius, Palette.VIOLET, Palette.PINK, Shader.TileMode.CLAMP)

    init {
        importantForAccessibility = IMPORTANT_FOR_ACCESSIBILITY_NO
    }

    override fun onSizeChanged(w: Int, h: Int, oldw: Int, oldh: Int) {
        litPaint.shader = LinearGradient(0f, 0f, 0f, h.toFloat(), Palette.CYAN, Palette.VIOLET, Shader.TileMode.CLAMP)
    }

    override fun onDraw(canvas: Canvas) {
        val x = width / 2f
        val h = height.toFloat()
        val drawnTo = h * reveal
        val gapAroundNode = nodeRadius + dpf(4)
        if (hasTop) {
            val end = (nodeY - gapAroundNode).coerceAtMost(drawnTo)
            if (end > 0f) canvas.drawLine(x, 0f, x, end, if (topLit) litPaint else dimPaint)
        }
        if (hasBottom && drawnTo > nodeY + gapAroundNode) {
            canvas.drawLine(x, nodeY + gapAroundNode, x, drawnTo, if (bottomLit) litPaint else dimPaint)
        }
        if (reveal < 0.15f) return
        val scale = ((reveal - 0.15f) / 0.25f).coerceIn(0f, 1f)
        canvas.save()
        canvas.translate(x, nodeY)
        canvas.scale(scale, scale)
        when (node) {
            Node.DONE -> {
                fill.shader = doneShader
                canvas.drawCircle(0f, 0f, nodeRadius, fill)
                fill.shader = null
                val r = nodeRadius
                checkPath.reset()
                checkPath.moveTo(-r * 0.42f, r * 0.02f)
                checkPath.lineTo(-r * 0.1f, r * 0.34f)
                checkPath.lineTo(r * 0.45f, -r * 0.3f)
                canvas.drawPath(checkPath, check)
            }
            Node.LIVE -> {
                drawPulse(canvas, Palette.PINK)
                fill.shader = liveShader
                canvas.drawCircle(0f, 0f, nodeRadius, fill)
                fill.shader = null
                fill.color = Palette.WHITE
                canvas.drawCircle(0f, 0f, nodeRadius * 0.34f, fill)
            }
            Node.TODAY -> {
                drawPulse(canvas, Palette.AMBER)
                fill.color = Palette.withAlpha(Palette.AMBER, 0.18f)
                canvas.drawCircle(0f, 0f, nodeRadius, fill)
                ring.color = Palette.AMBER
                ring.strokeWidth = dpf(2.2f)
                canvas.drawCircle(0f, 0f, nodeRadius - dpf(1.1f), ring)
                fill.color = Palette.AMBER
                canvas.drawCircle(0f, 0f, nodeRadius * 0.34f, fill)
            }
            Node.UPCOMING -> {
                fill.color = Palette.BG_MID
                canvas.drawCircle(0f, 0f, nodeRadius * 0.85f, fill)
                ring.color = Palette.withAlpha(Palette.TEXT, 0.28f)
                ring.strokeWidth = dpf(2f)
                canvas.drawCircle(0f, 0f, nodeRadius * 0.8f, ring)
                fill.color = Palette.withAlpha(Palette.TEXT, 0.38f)
                canvas.drawCircle(0f, 0f, nodeRadius * 0.24f, fill)
            }
        }
        canvas.restore()
    }

    private fun drawPulse(canvas: Canvas, color: Int) {
        val r = nodeRadius + dpf(9) * pulse
        ring.color = Palette.withAlpha(color, 0.45f * (1f - pulse))
        ring.strokeWidth = dpf(2f)
        canvas.drawCircle(0f, 0f, r, ring)
    }
}

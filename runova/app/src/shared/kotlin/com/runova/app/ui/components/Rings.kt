package com.runova.app.ui.components

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxScope
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.rotate
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.runova.app.ui.theme.Runova
import kotlin.math.cos
import kotlin.math.min
import kotlin.math.sin

/**
 * Circular progress ring with a gradient arc, rounded caps and a neon glow. The arc animates
 * from zero whenever [progress] changes.
 */
@Composable
fun ProgressRing(
    progress: Float,
    modifier: Modifier = Modifier,
    strokeWidth: Dp = 22.dp,
    colors: List<Color> = listOf(Runova.colors.limeDeep, Runova.colors.lime),
    trackColor: Color = Runova.colors.track,
    glow: Boolean = Runova.colors.isDark,
    glowPadding: Dp = 14.dp,
    durationMs: Int = 1400,
    content: @Composable BoxScope.() -> Unit = {},
) {
    val anim = remember { Animatable(0f) }
    LaunchedEffect(progress) {
        anim.animateTo(progress.coerceIn(0f, 1f), tween(durationMs, easing = FastOutSlowInEasing))
    }
    Box(modifier, contentAlignment = Alignment.Center) {
        Canvas(Modifier.fillMaxSize()) {
            drawRing(anim.value, strokeWidth.toPx(), colors, trackColor, if (glow) glowPadding.toPx() else 0f)
        }
        content()
    }
}

internal fun DrawScope.drawRing(p: Float, stroke: Float, colors: List<Color>, track: Color, glowPad: Float) {
    val diameter = min(size.width, size.height) - stroke - glowPad * 2
    if (diameter <= 0f) return
    val radius = diameter / 2f
    val topLeft = Offset(center.x - radius, center.y - radius)
    val arcSize = Size(diameter, diameter)
    drawCircle(track, radius = radius, center = center, style = Stroke(stroke))
    if (p <= 0.0005f) return
    val sweep = 360f * p
    rotate(-90f, center) {
        val end = colors.last()
        val start = colors.first()
        val brush = Brush.sweepGradient(
            0f to start,
            (p * 0.999f).coerceAtLeast(0.001f) to end,
            1f to start,
            center = center,
        )
        if (glowPad > 0f) {
            for (k in 8 downTo 1) {
                val extra = glowPad * 1.8f * k / 8f
                val alpha = 0.035f
                drawArc(
                    color = end.copy(alpha = alpha),
                    startAngle = 0f,
                    sweepAngle = sweep,
                    useCenter = false,
                    topLeft = topLeft,
                    size = arcSize,
                    style = Stroke(stroke + extra, cap = StrokeCap.Round),
                )
            }
        }
        drawArc(brush, 0f, sweep, false, topLeft, arcSize, style = Stroke(stroke, cap = StrokeCap.Round))
        // soft highlight on the leading cap
        val a = Math.toRadians(sweep.toDouble())
        val cx = center.x + radius * cos(a).toFloat()
        val cy = center.y + radius * sin(a).toFloat()
        drawCircle(
            Brush.radialGradient(listOf(Color.White.copy(alpha = 0.35f), Color.Transparent), center = Offset(cx, cy), radius = stroke * 0.7f),
            radius = stroke * 0.7f,
            center = Offset(cx, cy),
        )
    }
}

/** Compact ring used in goal cards. */
@Composable
fun GoalRing(progress: Float, color: Color, modifier: Modifier = Modifier, strokeWidth: Dp = 9.dp, content: @Composable BoxScope.() -> Unit = {}) {
    ProgressRing(
        progress = progress,
        modifier = modifier,
        strokeWidth = strokeWidth,
        colors = listOf(color.copy(alpha = 0.85f), color),
        glowPadding = 4.dp,
        durationMs = 1200,
        content = content,
    )
}

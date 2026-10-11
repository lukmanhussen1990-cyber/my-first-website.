package com.imran.jarvis.ui.components

import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Mic
import androidx.compose.material3.Icon
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import com.imran.jarvis.ui.theme.JarvisColors

/**
 * The big round microphone button with thin circuit lines running out to both sides.
 * While listening, rings pulse outwards from the button.
 */
@Composable
fun MicButtonBar(listening: Boolean, onClick: () -> Unit, modifier: Modifier = Modifier) {
    Box(
        modifier = modifier
            .fillMaxWidth()
            .height(112.dp),
        contentAlignment = Alignment.Center,
    ) {
        CircuitLines()
        MicButton(listening = listening, onClick = onClick)
    }
}

@Composable
fun MicButton(listening: Boolean, onClick: () -> Unit, modifier: Modifier = Modifier) {
    val transition = rememberInfiniteTransition(label = "micPulse")
    val t by transition.animateFloat(
        initialValue = 0f,
        targetValue = 1f,
        animationSpec = infiniteRepeatable(tween(1800, easing = LinearEasing), RepeatMode.Restart),
        label = "micPulseT",
    )

    Box(modifier = modifier.size(112.dp), contentAlignment = Alignment.Center) {
        Canvas(modifier = Modifier.size(112.dp)) {
            val c = center
            val r = 38.dp.toPx()

            // Outer glow
            drawCircle(
                brush = Brush.radialGradient(
                    listOf(JarvisColors.Cyan.copy(alpha = 0.42f), JarvisColors.Cyan.copy(alpha = 0.10f), Color.Transparent),
                    center = c,
                    radius = r * 1.45f,
                ),
                radius = r * 1.45f,
                center = c,
            )

            // Pulses while listening
            if (listening) {
                for (k in 0..1) {
                    val p = (t + k * 0.5f) % 1f
                    drawCircle(
                        color = JarvisColors.Cyan.copy(alpha = (1f - p) * 0.55f),
                        radius = r * (1f + 0.42f * p),
                        center = c,
                        style = Stroke(2.dp.toPx()),
                    )
                }
            }

            // Dark inside
            drawCircle(
                brush = Brush.radialGradient(listOf(Color(0xFF0B2C52), Color(0xFF05122A)), center = c, radius = r),
                radius = r,
                center = c,
            )

            // Bright ring
            drawCircle(
                brush = Brush.sweepGradient(
                    listOf(
                        JarvisColors.CyanBright,
                        JarvisColors.Cyan,
                        JarvisColors.Blue,
                        JarvisColors.Cyan,
                        JarvisColors.CyanBright,
                    ),
                    center = c,
                ),
                radius = r,
                center = c,
                style = Stroke(3.2.dp.toPx()),
            )
        }

        Box(
            modifier = Modifier
                .size(76.dp)
                .clip(CircleShape)
                .semantics { contentDescription = "Tap to speak" }
                .clickable(onClick = onClick),
            contentAlignment = Alignment.Center,
        ) {
            Icon(
                imageVector = Icons.Filled.Mic,
                contentDescription = null,
                tint = JarvisColors.CyanBright,
                modifier = Modifier.size(40.dp),
            )
        }
    }
}

/** The decorative "circuit board" traces on both sides of the mic button. */
@Composable
private fun CircuitLines() {
    Canvas(modifier = Modifier.fillMaxWidth().height(112.dp)) {
        val cx = size.width / 2f
        val cy = size.height / 2f
        val color = JarvisColors.Cyan.copy(alpha = 0.35f)
        val stroke = Stroke(1.2.dp.toPx(), join = StrokeJoin.Round)

        for (sign in listOf(-1f, 1f)) {
            fun point(dx: Float, dy: Float) = Offset(cx + sign * dx.dp.toPx(), cy + dy.dp.toPx())

            // Upper and lower traces: run in from the screen edge, bend towards the button
            for (side in listOf(-1f, 1f)) {
                val path = Path().apply {
                    moveTo(cx + sign * size.width / 2f, cy + side * 18.dp.toPx())
                    val start = point(150f, side * 18f)
                    lineTo(start.x, start.y)
                    val bend = point(104f, side * 18f)
                    lineTo(bend.x, bend.y)
                    val corner = point(84f, side * 2f)
                    lineTo(corner.x, corner.y)
                    val end = point(58f, side * 2f)
                    lineTo(end.x, end.y)
                }
                drawPath(path, color, style = stroke)
                drawDot(point(58f, side * 2f), color)
                drawDot(point(104f, side * 18f), color)
            }
            // A short extra branch
            val branch = Path().apply {
                val a = point(120f, 30f)
                moveTo(a.x, a.y)
                val b = point(96f, 30f)
                lineTo(b.x, b.y)
                val c2 = point(80f, 16f)
                lineTo(c2.x, c2.y)
            }
            drawPath(branch, color.copy(alpha = 0.22f), style = stroke)
        }
    }
}

private fun DrawScope.drawDot(at: Offset, color: Color) {
    drawCircle(color.copy(alpha = 0.8f), radius = 2.dp.toPx(), center = at)
}

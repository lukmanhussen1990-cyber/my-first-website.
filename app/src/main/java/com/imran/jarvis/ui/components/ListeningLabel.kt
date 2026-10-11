package com.imran.jarvis.ui.components

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.FloatState
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.withFrameNanos
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.unit.dp
import com.imran.jarvis.ui.theme.JarvisColors
import com.imran.jarvis.ui.theme.glowStyle
import kotlin.math.PI
import kotlin.math.min
import kotlin.math.pow
import kotlin.math.sin

/**
 * "~~~~ Listening... ~~~~": a glowing label with a moving sound-wave line on both sides.
 * The wave follows the voice while listening, and ripples gently while thinking or speaking.
 */
@Composable
fun ListeningLabel(
    state: OrbState,
    label: String,
    level: () -> Float,
    modifier: Modifier = Modifier,
) {
    val currentState by rememberUpdatedState(state)
    val currentLevel by rememberUpdatedState(level)
    val phase = remember { mutableFloatStateOf(0f) }
    val smooth = remember { mutableFloatStateOf(0f) }

    LaunchedEffect(Unit) {
        var last = withFrameNanos { it }
        while (true) {
            val now = withFrameNanos { it }
            val dt = ((now - last) / 1_000_000_000f).coerceIn(0f, 0.05f)
            last = now
            phase.floatValue += dt * 7f
            val target = when (currentState) {
                OrbState.Listening -> currentLevel()
                OrbState.Speaking -> 0.5f + 0.35f * sin(phase.floatValue * 0.9f)
                OrbState.Thinking -> 0.28f + 0.15f * sin(phase.floatValue * 0.6f)
                OrbState.Idle -> 0.05f
            }
            val rate = if (target > smooth.floatValue) 14f else 5f
            smooth.floatValue += (target - smooth.floatValue) * min(1f, dt * rate)
        }
    }

    Row(
        modifier = modifier.fillMaxWidth(),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        WaveSide(phase, smooth, mirrored = false, modifier = Modifier.weight(1f).height(40.dp))
        Text(text = label, style = glowStyle(20f), modifier = Modifier.padding(horizontal = 14.dp))
        WaveSide(phase, smooth, mirrored = true, modifier = Modifier.weight(1f).height(40.dp))
    }
}

/** One half of the wave. The wave is strongest next to the text and fades away towards the screen edge. */
@Composable
private fun WaveSide(phase: FloatState, level: FloatState, mirrored: Boolean, modifier: Modifier) {
    Canvas(modifier = modifier) {
        val width = size.width
        val mid = size.height / 2f
        val amplitude = size.height * 0.46f * (0.18f + 0.82f * level.floatValue)
        val twoPi = 2f * PI.toFloat()

        val path = Path()
        val steps = 90
        for (i in 0..steps) {
            val x = width * i / steps
            // 0 at the screen edge, 1 right next to the text
            val t = if (mirrored) 1f - i / steps.toFloat() else i / steps.toFloat()
            val envelope = t.pow(2.2f)
            val wave = 0.6f * sin(twoPi * 3.2f * t + phase.floatValue) +
                0.4f * sin(twoPi * 6.1f * t - phase.floatValue * 1.3f)
            val y = mid - amplitude * envelope * wave
            if (i == 0) path.moveTo(x, y) else path.lineTo(x, y)
        }

        // Faint straight line underneath, then the wave drawn three times for a glow
        drawLine(
            color = JarvisColors.Cyan.copy(alpha = 0.30f),
            start = Offset(0f, mid),
            end = Offset(width, mid),
            strokeWidth = 1.dp.toPx(),
        )
        val round = { w: Float -> Stroke(w, cap = StrokeCap.Round, join = StrokeJoin.Round) }
        drawPath(path, JarvisColors.Cyan.copy(alpha = 0.16f), style = round(6.dp.toPx()))
        drawPath(path, JarvisColors.Cyan.copy(alpha = 0.35f), style = round(3.dp.toPx()))
        drawPath(path, JarvisColors.CyanBright, style = round(1.4.dp.toPx()))
    }
}

package com.imran.jarvis.ui.components

import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.Stable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.BlendMode
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.clipPath
import androidx.compose.ui.unit.dp
import androidx.compose.runtime.withFrameNanos
import com.imran.jarvis.data.Phase
import com.imran.jarvis.ui.theme.JarvisColors
import kotlin.math.PI
import kotlin.math.cos
import kotlin.math.min
import kotlin.math.pow
import kotlin.math.sin

/** What the orb should look like: calm, alert, busy or talking. */
enum class OrbState { Idle, Listening, Thinking, Speaking }

fun Phase.toOrbState(): OrbState = when (this) {
    Phase.Idle -> OrbState.Idle
    Phase.Listening -> OrbState.Listening
    Phase.Thinking -> OrbState.Thinking
    Phase.Speaking -> OrbState.Speaking
}

/**
 * Time values that make the orb move. They are advanced once per frame and only READ while drawing,
 * so Compose redraws just the orb instead of re-running the whole screen 60 times a second.
 */
@Stable
class OrbClock {
    var flow by mutableFloatStateOf(0f)
    var spin by mutableFloatStateOf(0f)
    var breath by mutableFloatStateOf(0f)
    var level by mutableFloatStateOf(0f)

    fun advance(dt: Float, spinSpeed: Float, breathSpeed: Float, targetLevel: Float) {
        flow += dt * (0.30f + 0.22f * spinSpeed)
        spin = (spin + dt * 8f * spinSpeed) % 360f
        breath += dt * breathSpeed
        // React quickly to a louder voice, fall back slowly.
        val rate = if (targetLevel > level) 16f else 5f
        level += (targetLevel - level) * min(1f, dt * rate)
    }
}

/**
 * The glowing blue orb. [level] gives the voice loudness (0..1) and is read every frame.
 *
 * Idle: slow gentle pulse. Listening: bigger, brighter, reacts to the voice. Thinking: swirls faster.
 * Speaking: pulses with the spoken words.
 */
@Composable
fun JarvisOrb(state: OrbState, level: () -> Float, modifier: Modifier = Modifier) {
    val currentState by rememberUpdatedState(state)
    val currentLevel by rememberUpdatedState(level)

    val energy = animateFloatAsState(
        targetValue = when (state) {
            OrbState.Idle -> 0f
            OrbState.Listening -> 1f
            OrbState.Thinking -> 0.55f
            OrbState.Speaking -> 0.75f
        },
        animationSpec = tween(700),
        label = "orbEnergy",
    )
    val spinSpeed = animateFloatAsState(
        targetValue = when (state) {
            OrbState.Idle -> 1f
            OrbState.Listening -> 2.2f
            OrbState.Thinking -> 4.2f
            OrbState.Speaking -> 2.0f
        },
        animationSpec = tween(700),
        label = "orbSpin",
    )
    val breathSpeed = animateFloatAsState(
        targetValue = when (state) {
            OrbState.Idle -> 1.5f // one slow breath every ~4 seconds
            OrbState.Listening -> 4.5f
            OrbState.Thinking -> 3.6f
            OrbState.Speaking -> 6.5f
        },
        animationSpec = tween(700),
        label = "orbBreath",
    )

    val clock = remember { OrbClock() }
    LaunchedEffect(clock) {
        var last = withFrameNanos { it }
        while (true) {
            val now = withFrameNanos { it }
            val dt = ((now - last) / 1_000_000_000f).coerceIn(0f, 0.05f)
            last = now
            val target = when (currentState) {
                OrbState.Listening -> currentLevel()
                OrbState.Speaking -> 0.45f + 0.35f * (sin(clock.breath * 2.1f) * 0.5f + 0.5f)
                OrbState.Thinking -> 0.25f + 0.15f * (sin(clock.breath * 1.3f) * 0.5f + 0.5f)
                OrbState.Idle -> 0f
            }
            clock.advance(dt, spinSpeed.value, breathSpeed.value, target)
        }
    }

    Canvas(modifier = modifier.aspectRatio(1f)) {
        drawOrb(clock, energy.value)
    }
}

/** A small, still orb used as JARVIS's avatar in chat bubbles and the menu. */
@Composable
fun MiniOrb(modifier: Modifier = Modifier) {
    Canvas(modifier = modifier.aspectRatio(1f)) {
        val s = size.minDimension
        drawCircle(
            brush = Brush.radialGradient(
                listOf(JarvisColors.Cyan.copy(alpha = 0.40f), Color.Transparent),
                center = center,
                radius = s * 0.5f,
            ),
            radius = s * 0.5f,
            center = center,
        )
        drawSphere(center, s * 0.34f, flow = 1.2f, glow = 0.6f)
    }
}

// ------------------------------------------------------------------------------------------------
// Drawing
// ------------------------------------------------------------------------------------------------

private val CyanSoft = JarvisColors.Cyan
private val CyanBright = JarvisColors.CyanBright

private fun DrawScope.drawOrb(clock: OrbClock, energy: Float) {
    val s = size.minDimension
    val c = center
    val breath = sin(clock.breath) * 0.5f + 0.5f
    val level = clock.level

    // The ball grows a little when listening and swells with the voice.
    val r = s * 0.305f * (1f + 0.028f * breath + 0.09f * energy + 0.055f * level * energy)
    val glow = (0.55f + 0.22f * breath + 0.40f * energy + 0.25f * level).coerceAtMost(1.5f)

    drawHalo(c, r, glow)
    drawRings(c, s, clock, energy, level, breath)
    drawSphere(c, r, clock.flow, glow)
}

/** The soft blue light around the ball. */
private fun DrawScope.drawHalo(c: Offset, r: Float, glow: Float) {
    val haloRadius = r * 1.95f
    val edge = r / haloRadius
    drawCircle(
        brush = Brush.radialGradient(
            colorStops = arrayOf(
                0f to Color.Transparent,
                edge * 0.92f to Color.Transparent,
                edge to Color(0xFF1FB6FF).copy(alpha = (0.42f * glow).coerceAtMost(0.8f)),
                0.62f to Color(0xFF0E7BFF).copy(alpha = (0.16f * glow).coerceAtMost(0.4f)),
                1f to Color.Transparent,
            ),
            center = c,
            radius = haloRadius,
        ),
        radius = haloRadius,
        center = c,
    )
}

private val HUD_ARCS = listOf(8f to 58f, 120f to 30f, 205f to 76f, 318f to 24f)

/** The thin sci-fi rings, the turning dashes and the ripples that go out while listening. */
private fun DrawScope.drawRings(c: Offset, s: Float, clock: OrbClock, energy: Float, level: Float, breath: Float) {
    val lift = 1f + 0.015f * breath + 0.04f * level * energy
    val rA = s * 0.352f * lift
    val rB = s * 0.392f * lift
    val rC = s * 0.428f * lift
    val rD = s * 0.462f
    val hair = 1.dp.toPx()

    // A: thin solid ring close to the ball
    drawCircle(CyanSoft.copy(alpha = 0.55f + 0.25f * energy), radius = rA, center = c, style = Stroke(1.3.dp.toPx()))

    // B: fine dashed ring that turns slowly
    val dashes = 40
    val step = 360f / dashes
    val dashColor = CyanSoft.copy(alpha = 0.38f + 0.2f * energy)
    for (i in 0 until dashes) {
        drawArc(
            color = dashColor,
            startAngle = clock.spin * 0.5f + i * step,
            sweepAngle = step * 0.42f,
            useCenter = false,
            topLeft = Offset(c.x - rB, c.y - rB),
            size = Size(rB * 2f, rB * 2f),
            style = Stroke(hair),
        )
    }

    // C: bright arcs that turn the other way
    for ((start, sweep) in HUD_ARCS) {
        drawArc(
            color = CyanBright.copy(alpha = 0.55f + 0.35f * energy),
            startAngle = start - clock.spin * 0.8f,
            sweepAngle = sweep,
            useCenter = false,
            topLeft = Offset(c.x - rC, c.y - rC),
            size = Size(rC * 2f, rC * 2f),
            style = Stroke(2.2.dp.toPx(), cap = StrokeCap.Round),
        )
    }

    // D: faint outer ring
    drawCircle(CyanSoft.copy(alpha = 0.16f), radius = rD, center = c, style = Stroke(hair))

    // Small marks at the sides and top, like a targeting display
    for (sign in listOf(-1f, 1f)) {
        drawCircle(CyanBright, radius = 2.dp.toPx(), center = Offset(c.x + sign * (rD + s * 0.03f), c.y))
        drawLine(
            color = CyanSoft.copy(alpha = 0.6f),
            start = Offset(c.x + sign * (rD + s * 0.045f), c.y),
            end = Offset(c.x + sign * (rD + s * 0.082f), c.y),
            strokeWidth = 1.2.dp.toPx(),
        )
    }
    drawCircle(CyanBright.copy(alpha = 0.8f), radius = 1.6.dp.toPx(), center = Offset(c.x, c.y - rD - s * 0.025f))

    // Ripples travelling outwards while listening
    if (energy > 0.02f) {
        for (k in 0..1) {
            val t = (clock.flow * 0.45f + k * 0.5f) % 1f
            drawCircle(
                color = CyanSoft.copy(alpha = (1f - t) * 0.32f * energy),
                radius = rA + (rD * 1.05f - rA) * t,
                center = c,
                style = Stroke(1.6.dp.toPx() * (1f - t * 0.5f)),
            )
        }
    }
}

private class Blob(
    val angle: Float,
    val orbit: Float,
    val speed: Float,
    val size: Float,
    val color: Color,
    val alpha: Float,
    val dark: Boolean = false,
)

private val BLOBS = listOf(
    Blob(0.0f, 0.46f, 1.00f, 0.62f, Color(0xFF4FE3FF), 0.85f),
    Blob(1.9f, 0.34f, -0.70f, 0.50f, Color(0xFFBDF4FF), 0.70f),
    Blob(3.4f, 0.52f, 0.55f, 0.58f, Color(0xFF2BB8FF), 0.80f),
    Blob(5.0f, 0.28f, 1.35f, 0.40f, Color(0xFF9AF0FF), 0.65f),
    Blob(2.6f, 0.42f, -1.10f, 0.55f, Color(0xFF031C70), 0.60f, dark = true),
    Blob(4.4f, 0.50f, 0.80f, 0.60f, Color(0xFF02104F), 0.55f, dark = true),
    Blob(0.9f, 0.22f, -0.45f, 0.38f, Color(0xFF0A2FA8), 0.60f, dark = true),
    Blob(1.2f, 0.58f, 0.62f, 0.34f, Color(0xFF7DEBFF), 0.55f),
    Blob(4.0f, 0.18f, -1.60f, 0.30f, Color(0xFFFFFFFF), 0.45f),
    Blob(5.7f, 0.48f, -0.38f, 0.46f, Color(0xFF1D7BFF), 0.70f),
    Blob(3.0f, 0.60f, 0.95f, 0.30f, Color(0xFF021047), 0.50f, dark = true),
)

/** The glowing ball itself: deep blue with moving cyan streaks, dark swirls and a bright rim. */
private fun DrawScope.drawSphere(c: Offset, r: Float, flow: Float, glow: Float) {
    val ball = Path().apply { addOval(Rect(center = c, radius = r)) }
    clipPath(ball) {
        // 1. Blue ball, brightest towards the upper-left of the middle
        drawCircle(
            brush = Brush.radialGradient(
                colorStops = arrayOf(
                    0f to Color(0xFF74E6FF),
                    0.28f to Color(0xFF27A2FF),
                    0.60f to Color(0xFF1262EA),
                    1f to Color(0xFF0A2C96),
                ),
                center = c + Offset(-0.10f * r, -0.14f * r),
                radius = r * 1.22f,
            ),
            radius = r,
            center = c,
        )

        // 2. Moving nebula streaks: light ones add glow, dark ones carve out deep-blue swirls
        for (blob in BLOBS) {
            val angle = blob.angle + flow * blob.speed
            val blobCenter = c + Offset(cos(angle) * blob.orbit * r, sin(angle) * blob.orbit * r * 0.88f)
            val blobRadius = blob.size * r * (1f + 0.12f * sin(flow * blob.speed * 1.7f + blob.angle))
            drawCircle(
                brush = Brush.radialGradient(
                    listOf(
                        blob.color.copy(alpha = blob.alpha),
                        blob.color.copy(alpha = blob.alpha * 0.35f),
                        Color.Transparent,
                    ),
                    center = blobCenter,
                    radius = blobRadius,
                ),
                radius = blobRadius,
                center = blobCenter,
                blendMode = if (blob.dark) BlendMode.SrcOver else BlendMode.Plus,
            )
        }

        // 3. Thin spiral filaments, like swirling plasma
        for (k in 0 until 5) {
            val path = Path()
            val base = flow * (0.55f + 0.07f * k) + k * (2f * PI.toFloat() / 5f)
            val steps = 26
            for (i in 0..steps) {
                val t = i / steps.toFloat()
                val angle = base + t * 3.4f
                val radius = r * (0.06f + 0.98f * t.pow(0.85f))
                val x = c.x + cos(angle) * radius
                val y = c.y + sin(angle) * radius
                if (i == 0) path.moveTo(x, y) else path.lineTo(x, y)
            }
            val main = k < 2 // two bold arms, three fine wisps
            drawPath(
                path,
                color = Color(0xFFB8F4FF).copy(alpha = if (main) 0.16f else 0.07f),
                style = Stroke(r * (if (main) 0.16f else 0.09f), cap = StrokeCap.Round),
                blendMode = BlendMode.Plus,
            )
            drawPath(
                path,
                color = Color.White.copy(alpha = if (main) 0.22f else 0.20f),
                style = Stroke(r * (if (main) 0.045f else 0.022f), cap = StrokeCap.Round),
                blendMode = BlendMode.Plus,
            )
        }

        // 4. Depth: the edge of the ball falls into shadow
        drawCircle(
            brush = Brush.radialGradient(
                colorStops = arrayOf(
                    0.60f to Color.Transparent,
                    0.88f to Color(0x3A030B2E),
                    1f to Color(0x99020821),
                ),
                center = c,
                radius = r,
            ),
            radius = r,
            center = c,
        )

        // 5. Glassy highlight, upper left
        drawCircle(
            brush = Brush.radialGradient(
                listOf(Color(0x66FFFFFF), Color.Transparent),
                center = c + Offset(-0.38f * r, -0.42f * r),
                radius = r * 0.55f,
            ),
            radius = r,
            center = c,
        )

        // 6. Bright core
        drawCircle(
            brush = Brush.radialGradient(
                listOf(Color.White.copy(alpha = 0.95f), CyanBright.copy(alpha = 0.5f), Color.Transparent),
                center = c,
                radius = r * 0.20f,
            ),
            radius = r * 0.20f,
            center = c,
        )
    }

    // Bright rim light
    drawCircle(
        color = CyanBright.copy(alpha = 0.55f + 0.3f * glow.coerceAtMost(1f)),
        radius = r,
        center = c,
        style = Stroke(1.6.dp.toPx()),
    )
}

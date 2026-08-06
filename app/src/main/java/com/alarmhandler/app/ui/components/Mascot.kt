package com.alarmhandler.app.ui.components

import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxScope
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import com.alarmhandler.app.ui.theme.LocalPixelStyle
import com.alarmhandler.app.ui.theme.PixelPalette
import kotlin.math.abs
import kotlin.math.floor
import kotlin.math.roundToInt
import kotlin.math.sin

/**
 * The Alarm Handler mascot, drawn from the exact 12x8 pixel grid recovered
 * from the supplied artwork.
 *
 * Drawing rather than scaling a bitmap is what guarantees the sprite is always
 * crisp: every cell lands on a whole number of device pixels at any size, so
 * there is no filtering and no half-pixel seam. Moods only move or hide cells
 * that already exist -- the character itself is never redrawn.
 */

/** How the mascot is reacting. */
enum class MascotMood {
    /** Before an alarm: eyes shut, slow breathing, floating z's. */
    SLEEPING,

    /** Default resting state on the home screen. */
    IDLE,

    /** The alarm is ringing. */
    JUMPING,

    /** Snoozed once too often. */
    ANNOYED,

    /** The alarm was dismissed. */
    CELEBRATING,

    /** A new alarm was just saved. */
    WAVING,

    /** No alarms exist yet. */
    SITTING,
}

// The sprite exactly as it appears in the provided image.
private const val GRID_W = 12
private const val GRID_H = 8

private const val BODY = 'R'
private const val EYE = 'K'
private const val EMPTY = '.'

private val BASE_ROWS = listOf(
    "..RRRRRRRR..",
    "..RKRRRRKR..",
    "RRRRRRRRRRRR",
    "RRRRRRRRRRRR",
    "..RRRRRRRR..",
    "..RRRRRRRR..",
    "..R.R..R.R..",
    "..R.R..R.R..",
)

private enum class Eyes { OPEN, CLOSED, HALF }
private enum class Arms { DOWN, UP, WAVE }
private enum class Legs { STANDING, TUCKED }

private data class Pose(
    val eyes: Eyes,
    val arms: Arms,
    val legs: Legs,
    val brows: Boolean = false,
)

private fun poseFor(mood: MascotMood, blink: Boolean, wavePhase: Boolean): Pose = when (mood) {
    MascotMood.SLEEPING -> Pose(Eyes.CLOSED, Arms.DOWN, Legs.TUCKED)
    MascotMood.IDLE -> Pose(if (blink) Eyes.CLOSED else Eyes.OPEN, Arms.DOWN, Legs.STANDING)
    MascotMood.JUMPING -> Pose(Eyes.OPEN, Arms.UP, Legs.TUCKED)
    MascotMood.ANNOYED -> Pose(Eyes.HALF, Arms.DOWN, Legs.STANDING, brows = true)
    MascotMood.CELEBRATING -> Pose(Eyes.OPEN, Arms.UP, Legs.STANDING)
    MascotMood.WAVING -> Pose(Eyes.OPEN, if (wavePhase) Arms.WAVE else Arms.DOWN, Legs.STANDING)
    MascotMood.SITTING -> Pose(Eyes.OPEN, Arms.DOWN, Legs.TUCKED)
}

/** Applies a pose by moving existing cells; no new shapes are invented. */
private fun rowsFor(pose: Pose): List<String> {
    val grid = BASE_ROWS.map { it.toCharArray() }.toMutableList()

    fun set(row: Int, col: Int, ch: Char) {
        if (row in 0 until GRID_H && col in 0 until GRID_W) grid[row][col] = ch
    }

    // Arms live on rows 2 and 3, columns 0-1 (left) and 10-11 (right).
    val leftArm = listOf(0, 1)
    val rightArm = listOf(10, 11)

    fun clearArm(cols: List<Int>) = cols.forEach { c ->
        set(2, c, EMPTY)
        set(3, c, EMPTY)
    }

    fun raiseArm(cols: List<Int>) {
        clearArm(cols)
        cols.forEach { c ->
            set(0, c, BODY)
            set(1, c, BODY)
        }
    }

    when (pose.arms) {
        Arms.DOWN -> Unit
        Arms.UP -> {
            raiseArm(leftArm)
            raiseArm(rightArm)
        }

        Arms.WAVE -> raiseArm(rightArm)
    }

    if (pose.legs == Legs.TUCKED) {
        for (c in 0 until GRID_W) set(7, c, EMPTY)
    }

    return grid.map { String(it) }
}

@Composable
fun Mascot(
    mood: MascotMood,
    modifier: Modifier = Modifier,
    contentDescription: String? = null,
    bodyColor: Color = PixelPalette.Coral,
    eyeColor: Color = PixelPalette.Ink,
) {
    val style = LocalPixelStyle.current
    val animated = !style.reducedMotion

    val transition = rememberInfiniteTransition(label = "mascot")
    // A single 0..1 clock drives every mood, so animations stay in step and
    // there is only one running animation per mascot.
    val clock by if (animated) {
        transition.animateFloat(
            initialValue = 0f,
            targetValue = 1f,
            animationSpec = infiniteRepeatable(
                animation = tween(durationMillis = periodFor(mood), easing = LinearEasing),
                repeatMode = RepeatMode.Restart,
            ),
            label = "clock",
        )
    } else {
        androidx.compose.runtime.remember { androidx.compose.runtime.mutableFloatStateOf(0f) }
    }

    val blink = animated && mood == MascotMood.IDLE && clock > 0.92f
    val wavePhase = animated && sin(clock * 2f * Math.PI.toFloat() * 2f) > 0f
    val pose = poseFor(mood, blink, wavePhase || !animated)
    val rows = rowsFor(pose)

    val description = contentDescription
    Box(
        modifier = modifier.then(
            if (description != null) {
                Modifier.semantics { this.contentDescription = description }
            } else {
                Modifier
            }
        )
    ) {
        Canvas(Modifier.fillMaxSize()) {
            val cell = floor(minOf(size.width / GRID_W, size.height / GRID_H))
            if (cell < 1f) return@Canvas
            val spriteW = cell * GRID_W
            val spriteH = cell * GRID_H

            val motion = motionFor(mood, clock, animated, cell)
            val originX = ((size.width - spriteW) / 2f + motion.dx).roundToInt().toFloat()
            val originY = ((size.height - spriteH) / 2f + motion.dy).roundToInt().toFloat()

            drawSprite(rows, pose, originX, originY, cell, bodyColor, eyeColor)
            drawExtras(mood, clock, animated, originX, originY, cell, bodyColor, eyeColor)
        }
    }
}

/** Milliseconds for one full animation cycle of each mood. */
private fun periodFor(mood: MascotMood): Int = when (mood) {
    MascotMood.SLEEPING -> 3600
    MascotMood.IDLE -> 4200
    MascotMood.JUMPING -> 620
    MascotMood.ANNOYED -> 900
    MascotMood.CELEBRATING -> 700
    MascotMood.WAVING -> 1200
    MascotMood.SITTING -> 5000
}

private data class Motion(val dx: Float, val dy: Float)

private fun motionFor(mood: MascotMood, clock: Float, animated: Boolean, cell: Float): Motion {
    if (!animated) return Motion(0f, 0f)
    val t = clock * 2f * Math.PI.toFloat()
    return when (mood) {
        // A hop that spends most of its time on the ground, like a sprite
        // animation rather than a sine wave.
        MascotMood.JUMPING -> Motion(0f, -abs(sin(t / 2f)) * cell * 2.2f)
        MascotMood.CELEBRATING -> Motion(0f, -abs(sin(t / 2f)) * cell * 1.2f)
        // Annoyed shakes sideways in whole pixels so it still looks blocky.
        MascotMood.ANNOYED -> Motion(((sin(t * 3f) * 1.4f).roundToInt()) * cell * 0.5f, 0f)
        MascotMood.IDLE -> Motion(0f, sin(t) * cell * 0.18f)
        MascotMood.SLEEPING -> Motion(0f, sin(t) * cell * 0.12f)
        MascotMood.WAVING -> Motion(0f, sin(t * 2f) * cell * 0.15f)
        MascotMood.SITTING -> Motion(0f, sin(t) * cell * 0.08f)
    }
}

private fun DrawScope.drawSprite(
    rows: List<String>,
    pose: Pose,
    originX: Float,
    originY: Float,
    cell: Float,
    bodyColor: Color,
    eyeColor: Color,
) {
    val cellSize = Size(cell, cell)
    rows.forEachIndexed { r, line ->
        line.forEachIndexed { c, ch ->
            if (ch == EMPTY) return@forEachIndexed
            val x = originX + c * cell
            val y = originY + r * cell
            when (ch) {
                BODY -> drawRect(bodyColor, Offset(x, y), cellSize)
                EYE -> {
                    // The eye socket is body coloured; the pupil on top is what
                    // opens, closes and half-lids.
                    drawRect(bodyColor, Offset(x, y), cellSize)
                    when (pose.eyes) {
                        Eyes.OPEN -> drawRect(eyeColor, Offset(x, y), cellSize)
                        Eyes.HALF -> drawRect(
                            eyeColor,
                            Offset(x, y + cell / 2f),
                            Size(cell, cell / 2f),
                        )

                        Eyes.CLOSED -> drawRect(
                            eyeColor,
                            Offset(x, y + cell * 0.62f),
                            Size(cell, cell * 0.28f),
                        )
                    }
                }
            }
        }
    }

    if (pose.brows) {
        // Two angry brow pixels sitting on the row above the eyes.
        listOf(3, 8).forEach { c ->
            drawRect(
                eyeColor,
                Offset(originX + c * cell, originY + 0.55f * cell),
                Size(cell, cell * 0.22f),
            )
        }
    }
}

private fun DrawScope.drawExtras(
    mood: MascotMood,
    clock: Float,
    animated: Boolean,
    originX: Float,
    originY: Float,
    cell: Float,
    bodyColor: Color,
    eyeColor: Color,
) {
    when (mood) {
        MascotMood.SLEEPING -> {
            // Three z's drifting up and to the right on a staggered loop.
            repeat(3) { i ->
                val phase = ((clock + i / 3f) % 1f)
                val alpha = (1f - phase).coerceIn(0f, 1f) * 0.9f
                val size = cell * (0.5f + 0.25f * i)
                val x = originX + cell * (9.5f + phase * 1.6f)
                val y = originY + cell * (1.2f - phase * 3.2f)
                drawZ(x, y, size, eyeColor.copy(alpha = alpha))
            }
        }

        MascotMood.CELEBRATING -> {
            if (!animated) return
            repeat(4) { i ->
                val phase = ((clock + i / 4f) % 1f)
                val alpha = (1f - phase).coerceIn(0f, 1f)
                val s = cell * 0.4f
                val angle = (i * 90f + 45f) * (Math.PI.toFloat() / 180f)
                val radius = cell * (1.5f + phase * 3f)
                val x = originX + cell * 6f + sin(angle) * radius
                val y = originY + cell * 2f - kotlin.math.cos(angle) * radius
                drawRect(bodyColor.copy(alpha = alpha), Offset(x, y), Size(s, s))
            }
        }

        else -> Unit
    }
}

/** A blocky letter Z built from three bars, drawn on the same pixel grid. */
private fun DrawScope.drawZ(x: Float, y: Float, s: Float, color: Color) {
    val bar = s / 3f
    drawRect(color, Offset(x, y), Size(s, bar))
    drawRect(color, Offset(x + bar, y + bar), Size(bar, bar))
    drawRect(color, Offset(x, y + bar * 2f), Size(s, bar))
}

/** Convenience overlay so a mascot can sit inside another layout. */
@Composable
fun BoxScope.MascotOverlay(
    mood: MascotMood,
    modifier: Modifier = Modifier,
    contentDescription: String? = null,
) {
    Mascot(mood = mood, modifier = modifier, contentDescription = contentDescription)
}

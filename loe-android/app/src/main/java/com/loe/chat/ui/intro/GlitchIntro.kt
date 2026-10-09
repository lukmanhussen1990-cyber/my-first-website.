package com.loe.chat.ui.intro

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import androidx.compose.runtime.withFrameMillis
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.BlendMode
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.ColorFilter
import androidx.compose.ui.graphics.ColorMatrix
import androidx.compose.ui.graphics.FilterQuality
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.res.imageResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.TextMeasurer
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.drawText
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.rememberTextMeasurer
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.IntSize
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.loe.chat.R
import kotlin.math.roundToInt
import kotlin.math.sin
import kotlin.random.Random

/**
 * The opening scene. It starts on the same frame as the system splash (the logo on black), then the
 * logo glitches, locks in with a flash and a neon glow, "Loe" decodes under it, one last burst hits,
 * and the scene fades into the app. Tap or Back skips it.
 */
@Composable
fun GlitchIntro(onFinished: () -> Unit, modifier: Modifier = Modifier) {
    val logo = ImageBitmap.imageResource(R.drawable.loe_logo)   // freed when the scene leaves
    val measurer = rememberTextMeasurer()
    val finish by rememberUpdatedState(onFinished)
    var time by remember { mutableLongStateOf(0L) }

    LaunchedEffect(Unit) {
        val start = withFrameMillis { it }
        while (time < IntroTimeline.TOTAL) {
            time = withFrameMillis { it } - start
        }
        finish()
    }
    BackHandler { finish() }

    Canvas(
        modifier
            .fillMaxSize()
            .graphicsLayer { alpha = IntroTimeline.overlayAlpha(time) }
            .background(Color.Black)
            .pointerInput(Unit) { detectTapGestures { finish() } }
            .semantics { contentDescription = "Loe opening animation. Tap to skip." },
    ) {
        drawIntro(time, logo, measurer)
    }
}

/** Every value the scene needs, as a function of milliseconds since it started. */
internal object IntroTimeline {
    const val TOTAL = 2400L
    private const val LOCK_IN = 520L
    private const val SETTLED = 780L
    const val NAME_START = 820L
    private const val NAME_RESOLVE = 900L
    private const val NAME_STEP = 150L
    const val TAGLINE_START = 1250L
    private const val BURST_START = 1650L
    private const val BURST_END = 1850L
    private const val FADE_START = 1900L

    /** How hard the picture glitches, 0 to 1. The first frames are clean so they match the splash. */
    fun glitch(t: Long): Float {
        val r = hash(t / BUCKET)
        return when {
            t < 60 -> 0f
            t < LOCK_IN -> 0.35f + 0.65f * r
            t < SETTLED -> lerp(0.5f, 0.04f, progress(t, LOCK_IN, SETTLED))
            t < BURST_START -> if (r > 0.93f) 0.28f else 0f
            t < BURST_END -> lerp(0.95f, 0.2f, progress(t, BURST_START, BURST_END)) * (0.6f + 0.4f * r)
            else -> lerp(0.15f, 0f, progress(t, BURST_END, 2100))
        }
    }

    /** Logo size relative to the splash icon (288 dp). */
    fun logoScale(t: Long): Float = when {
        t < LOCK_IN -> 1f
        t < SETTLED -> lerp(1f, 1.14f, easeOutBack(progress(t, LOCK_IN, SETTLED)))
        t < FADE_START -> 1.14f
        else -> lerp(1.14f, 1.4f, easeIn(progress(t, FADE_START, TOTAL)))
    }

    /** 0 to 1 as the logo rises to make room for the name. */
    fun lift(t: Long): Float = smooth(progress(t, 560, 900))

    fun glow(t: Long): Float = smooth(progress(t, 500, 760)) * (0.85f + 0.15f * sin(t / 260f))

    fun flash(t: Long): Float = if (t in LOCK_IN..680L) (1f - progress(t, LOCK_IN, 680)) else 0f

    /** 0 to 1 while the shockwave ring expands from the logo after it locks in; -1 when hidden. */
    fun shockwave(t: Long): Float = if (t in LOCK_IN..900L) progress(t, LOCK_IN, 900) else -1f

    fun scanlines(t: Long): Float = smooth(progress(t, 40, 200))

    fun overlayAlpha(t: Long): Float = 1f - smooth(progress(t, FADE_START, TOTAL))

    fun nameAlpha(t: Long): Float = smooth(progress(t, NAME_START, NAME_START + 100))

    /** True once the letter at [index] has stopped scrambling. */
    fun letterResolved(t: Long, index: Int): Boolean = t >= NAME_RESOLVE + index * NAME_STEP

    fun decoding(t: Long, letters: Int): Boolean = t in NAME_START until NAME_RESOLVE + letters * NAME_STEP

    /** The glitch pattern jumps to a new random layout every bucket (about 18 times a second). */
    const val BUCKET = 55L

    private fun hash(n: Long): Float {
        var x = (n * 374761393L + 668265263L).toInt()
        x = (x xor (x ushr 13)) * 1274126177
        x = x xor (x ushr 16)
        return (x and 0xFFFFFF) / 16777215f
    }

    private fun progress(t: Long, start: Long, end: Long) = ((t - start).toFloat() / (end - start)).coerceIn(0f, 1f)
    private fun lerp(a: Float, b: Float, f: Float) = a + (b - a) * f
    private fun smooth(x: Float) = x * x * (3 - 2 * x)
    private fun easeIn(x: Float) = x * x
    private fun easeOutBack(x: Float): Float {
        val c = 1.70158f
        val y = x - 1
        return 1 + (c + 1) * y * y * y + c * y * y
    }
}

private const val NAME = "Loe"
private const val TAGLINE = "ALL YOUR AI · ONE CHAT"
private const val SCRAMBLE = "!<>-_/[]{}=+*^?#%&@0123456789ABCDEFXYZ"

private val Pink = Color(0xFFFF3EA5)
private val Violet = Color(0xFF8A5CFF)
private val Cyan = Color(0xFF2DE2E6)
private val Blue = Color(0xFF5C7CFF)
private val NeonRed = Color(0xFFFF2A6D)
private val NeonCyan = Color(0xFF00E5FF)

private val redOnly = ColorFilter.colorMatrix(
    ColorMatrix(
        floatArrayOf(
            1f, 0f, 0f, 0f, 0f,
            0f, 0f, 0f, 0f, 0f,
            0f, 0f, 0f, 0f, 0f,
            0f, 0f, 0f, 1f, 0f,
        ),
    ),
)
private val cyanOnly = ColorFilter.colorMatrix(
    ColorMatrix(
        floatArrayOf(
            0f, 0f, 0f, 0f, 0f,
            0f, 1f, 0f, 0f, 0f,
            0f, 0f, 1f, 0f, 0f,
            0f, 0f, 0f, 1f, 0f,
        ),
    ),
)

private fun DrawScope.drawIntro(t: Long, logo: ImageBitmap, measurer: TextMeasurer) {
    val glitch = IntroTimeline.glitch(t)
    val random = Random(t / IntroTimeline.BUCKET * 31 + 7)
    val side = 288.dp.toPx() * IntroTimeline.logoScale(t)
    val center = Offset(size.width / 2f, size.height / 2f - IntroTimeline.lift(t) * 64.dp.toPx())
    val jitter = if (glitch > 0.5f) (random.nextFloat() - 0.5f) * 10.dp.toPx() * glitch else 0f
    val topLeft = Offset(center.x - side / 2f, center.y - side / 2f + jitter)

    val glow = IntroTimeline.glow(t)
    if (glow > 0f) {
        val radius = side * 0.42f
        drawCircle(
            Brush.radialGradient(
                listOf(Pink.copy(alpha = 0.42f * glow), Violet.copy(alpha = 0.16f * glow), Color.Transparent),
                center = center,
                radius = radius,
            ),
            radius = radius,
            center = center,
        )
    }

    // The logo in horizontal bands; while glitching, some bands slide sideways.
    val flicker = glitch > 0.55f && random.nextFloat() < 0.2f
    drawBands(logo, topLeft, side, glitch, random, if (flicker) 0.35f else 1f)

    // Colour fringing: red and cyan copies pulled apart, added on top.
    if (glitch > 0.02f) {
        val shift = (6.dp.toPx() + 12.dp.toPx() * random.nextFloat()) * glitch
        val ghost = (0.25f + 0.6f * glitch).coerceAtMost(0.85f)
        drawLogo(logo, Offset(topLeft.x - shift, topLeft.y), side, ghost, redOnly)
        drawLogo(logo, Offset(topLeft.x + shift, topLeft.y), side, ghost, cyanOnly)
    }

    // Broken-signal blocks and tear lines.
    if (glitch > 0.25f) {
        val colours = listOf(Pink, Cyan, Violet, Color.White, Blue)
        repeat((glitch * 10).toInt()) {
            val w = (10 + random.nextFloat() * 60).dp.toPx()
            val h = (2 + random.nextFloat() * 8).dp.toPx()
            val x = topLeft.x + side * (0.2f + random.nextFloat() * 0.6f) - w / 2f
            val y = topLeft.y + side * (0.2f + random.nextFloat() * 0.6f)
            drawRect(
                colours[random.nextInt(colours.size)].copy(alpha = 0.45f + 0.5f * random.nextFloat()),
                Offset(x, y), Size(w, h), blendMode = BlendMode.Plus,
            )
        }
    }
    if (glitch > 0.6f && random.nextFloat() < 0.5f) {
        val y = topLeft.y + side * (0.2f + random.nextFloat() * 0.6f)
        drawRect(Color.White.copy(alpha = 0.35f), Offset(0f, y), Size(size.width, 1.5.dp.toPx()), blendMode = BlendMode.Plus)
    }

    // Lock-in: a burst of light from the logo and a neon ring rushing outwards.
    val flash = IntroTimeline.flash(t)
    if (flash > 0f) {
        drawRect(Color.White.copy(alpha = 0.12f * flash))
        val radius = side * (0.35f + 0.25f * (1f - flash))
        drawCircle(
            Brush.radialGradient(listOf(Color.White.copy(alpha = 0.7f * flash), Pink.copy(alpha = 0.35f * flash), Color.Transparent), center, radius),
            radius = radius,
            center = center,
            blendMode = BlendMode.Plus,
        )
    }
    val wave = IntroTimeline.shockwave(t)
    if (wave >= 0f) {
        val fade = 1f - wave
        val radius = side * (0.3f + 0.9f * wave)
        drawCircle(Pink.copy(alpha = 0.8f * fade), radius, center, style = Stroke(width = (1f + 3f * fade).dp.toPx()), blendMode = BlendMode.Plus)
        drawCircle(NeonCyan.copy(alpha = 0.5f * fade), radius * 0.94f, center, style = Stroke(width = (1f + 2f * fade).dp.toPx()), blendMode = BlendMode.Plus)
    }

    drawName(t, measurer, center, side, glitch)
    drawScanlines(t, IntroTimeline.scanlines(t) * (0.08f + 0.25f * glitch))
}

private fun DrawScope.drawLogo(logo: ImageBitmap, topLeft: Offset, side: Float, alpha: Float, filter: ColorFilter) {
    val px = side.roundToInt()
    drawImage(
        logo,
        dstOffset = IntOffset(topLeft.x.roundToInt(), topLeft.y.roundToInt()),
        dstSize = IntSize(px, px),
        alpha = alpha,
        colorFilter = filter,
        blendMode = BlendMode.Plus,
        filterQuality = FilterQuality.Medium,
    )
}

private fun DrawScope.drawBands(logo: ImageBitmap, topLeft: Offset, side: Float, glitch: Float, random: Random, alpha: Float) {
    val rows = logo.height
    val scale = side / rows
    val width = side.roundToInt()
    fun band(from: Int, to: Int, dx: Float) {
        if (to <= from) return
        val top = (topLeft.y + from * scale).roundToInt()
        val bottom = (topLeft.y + to * scale).roundToInt()
        if (bottom <= top) return
        drawImage(
            logo,
            srcOffset = IntOffset(0, from),
            srcSize = IntSize(logo.width, to - from),
            dstOffset = IntOffset((topLeft.x + dx).roundToInt(), top),
            dstSize = IntSize(width, bottom - top),
            alpha = alpha,
            filterQuality = FilterQuality.Medium,
        )
    }
    if (glitch < 0.1f) {
        band(0, rows, 0f)
        return
    }
    val shifted = List(2 + (glitch * 6).toInt()) {
        val from = ((0.1f + random.nextFloat() * 0.8f) * rows).toInt()
        val to = (from + (0.01f + random.nextFloat() * 0.07f) * rows).toInt().coerceAtMost(rows)
        Triple(from, to, (random.nextFloat() - 0.5f) * 2f * side * 0.12f * glitch)
    }.sortedBy { it.first }
    var y = 0
    for ((from, to, dx) in shifted) {
        val start = maxOf(from, y)
        band(y, start, 0f)
        band(start, to, dx)
        y = maxOf(y, to)
    }
    band(y, rows, 0f)
}

private fun DrawScope.drawName(t: Long, measurer: TextMeasurer, logoCenter: Offset, side: Float, glitch: Float) {
    if (t < IntroTimeline.NAME_START) return
    val random = Random(t / 45 * 17 + 3)
    val shown = NAME.mapIndexed { i, c ->
        if (IntroTimeline.letterResolved(t, i)) c else SCRAMBLE[random.nextInt(SCRAMBLE.length)]
    }.joinToString("")
    val name = measurer.measure(shown, TextStyle(fontSize = 46.sp, fontWeight = FontWeight.Black, letterSpacing = 3.sp))
    val alpha = IntroTimeline.nameAlpha(t)
    val topLeft = Offset(size.width / 2f - name.size.width / 2f, logoCenter.y + side * 0.36f)
    val split = (if (IntroTimeline.decoding(t, NAME.length)) 3.dp.toPx() else 0f) + glitch * 8.dp.toPx()
    if (split > 0.5f) {
        drawText(name, NeonRed, Offset(topLeft.x - split, topLeft.y), alpha = 0.8f * alpha, blendMode = BlendMode.Plus)
        drawText(name, NeonCyan, Offset(topLeft.x + split, topLeft.y), alpha = 0.8f * alpha, blendMode = BlendMode.Plus)
    }
    drawText(name, Color.White, topLeft, alpha = alpha)

    if (t < IntroTimeline.TAGLINE_START) return
    val style = TextStyle(fontSize = 12.sp, fontWeight = FontWeight.Medium, letterSpacing = 3.sp)
    val typed = ((t - IntroTimeline.TAGLINE_START) / 18).toInt().coerceAtMost(TAGLINE.length)
    val cursor = if (typed < TAGLINE.length && (t / 120) % 2 == 0L) "▌" else ""
    val full = measurer.measure(TAGLINE, style)
    drawText(
        measurer.measure(TAGLINE.take(typed) + cursor, style),
        Color(0xFFB7B3E6),
        Offset(size.width / 2f - full.size.width / 2f, topLeft.y + name.size.height + 6.dp.toPx()),
    )
}

private fun DrawScope.drawScanlines(t: Long, strength: Float) {
    if (strength <= 0f) return
    val line = Color.Black.copy(alpha = strength)
    val gap = 3.dp.toPx()
    val thickness = 1.dp.toPx()
    var y = 0f
    while (y < size.height) {
        drawRect(line, Offset(0f, y), Size(size.width, thickness))
        y += gap
    }
    // A soft bright bar rolling down the screen, like an old monitor.
    val band = 120.dp.toPx()
    val barY = (t % 1400) / 1400f * (size.height + band) - band
    drawRect(
        Brush.verticalGradient(
            listOf(Color.Transparent, Color.White.copy(alpha = 0.05f), Color.Transparent),
            startY = barY,
            endY = barY + band,
        ),
        Offset(0f, barY),
        Size(size.width, band),
    )
}

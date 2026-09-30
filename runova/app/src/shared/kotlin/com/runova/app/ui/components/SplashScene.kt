package com.runova.app.ui.components

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.clipPath
import androidx.compose.ui.graphics.lerp
import kotlin.math.PI
import kotlin.math.abs
import kotlin.math.max
import kotlin.math.sin
import kotlin.random.Random

/**
 * Procedurally painted splash backdrop: dusky sky, sunset glow, misty mountains, a wet road and
 * a runner seen from behind. [time] (seconds) drives mist drift, the runner's gait and the
 * scrolling road reflections.
 */
@Composable
fun SplashScene(time: Float, modifier: Modifier = Modifier) {
    Box(modifier) {
        Canvas(Modifier.fillMaxSize()) { drawSplash(time) }
    }
}

private val ridgeCache = HashMap<Int, FloatArray>()

private fun ridge(seed: Int, points: Int, roughness: Float): FloatArray = ridgeCache.getOrPut(seed * 1000 + points) {
    // midpoint displacement; values roughly in [-1, 1]
    val n = points
    val a = FloatArray(n)
    val rnd = Random(seed)
    a[0] = rnd.nextFloat() * 2 - 1
    a[n - 1] = rnd.nextFloat() * 2 - 1
    fun split(l: Int, r: Int, amp: Float) {
        if (r - l < 2) return
        val m = (l + r) / 2
        a[m] = (a[l] + a[r]) / 2 + (rnd.nextFloat() * 2 - 1) * amp
        split(l, m, amp * roughness)
        split(m, r, amp * roughness)
    }
    split(0, n - 1, 1f)
    a
}

private fun DrawScope.mountain(seed: Int, baseY: Float, amplitude: Float, color: Brush, shift: Float = 0f) {
    val pts = ridge(seed, 129, 0.56f)
    val w = size.width
    val path = Path().apply {
        moveTo(0f, size.height)
        for (i in pts.indices) {
            val x = i / (pts.size - 1f) * w
            val y = baseY - (pts[(i + (shift * pts.size).toInt()).mod(pts.size)] * 0.5f + 0.5f) * amplitude
            lineTo(x, y)
        }
        lineTo(w, size.height)
        close()
    }
    drawPath(path, color)
}

internal fun DrawScope.drawSplash(t: Float) {
    val w = size.width
    val h = size.height
    val horizon = h * 0.505f

    // ---- sky
    drawRect(
        Brush.verticalGradient(
            0.00f to Color(0xFF0E1F27),
            0.16f to Color(0xFF173039),
            0.30f to Color(0xFF28434C),
            0.39f to Color(0xFF4A4F50),
            0.45f to Color(0xFF9B6750),
            0.485f to Color(0xFFE39A62),
            0.505f to Color(0xFFF6B976),
            0.56f to Color(0xFF6E6560),
            1.00f to Color(0xFF0C1214),
            endY = h,
        ),
    )
    // cloud banks
    val cloudRnd = Random(7)
    repeat(14) { i ->
        val cy = h * (0.05f + i * 0.03f + cloudRnd.nextFloat() * 0.02f)
        val cx = w * (cloudRnd.nextFloat() * 1.2f - 0.1f) + sin(t * 0.05f + i) * w * 0.02f
        val rw = w * (0.35f + cloudRnd.nextFloat() * 0.7f)
        val rh = h * (0.012f + cloudRnd.nextFloat() * 0.03f)
        val warm = i >= 10
        val col = if (warm) Color(0xFFE3905C).copy(alpha = 0.20f) else Color(0xFF3E5761).copy(alpha = 0.18f + cloudRnd.nextFloat() * 0.14f)
        drawOval(
            Brush.radialGradient(listOf(col, Color.Transparent), center = Offset(cx, cy), radius = rw / 2),
            topLeft = Offset(cx - rw / 2, cy - rh / 2),
            size = Size(rw, rh),
        )
    }
    // ---- sun + glow
    val sunX = w * 0.815f
    val sunY = horizon - h * 0.034f
    val breathe = 0.9f + 0.1f * sin(t * 1.3f)
    drawCircle(
        Brush.radialGradient(listOf(Color(0xFFFFC98A).copy(alpha = 0.55f * breathe), Color(0xFFF08A4B).copy(alpha = 0.18f), Color.Transparent), center = Offset(sunX, sunY), radius = w * 0.55f),
        radius = w * 0.55f,
        center = Offset(sunX, sunY),
    )
    drawCircle(Color(0xFFFFD58F), radius = w * 0.032f, center = Offset(sunX, sunY))
    drawCircle(Color(0xFFFFF1C9).copy(alpha = 0.8f), radius = w * 0.02f, center = Offset(sunX, sunY))

    // ---- mountains (far -> near) with mist between the layers
    val drift = sin(t * 0.08f) * 0.01f
    mountain(3, horizon + h * 0.012f, h * 0.06f, Brush.verticalGradient(listOf(Color(0xFF6D6F72), Color(0xFF4F5A5F)), startY = horizon - h * 0.06f, endY = horizon), drift)
    drawRect(Brush.verticalGradient(listOf(Color.Transparent, Color(0xFFE8B08A).copy(alpha = 0.16f), Color.Transparent), startY = horizon - h * 0.03f, endY = horizon + h * 0.03f))
    mountain(11, horizon + h * 0.05f, h * 0.075f, Brush.verticalGradient(listOf(Color(0xFF3E4C53), Color(0xFF2A363C)), startY = horizon - h * 0.03f, endY = horizon + h * 0.06f), -drift)
    mist(t, horizon + h * 0.045f, h * 0.05f, 0.18f)
    mountain(23, horizon + h * 0.11f, h * 0.09f, Brush.verticalGradient(listOf(Color(0xFF26343A), Color(0xFF172126)), startY = horizon, endY = horizon + h * 0.12f), drift * 1.5f)
    mist(t * 1.3f, horizon + h * 0.10f, h * 0.06f, 0.14f)
    mountain(31, horizon + h * 0.19f, h * 0.10f, Brush.verticalGradient(listOf(Color(0xFF151F24), Color(0xFF0D1417)), startY = horizon + h * 0.08f, endY = horizon + h * 0.2f), -drift * 2f)

    // ---- road
    drawRoad(t, horizon)

    // ---- runner
    drawRunner(t, Offset(w * 0.47f, h * 0.395f), h * 0.40f)

    // ---- vignette and legibility gradients
    drawRect(Brush.verticalGradient(listOf(Color(0x8C060B0E), Color.Transparent), startY = 0f, endY = h * 0.26f))
    drawRect(Brush.verticalGradient(listOf(Color.Transparent, Color(0xE6050A0C)), startY = h * 0.72f, endY = h))
    drawRect(Brush.radialGradient(listOf(Color.Transparent, Color(0x88000000)), center = Offset(w / 2, h * 0.5f), radius = h * 0.75f))
}

private fun DrawScope.mist(t: Float, y: Float, height: Float, alpha: Float) {
    val w = size.width
    for (k in 0 until 3) {
        val x = ((t * 6f * (k + 1)) % (w * 2)) - w * 0.5f + k * w * 0.4f
        drawOval(
            Brush.radialGradient(listOf(Color(0xFFB9C7CC).copy(alpha = alpha), Color.Transparent), center = Offset(x, y), radius = w * 0.7f),
            topLeft = Offset(x - w * 0.7f, y - height / 2),
            size = Size(w * 1.4f, height),
        )
    }
}

private fun DrawScope.drawRoad(t: Float, horizon: Float) {
    val w = size.width
    val h = size.height
    val vanish = Offset(w * 0.66f, horizon + h * 0.155f)
    val road = Path().apply {
        moveTo(-w * 0.35f, h)
        cubicTo(w * 0.05f, h * 0.86f, w * 0.40f, h * 0.74f, vanish.x - w * 0.018f, vanish.y)
        lineTo(vanish.x + w * 0.018f, vanish.y)
        cubicTo(w * 0.78f, h * 0.73f, w * 1.02f, h * 0.84f, w * 1.3f, h)
        close()
    }
    drawPath(road, Brush.verticalGradient(listOf(Color(0xFF2A2F31), Color(0xFF14191B), Color(0xFF0B0F11)), startY = vanish.y, endY = h))
    // wet reflection of the sunset along the road
    clipPath(road) {
        drawOval(
            Brush.radialGradient(listOf(Color(0xFFF0A265).copy(alpha = 0.55f), Color(0xFFB0643A).copy(alpha = 0.18f), Color.Transparent), center = Offset(w * 0.74f, h * 0.80f), radius = w * 0.35f),
            topLeft = Offset(w * 0.48f, vanish.y),
            size = Size(w * 0.52f, h - vanish.y),
        )
        // glints scrolling towards the viewer
        val rnd = Random(5)
        repeat(26) { i ->
            val base = rnd.nextFloat()
            val speed = 0.06f + rnd.nextFloat() * 0.05f
            val p = ((base + t * speed) % 1f)
            val y = vanish.y + (h - vanish.y) * p * p
            val spread = 0.02f + p * 0.28f
            val x = w * (0.66f + (rnd.nextFloat() - 0.4f) * spread)
            val len = w * (0.01f + p * 0.05f)
            drawLine(
                Color(0xFFFFC07F).copy(alpha = 0.35f * (1f - abs(p - 0.5f))),
                Offset(x - len / 2, y),
                Offset(x + len / 2, y),
                strokeWidth = max(1f, p * 3.5f),
                cap = StrokeCap.Round,
            )
        }
    }
    // soft road edges
    drawPath(road, Color(0xFF3A4246).copy(alpha = 0.35f), style = Stroke(2f))
}

/** Joint positions of the runner in figure units (head top = 0, soles = 100). */
private data class Pose(
    val lElbow: Offset, val lHand: Offset,
    val rElbow: Offset, val rHand: Offset,
    val lKnee: Offset, val lAnkle: Offset,
    val rKnee: Offset, val rAnkle: Offset,
)

// left leg planted, right heel kicked up behind (sole visible), arms counter-swinging
private val PoseA = Pose(
    lElbow = Offset(-17.2f, 33.5f), lHand = Offset(-10.4f, 41.5f),
    rElbow = Offset(16.4f, 28.5f), rHand = Offset(12.6f, 20.5f),
    lKnee = Offset(-5.4f, 74.5f), lAnkle = Offset(-4.8f, 92.5f),
    rKnee = Offset(7.4f, 71f), rAnkle = Offset(10.4f, 75.5f),
)

private val PoseB = Pose(
    lElbow = Offset(-16.4f, 28.5f), lHand = Offset(-12.6f, 20.5f),
    rElbow = Offset(17.2f, 33.5f), rHand = Offset(10.4f, 41.5f),
    lKnee = Offset(-7.4f, 71f), lAnkle = Offset(-10.4f, 75.5f),
    rKnee = Offset(5.4f, 74.5f), rAnkle = Offset(4.8f, 92.5f),
)

private fun lerpO(a: Offset, b: Offset, f: Float) = Offset(a.x + (b.x - a.x) * f, a.y + (b.y - a.y) * f)

private fun lerpPose(a: Pose, b: Pose, f: Float) = Pose(
    lerpO(a.lElbow, b.lElbow, f), lerpO(a.lHand, b.lHand, f),
    lerpO(a.rElbow, b.rElbow, f), lerpO(a.rHand, b.rHand, f),
    lerpO(a.lKnee, b.lKnee, f), lerpO(a.lAnkle, b.lAnkle, f),
    lerpO(a.rKnee, b.rKnee, f), lerpO(a.rAnkle, b.rAnkle, f),
)

private fun DrawScope.drawRunner(t: Float, top: Offset, height: Float) {
    val cadence = 1.35f
    val phase = (t * cadence) % 1f
    val tri = if (phase < 0.5f) phase * 2f else 2f - phase * 2f
    val f = tri * tri * (3f - 2f * tri)
    val pose = lerpPose(PoseA, PoseB, f)
    val s = height / 100f
    val bob = abs(sin(t * cadence * 2f * PI.toFloat())) * 1.0f

    // ground shadow (does not bob)
    drawOval(
        Brush.radialGradient(listOf(Color.Black.copy(alpha = 0.55f), Color.Transparent), center = Offset(top.x, top.y + 99f * s), radius = 16f * s),
        topLeft = Offset(top.x - 16f * s, top.y + 96.5f * s),
        size = Size(32f * s, 5f * s),
    )
    // Warm rim light: draw the silhouette in rim colour shifted towards the sun, then the body on top.
    val rim = Color(0xFFE8A06A)
    drawFigure(pose, Offset(top.x + 0.55f * s, top.y - 0.35f * s - bob * s), s, rim, rim, rim)
    drawFigure(pose, Offset(top.x, top.y - bob * s), s, Color(0xFF1E1B1A), Color(0xFF151D22), Color(0xFF202A30))
}

/** Sphere-swept tapered limb from a (radius ra) to b (radius rb) with an optional muscle bulge. */
private fun DrawScope.limb(o: Offset, s: Float, a: Offset, ra: Float, b: Offset, rb: Float, color: Color, bulge: Float = 0f, bulgeAt: Float = 0.3f) {
    val steps = 22
    for (i in 0..steps) {
        val u = i / steps.toFloat()
        val bump = if (bulge > 0f) bulge * sin((PI * (u / bulgeAt).coerceAtMost(1f) * 0.5f + if (u > bulgeAt) PI * 0.5 * ((u - bulgeAt) / (1 - bulgeAt)) else 0.0).toFloat()) else 0f
        val r = ra + (rb - ra) * u + bump
        val p = Offset(o.x + (a.x + (b.x - a.x) * u) * s, o.y + (a.y + (b.y - a.y) * u) * s)
        drawCircle(color, radius = r * s, center = p)
    }
}

private fun DrawScope.drawFigure(p: Pose, o: Offset, s: Float, body: Color, cloth: Color, shoe: Color) {
    fun P(x: Float, y: Float) = Offset(o.x + x * s, o.y + y * s)
    // legs
    limb(o, s, Offset(-5.2f, 57f), 5.4f, p.lKnee, 3.7f, body)
    limb(o, s, p.lKnee, 3.5f, p.lAnkle, 1.9f, body, bulge = 0.9f)
    limb(o, s, Offset(5.2f, 57f), 5.4f, p.rKnee, 3.7f, body)
    limb(o, s, p.rKnee, 3.5f, p.rAnkle, 1.9f, body, bulge = 0.9f)
    // shoes: planted = seen from behind (heel), kicked = sole facing the viewer
    for (ankle in listOf(p.lAnkle, p.rAnkle)) {
        val kicked = ankle.y < 88f
        if (kicked) {
            drawRoundRect(shoe, topLeft = P(ankle.x - 3.4f, ankle.y + 0.2f), size = Size(6.8f * s, 8.8f * s), cornerRadius = androidx.compose.ui.geometry.CornerRadius(3.2f * s))
        } else {
            drawRoundRect(shoe, topLeft = P(ankle.x - 3.3f, ankle.y + 0.5f), size = Size(6.6f * s, 7.2f * s), cornerRadius = androidx.compose.ui.geometry.CornerRadius(3f * s))
        }
    }
    // shorts
    val shorts = Path().apply {
        P(-9.8f, 45.5f).let { moveTo(it.x, it.y) }
        P(9.8f, 45.5f).let { lineTo(it.x, it.y) }
        P(11.2f, 59.5f).let { lineTo(it.x, it.y) }
        P(1.0f, 60.5f).let { lineTo(it.x, it.y) }
        P(0f, 55.5f).let { lineTo(it.x, it.y) }
        P(-1.0f, 60.5f).let { lineTo(it.x, it.y) }
        P(-11.2f, 59.5f).let { lineTo(it.x, it.y) }
        close()
    }
    drawPath(shorts, Color(0xFF10171B))
    // arms behind/beside the torso
    limb(o, s, Offset(-11.6f, 19f), 3.3f, p.lElbow, 2.6f, cloth)
    limb(o, s, p.lElbow, 2.5f, p.lHand, 2.0f, cloth)
    limb(o, s, Offset(11.6f, 19f), 3.3f, p.rElbow, 2.6f, cloth)
    limb(o, s, p.rElbow, 2.5f, p.rHand, 2.0f, cloth)
    // torso (hoodie): broad shoulders tapering to the waist
    val torso = Path().apply {
        P(-3.8f, 13.2f).let { moveTo(it.x, it.y) }
        P(-9.5f, 14.2f).let { a -> P(-13.6f, 16.2f).let { b -> P(-13.4f, 22f).let { c -> cubicTo(a.x, a.y, b.x, b.y, c.x, c.y) } } }
        P(-12.0f, 32f).let { a -> P(-9.6f, 40f).let { b -> P(-9.4f, 47.5f).let { c -> cubicTo(a.x, a.y, b.x, b.y, c.x, c.y) } } }
        P(9.4f, 47.5f).let { lineTo(it.x, it.y) }
        P(9.6f, 40f).let { a -> P(12.0f, 32f).let { b -> P(13.4f, 22f).let { c -> cubicTo(a.x, a.y, b.x, b.y, c.x, c.y) } } }
        P(13.6f, 16.2f).let { a -> P(9.5f, 14.2f).let { b -> P(3.8f, 13.2f).let { c -> cubicTo(a.x, a.y, b.x, b.y, c.x, c.y) } } }
        close()
    }
    drawPath(torso, cloth)
    // hood bunched at the neck
    drawOval(cloth, topLeft = P(-6.2f, 11.2f), size = Size(12.4f * s, 7.6f * s))
    // neck + head
    drawRoundRect(body, topLeft = P(-2.4f, 9f), size = Size(4.8f * s, 5f * s), cornerRadius = androidx.compose.ui.geometry.CornerRadius(2f * s))
    drawOval(body, topLeft = P(-4.9f, 0f), size = Size(9.8f * s, 11.6f * s))
    // ears
    drawOval(body, topLeft = P(-5.6f, 4.6f), size = Size(1.8f * s, 3.2f * s))
    drawOval(body, topLeft = P(3.8f, 4.6f), size = Size(1.8f * s, 3.2f * s))
}

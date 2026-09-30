package com.runova.app.ui.components

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.size
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.AutoAwesome
import androidx.compose.material.icons.rounded.Bolt
import androidx.compose.material.icons.rounded.DirectionsRun
import androidx.compose.material.icons.rounded.EmojiEvents
import androidx.compose.material.icons.rounded.Event
import androidx.compose.material.icons.rounded.Explore
import androidx.compose.material.icons.rounded.LocalFireDepartment
import androidx.compose.material.icons.rounded.Lock
import androidx.compose.material.icons.rounded.MilitaryTech
import androidx.compose.material.icons.rounded.NightsStay
import androidx.compose.material.icons.rounded.Star
import androidx.compose.material.icons.rounded.Terrain
import androidx.compose.material.icons.rounded.Timer
import androidx.compose.material.icons.rounded.TrackChanges
import androidx.compose.material.icons.rounded.WbTwilight
import androidx.compose.material.icons.rounded.WorkspacePremium
import androidx.compose.material3.Icon
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.rotate
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.runova.app.ui.theme.Runova
import com.runova.core.progress.BadgeIcon
import com.runova.core.progress.BadgeTone
import kotlin.math.PI
import kotlin.math.cos
import kotlin.math.sin
import kotlin.random.Random

/** Metallic palette of a badge tone: outer gradient, inner plate and glyph gradient. */
data class BadgePalette(val outer: List<Color>, val inner: List<Color>, val glyph: List<Color>, val glow: Color)

fun BadgeTone.palette(): BadgePalette = when (this) {
    BadgeTone.GOLD -> BadgePalette(
        listOf(Color(0xFFFFE9A3), Color(0xFFF0B545), Color(0xFFB8741F), Color(0xFF7A4A12)),
        listOf(Color(0xFF3F2B12), Color(0xFF1C1309)), listOf(Color(0xFFFFE29A), Color(0xFFFF9F2E)), Color(0xFFFFB84A),
    )
    BadgeTone.EMBER -> BadgePalette(
        listOf(Color(0xFFFFD27A), Color(0xFFFF9535), Color(0xFFD8561C), Color(0xFF8F2F0E)),
        listOf(Color(0xFF3E1C0D), Color(0xFF1D0D06)), listOf(Color(0xFFFFD36B), Color(0xFFFF6A21)), Color(0xFFFF7A2F),
    )
    BadgeTone.AMBER -> BadgePalette(
        listOf(Color(0xFFFFE8A8), Color(0xFFFFC24D), Color(0xFFE08A1A), Color(0xFF8A5210)),
        listOf(Color(0xFF3D2C11), Color(0xFF1C1408)), listOf(Color(0xFFFFEDAF), Color(0xFFFFB12E)), Color(0xFFFFC24D),
    )
    BadgeTone.VIOLET -> BadgePalette(
        listOf(Color(0xFFCDBDFF), Color(0xFF8E6BFF), Color(0xFF5634E0), Color(0xFF2B188A)),
        listOf(Color(0xFF1F1745), Color(0xFF0E0A24)), listOf(Color(0xFFDCD0FF), Color(0xFFA07BFF)), Color(0xFF8E6BFF),
    )
    BadgeTone.STEEL -> BadgePalette(
        listOf(Color(0xFFF2F6FA), Color(0xFFBCC8D3), Color(0xFF7C8A97), Color(0xFF45515D)),
        listOf(Color(0xFF232B33), Color(0xFF10151A)), listOf(Color(0xFFEFF4F8), Color(0xFF9FB0BF)), Color(0xFFB9C7D4),
    )
    BadgeTone.AZURE -> BadgePalette(
        listOf(Color(0xFFBDEEFF), Color(0xFF52C2FF), Color(0xFF1C7FE0), Color(0xFF0D478A)),
        listOf(Color(0xFF0F2540), Color(0xFF07121F)), listOf(Color(0xFFC8F2FF), Color(0xFF3AA8FF)), Color(0xFF3AA8FF),
    )
    BadgeTone.LIME -> BadgePalette(
        listOf(Color(0xFFF2FFBB), Color(0xFFCBFB4E), Color(0xFF86CF1F), Color(0xFF477A0D)),
        listOf(Color(0xFF1F2D0C), Color(0xFF0E1606)), listOf(Color(0xFFF2FFBE), Color(0xFFA8EB2E)), Color(0xFFCBFB4E),
    )
    BadgeTone.ROSE -> BadgePalette(
        listOf(Color(0xFFFFC7D7), Color(0xFFFF6F98), Color(0xFFD93A6B), Color(0xFF82183A)),
        listOf(Color(0xFF3D1122), Color(0xFF1D0811)), listOf(Color(0xFFFFD6E2), Color(0xFFFF6F98)), Color(0xFFFF6F98),
    )
}

private val LockedPalette = BadgePalette(
    listOf(Color(0xFF59626A), Color(0xFF3B434A), Color(0xFF2A3036), Color(0xFF1C2126)),
    listOf(Color(0xFF1A1F24), Color(0xFF111519)), listOf(Color(0xFF7E8890), Color(0xFF545D65)), Color.Transparent,
)

fun BadgeIcon.vector(): ImageVector = when (this) {
    BadgeIcon.FLAME -> Icons.Rounded.LocalFireDepartment
    BadgeIcon.RUNNER -> Icons.Rounded.DirectionsRun
    BadgeIcon.STREAK -> Icons.Rounded.MilitaryTech
    BadgeIcon.MOON -> Icons.Rounded.NightsStay
    BadgeIcon.SUNRISE -> Icons.Rounded.WbTwilight
    BadgeIcon.MEDAL -> Icons.Rounded.WorkspacePremium
    BadgeIcon.TROPHY -> Icons.Rounded.EmojiEvents
    BadgeIcon.MOUNTAIN -> Icons.Rounded.Terrain
    BadgeIcon.BOLT -> Icons.Rounded.Bolt
    BadgeIcon.CROWN -> Icons.Rounded.AutoAwesome
    BadgeIcon.ROAD -> Icons.Rounded.Explore
    BadgeIcon.TARGET -> Icons.Rounded.TrackChanges
    BadgeIcon.TIMER -> Icons.Rounded.Timer
    BadgeIcon.SHOE -> RunovaIcons.Sneaker
    BadgeIcon.CALENDAR -> Icons.Rounded.Event
    BadgeIcon.STAR -> Icons.Rounded.Star
}

/** Rounded regular polygon (pointy top for hexagons with rotation = -90°). */
fun roundedPolygon(center: Offset, radius: Float, sides: Int, corner: Float, rotationDeg: Float = -90f): Path {
    if (radius <= 0f || radius.isNaN()) return Path()
    val pts = (0 until sides).map { i ->
        val a = Math.toRadians((rotationDeg + i * 360.0 / sides))
        Offset(center.x + radius * cos(a).toFloat(), center.y + radius * sin(a).toFloat())
    }
    val path = Path()
    for (i in pts.indices) {
        val prev = pts[(i - 1 + sides) % sides]
        val cur = pts[i]
        val next = pts[(i + 1) % sides]
        val inDir = (cur - prev).let { it / it.getDistance() }
        val outDir = (next - cur).let { it / it.getDistance() }
        val a = cur - inDir * corner
        val b = cur + outDir * corner
        if (i == 0) path.moveTo(a.x, a.y) else path.lineTo(a.x, a.y)
        path.quadraticBezierTo(cur.x, cur.y, b.x, b.y)
    }
    path.close()
    return path
}

/** Hexagonal medal. Locked badges are rendered in muted steel with a small lock. */
@Composable
fun AchievementBadge(
    icon: BadgeIcon,
    tone: BadgeTone,
    modifier: Modifier = Modifier,
    size: Dp = 84.dp,
    locked: Boolean = false,
    glow: Boolean = true,
) {
    val palette = if (locked) LockedPalette else tone.palette()
    Box(modifier.size(size), contentAlignment = Alignment.Center) {
        Canvas(Modifier.fillMaxSize()) { drawMedal(palette, glow && !locked) }
        GradientIcon(
            icon.vector(),
            Brush.verticalGradient(palette.glyph),
            Modifier.size(size * 0.40f).graphicsLayer { translationY = 0f },
        )
        if (locked) {
            Box(Modifier.fillMaxSize(), contentAlignment = Alignment.BottomEnd) {
                Box(Modifier.size(size * 0.30f).alpha(0.95f), contentAlignment = Alignment.Center) {
                    Canvas(Modifier.fillMaxSize()) { drawCircle(Color(0xFF12171B)); drawCircle(Color(0xFF3B444C), style = Stroke(1.5.dp.toPx())) }
                    Icon(Icons.Rounded.Lock, contentDescription = null, tint = Color(0xFF9AA4AC), modifier = Modifier.size(size * 0.16f))
                }
            }
        }
    }
}

internal fun DrawScope.drawMedal(p: BadgePalette, glow: Boolean) {
    val r = size.minDimension / 2f * 0.9f
    if (r <= 0f) return
    val c = center
    if (glow) {
        drawCircle(
            Brush.radialGradient(listOf(p.glow.copy(alpha = 0.34f), p.glow.copy(alpha = 0.10f), Color.Transparent), center = c, radius = r * 1.25f),
            radius = r * 1.25f,
            center = c,
        )
    }
    val outer = roundedPolygon(c, r, 6, r * 0.16f)
    drawPath(outer, Brush.linearGradient(p.outer, start = Offset(c.x - r, c.y - r), end = Offset(c.x + r * 0.8f, c.y + r)))
    // bevel highlight
    drawPath(outer, Brush.verticalGradient(listOf(Color.White.copy(alpha = 0.55f), Color.White.copy(alpha = 0.05f), Color.Black.copy(alpha = 0.25f)), startY = c.y - r, endY = c.y + r), style = Stroke(r * 0.045f))
    val innerR = r * 0.76f
    val inner = roundedPolygon(c, innerR, 6, innerR * 0.14f)
    drawPath(inner, Brush.radialGradient(p.inner, center = Offset(c.x, c.y - innerR * 0.25f), radius = innerR * 1.2f))
    drawPath(inner, Brush.verticalGradient(listOf(p.outer[1].copy(alpha = 0.9f), p.outer[3].copy(alpha = 0.9f)), startY = c.y - innerR, endY = c.y + innerR), style = Stroke(r * 0.05f))
    // glossy sheen on the upper half
    val sheen = roundedPolygon(c, r * 0.97f, 6, r * 0.16f)
    drawPath(sheen, Brush.linearGradient(listOf(Color.White.copy(alpha = 0.16f), Color.Transparent), start = Offset(c.x - r, c.y - r), end = Offset(c.x, c.y)))
}

/**
 * Big celebratory badge: lime starburst that slowly rotates behind the medal, with a pulse.
 */
@Composable
fun HeroBadge(icon: BadgeIcon, tone: BadgeTone, modifier: Modifier = Modifier, size: Dp = 190.dp, locked: Boolean = false) {
    val c = Runova.colors
    val infinite = rememberInfiniteTransition()
    val spin by infinite.animateFloat(0f, 360f, infiniteRepeatable(tween(24_000, easing = LinearEasing)))
    val pulse by infinite.animateFloat(0.96f, 1.04f, infiniteRepeatable(tween(1600), RepeatMode.Reverse))
    val palette = if (locked) LockedPalette else tone.palette()
    Box(modifier.size(size), contentAlignment = Alignment.Center) {
        if (!locked) {
            Canvas(Modifier.fillMaxSize().graphicsLayer { rotationZ = spin; scaleX = pulse; scaleY = pulse }) {
                val r = this.size.minDimension / 2f
                if (r <= 0f) return@Canvas
                drawCircle(
                    Brush.radialGradient(listOf(c.lime.copy(alpha = 0.45f), c.lime.copy(alpha = 0.12f), Color.Transparent), center = center, radius = r),
                    radius = r,
                )
                val star = roundedPolygon(center, r * 0.80f, 6, r * 0.07f, rotationDeg = 0f)
                val star2 = roundedPolygon(center, r * 0.80f, 6, r * 0.07f, rotationDeg = 30f)
                val lime = Brush.linearGradient(listOf(Color(0xFFE6FF8A), c.lime, Color(0xFF8BD62A)), start = Offset.Zero, end = Offset(this.size.width, this.size.height))
                drawPath(star, lime)
                drawPath(star2, lime, alpha = 0.92f)
                drawPath(star, Color.White.copy(alpha = 0.25f), style = Stroke(r * 0.012f))
            }
        }
        if (!locked) RestingConfetti(Modifier.size(size * 1.35f))
        Box(Modifier.size(size * 0.60f), contentAlignment = Alignment.Center) {
            Canvas(Modifier.fillMaxSize()) {
                val r = this.size.minDimension / 2f * 0.95f
                if (r <= 0f) return@Canvas
                val outer = roundedPolygon(center, r, 6, r * 0.14f)
                drawPath(outer, Color.Black.copy(alpha = 0.35f), style = Stroke(r * 0.12f))
                drawPath(outer, Brush.linearGradient(palette.outer, start = Offset(center.x - r, center.y - r), end = Offset(center.x + r, center.y + r)))
                val innerR = r * 0.86f
                val inner = roundedPolygon(center, innerR, 6, innerR * 0.12f)
                drawPath(inner, Brush.radialGradient(listOf(Color(0xFF263038), Color(0xFF12181D)), center = Offset(center.x, center.y - innerR * 0.3f), radius = innerR * 1.3f))
            }
            GradientIcon(icon.vector(), Brush.verticalGradient(palette.glyph), Modifier.size(size * 0.34f))
        }
    }
}

// ---------------------------------------------------------------------------------------- confetti

/** A few confetti pieces that gently float around a hero badge. */
@Composable
private fun RestingConfetti(modifier: Modifier) {
    val c = Runova.colors
    val infinite = rememberInfiniteTransition()
    val drift by infinite.animateFloat(-1f, 1f, infiniteRepeatable(tween(2400), RepeatMode.Reverse))
    val pieces = remember {
        val rnd = Random(11)
        List(16) {
            val side = if (it % 2 == 0) -1f else 1f
            Triple(
                Offset(0.5f + side * (0.30f + rnd.nextFloat() * 0.17f), 0.08f + rnd.nextFloat() * 0.84f),
                rnd.nextFloat() * 180f,
                listOf(c.lime, Color(0xFFE8FF6B), Color(0xFF8BD62A), Color(0xFFFFD84D))[rnd.nextInt(4)],
            )
        }
    }
    Canvas(modifier) {
        for ((i, p) in pieces.withIndex()) {
            val (pos, angle, color) = p
            val x = pos.x * size.width
            val y = pos.y * size.height + drift * (if (i % 3 == 0) 4f else -3f) * density
            rotate(angle + drift * 12f, Offset(x, y)) {
                drawRoundRect(
                    color.copy(alpha = 0.85f),
                    topLeft = Offset(x - 5f * density, y - 2.6f * density),
                    size = Size(10f * density, 5.2f * density),
                    cornerRadius = androidx.compose.ui.geometry.CornerRadius(1.6f * density),
                )
            }
        }
    }
}

private data class Piece(val angle: Float, val speed: Float, val spin: Float, val color: Color, val w: Float, val h: Float, val delay: Float)

/** One-shot confetti burst from the centre; re-fires whenever [trigger] changes. */
@Composable
fun ConfettiBurst(trigger: Any, modifier: Modifier = Modifier, colors: List<Color> = listOf(Runova.colors.lime, Color(0xFFE8FF6B), Color(0xFF8BD62A), Color(0xFFFFD84D), Color.White)) {
    val time = remember(trigger) { Animatable(0f) }
    val pieces = remember(trigger) {
        val rnd = Random(trigger.hashCode())
        List(46) {
            Piece(
                angle = rnd.nextFloat() * 2f * PI.toFloat(),
                speed = 0.35f + rnd.nextFloat() * 0.65f,
                spin = (rnd.nextFloat() - 0.5f) * 720f,
                color = colors[rnd.nextInt(colors.size)],
                w = 5f + rnd.nextFloat() * 6f,
                h = 10f + rnd.nextFloat() * 8f,
                delay = rnd.nextFloat() * 0.15f,
            )
        }
    }
    LaunchedEffect(trigger) { time.animateTo(1f, tween(2600, easing = LinearEasing)) }
    Canvas(modifier) {
        val t = time.value
        if (t >= 1f) return@Canvas
        val maxR = size.minDimension * 0.62f
        for (p in pieces) {
            val lt = ((t - p.delay) / (1f - p.delay)).coerceIn(0f, 1f)
            if (lt <= 0f) continue
            val travel = (1f - (1f - lt) * (1f - lt)) * maxR * p.speed
            val gravity = lt * lt * size.height * 0.18f
            val x = center.x + cos(p.angle) * travel
            val y = center.y + sin(p.angle) * travel * 0.8f + gravity
            val alpha = if (lt > 0.7f) (1f - lt) / 0.3f else 1f
            rotate(p.spin * lt + p.angle * 57f, Offset(x, y)) {
                drawRoundRect(
                    p.color.copy(alpha = alpha),
                    topLeft = Offset(x - p.w.dp.toPx() / 2, y - p.h.dp.toPx() / 2),
                    size = Size(p.w.dp.toPx(), p.h.dp.toPx()),
                    cornerRadius = androidx.compose.ui.geometry.CornerRadius(2.dp.toPx()),
                )
            }
        }
    }
}

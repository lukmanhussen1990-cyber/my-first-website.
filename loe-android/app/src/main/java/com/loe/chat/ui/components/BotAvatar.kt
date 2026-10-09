package com.loe.chat.ui.components

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.rotate
import androidx.compose.ui.graphics.drawscope.translate
import androidx.compose.ui.graphics.drawscope.withTransform
import androidx.compose.ui.graphics.vector.PathParser
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import coil.compose.AsyncImage
import com.loe.chat.data.AvatarStyle
import com.loe.chat.data.Bot
import com.loe.chat.data.Profile
import java.io.File
import kotlin.math.cos
import kotlin.math.sin

/** Rounded-square bot avatar. Every style is drawn in code (no bitmap assets). */
@Composable
fun BotAvatar(bot: Bot, size: Dp, modifier: Modifier = Modifier) {
    val shape = RoundedCornerShape(size * 0.25f)
    when (bot.avatar) {
        AvatarStyle.CUSTOM -> CustomAvatar(bot, size, modifier.clip(shape))
        AvatarStyle.GEMINI_BANANA -> EmojiAvatar(
            "🍌", size,
            Brush.linearGradient(listOf(Color(0xFFFFF1A6), Color(0xFFFFCF3F))),
            modifier.clip(shape),
        )
        AvatarStyle.GEMINI_BANANA_PRO -> EmojiAvatar(
            "🍌", size,
            Brush.linearGradient(listOf(Color(0xFF1E293B), Color(0xFF0B1020))),
            modifier.clip(shape),
        )
        else -> Canvas(modifier.size(size).clip(shape)) { drawAvatar(bot.avatar) }
    }
}

@Composable
private fun EmojiAvatar(emoji: String, size: Dp, background: Brush, modifier: Modifier) {
    val fontSize = with(LocalDensity.current) { (size * 0.52f).toSp() }
    Box(modifier.size(size).background(background), contentAlignment = Alignment.Center) {
        Text(emoji, fontSize = fontSize)
    }
}

@Composable
private fun CustomAvatar(bot: Bot, size: Dp, modifier: Modifier) {
    val density = LocalDensity.current
    Box(modifier.size(size).background(Color(bot.color)), contentAlignment = Alignment.Center) {
        val emoji = bot.emoji?.takeIf { it.isNotBlank() }
        if (emoji != null) {
            Text(emoji, fontSize = with(density) { (size * 0.5f).toSp() })
        } else {
            Text(
                bot.name.firstOrNull()?.uppercase() ?: "?",
                color = Color.White,
                fontWeight = FontWeight.Bold,
                fontSize = with(density) { (size * 0.46f).toSp() },
            )
        }
    }
}

/** Round profile picture: the user's photo, or a silhouette on purple. */
@Composable
fun UserAvatar(profile: Profile, size: Dp, modifier: Modifier = Modifier) {
    val path = profile.avatarPath
    if (path != null && File(path).exists()) {
        AsyncImage(
            model = File(path),
            contentDescription = "Profile photo",
            contentScale = ContentScale.Crop,
            modifier = modifier.size(size).clip(CircleShape),
        )
    } else {
        Canvas(modifier.size(size).clip(CircleShape)) {
            val s = this.size.minDimension
            drawRect(Color(0xFF5C5ADD))
            val person = Color(0xFFE6E5E8)
            drawCircle(person, radius = s * 0.19f, center = Offset(s * 0.5f, s * 0.40f))
            drawOval(person, topLeft = Offset(s * 0.17f, s * 0.64f), size = Size(s * 0.66f, s * 0.62f))
        }
    }
}

// ---- Drawing --------------------------------------------------------------------------------

private val whalePath: Path by lazy {
    PathParser().parsePathString(
        "M4.2,13.6 C4.2,10.2 7.8,8 12.4,8 C17.4,8 21,10.6 21,13.6 C21,16.6 17.6,18.4 13,18.4 " +
            "C9.2,18.4 6.6,17.4 5.3,15.9 L2.8,17.8 C2.2,18.2 1.5,17.7 1.8,17.1 L2.9,14.4 L1.6,11.9 " +
            "C1.3,11.3 1.9,10.8 2.5,11.2 L4.6,12.6 C4.35,12.9 4.2,13.2 4.2,13.6 Z",
    ).toPath()
}

private fun DrawScope.drawAvatar(style: AvatarStyle) {
    val s = size.minDimension
    when (style) {
        AvatarStyle.LOE -> {
            drawRect(Color(0xFF5C5ADD))
            val box = s * 0.74f
            drawLoeFace(Offset((s - box) / 2f, (s - box) / 2f), box, SolidColor(Color(0xFFEAEAFA)), Color(0xFF5C5ADD))
        }
        AvatarStyle.LOE_SEARCH -> {
            drawRect(Brush.linearGradient(listOf(Color(0xFF2DD4BF), Color(0xFF0E7490)), Offset.Zero, Offset(s, s)))
            drawGlobe(Color.White, s)
        }
        AvatarStyle.OPENAI_SPACE -> {
            drawRect(Brush.radialGradient(listOf(Color(0xFF34364F), Color(0xFF06060A)), center, s * 0.75f))
            drawStars(s)
            drawRosette(Color.White, s)
        }
        AvatarStyle.OPENAI_SUNSET -> {
            drawRect(Brush.linearGradient(listOf(Color(0xFFA9C3F0), Color(0xFFF0A6CF), Color(0xFFF5A15C)), Offset.Zero, Offset(s, s)))
            drawRosette(Color.White, s)
        }
        AvatarStyle.OPENAI_BLOSSOM -> {
            drawRect(Brush.linearGradient(listOf(Color(0xFFF7A1D9), Color(0xFFC084FC), Color(0xFFF472B6)), Offset.Zero, Offset(s, s)))
            drawRosette(Color.White, s)
        }
        AvatarStyle.OPENAI_LAGOON -> {
            drawRect(Brush.linearGradient(listOf(Color(0xFF14B8C9), Color(0xFF34D399), Color(0xFF1D72E8)), Offset(0f, s), Offset(s, 0f)))
            drawRect(Brush.radialGradient(listOf(Color(0x5534D399), Color.Transparent), Offset(s * 0.2f, s * 0.25f), s * 0.6f))
            drawRosette(Color.White, s)
        }
        AvatarStyle.OPENAI_OCEAN -> {
            drawRect(Brush.linearGradient(listOf(Color(0xFF5EE0D6), Color(0xFF2FA4E7), Color(0xFF2563EB)), Offset.Zero, Offset(s, s)))
            drawRosette(Color.White, s)
        }
        AvatarStyle.OPENAI_AURORA -> {
            drawRect(Brush.linearGradient(listOf(Color(0xFF0F172A), Color(0xFF3730A3), Color(0xFF7C3AED)), Offset(0f, s), Offset(s, 0f)))
            drawRosette(Color.White, s)
        }
        AvatarStyle.OPENAI_IMAGE -> {
            drawRect(Brush.linearGradient(listOf(Color(0xFFFDBA74), Color(0xFFFB7185), Color(0xFFA78BFA)), Offset.Zero, Offset(s, s)))
            drawPicture(Color.White, s)
        }
        AvatarStyle.CLAUDE_DARK -> {
            drawRect(Color.Black)
            drawBurst(Color(0xFFD97757), s)
        }
        AvatarStyle.CLAUDE_CREAM -> {
            drawRect(Color(0xFFE7E7E2))
            drawBurst(Color(0xFFE0603E), s)
        }
        AvatarStyle.CLAUDE_WARM -> {
            drawRect(Color(0xFF2B2622))
            drawBurst(Color(0xFFE8A07E), s)
        }
        AvatarStyle.CLAUDE_LIGHT -> {
            drawRect(Color(0xFFFAF7F2))
            drawBurst(Color(0xFFE79A7B), s)
        }
        AvatarStyle.GEMINI_OUTLINE -> {
            drawRect(Color(0xFFF2F1F5))
            drawPath(
                starPath(s, 0.66f),
                Brush.linearGradient(listOf(Color(0xFF6E9BEA), Color(0xFF8F87DE)), Offset(s * 0.2f, s * 0.2f), Offset(s * 0.8f, s * 0.8f)),
                style = Stroke(width = s * 0.028f),
            )
        }
        AvatarStyle.GEMINI_FILLED -> {
            drawRect(Color(0xFFF2F1F5))
            drawPath(
                starPath(s, 0.66f),
                Brush.linearGradient(listOf(Color(0xFF4F8DF7), Color(0xFF9B72CB), Color(0xFFD96570)), Offset(s * 0.2f, s * 0.2f), Offset(s * 0.85f, s * 0.85f)),
            )
        }
        AvatarStyle.GEMINI_VEO -> {
            drawRect(Brush.linearGradient(listOf(Color(0xFF1E3A8A), Color(0xFF6D28D9)), Offset.Zero, Offset(s, s)))
            drawFilm(Color.White, s)
        }
        AvatarStyle.GEMINI_VEO_FAST -> {
            drawRect(Brush.linearGradient(listOf(Color(0xFF0EA5E9), Color(0xFF6366F1)), Offset.Zero, Offset(s, s)))
            drawFilm(Color.White, s)
        }
        AvatarStyle.GROK -> {
            drawRect(Color.Black)
            drawCircle(Color.White, radius = s * 0.235f, center = center, style = Stroke(width = s * 0.065f))
            drawLine(Color.Black, Offset(s * 0.76f, s * 0.18f), Offset(s * 0.24f, s * 0.82f), strokeWidth = s * 0.17f)
            drawLine(Color.White, Offset(s * 0.78f, s * 0.17f), Offset(s * 0.23f, s * 0.83f), strokeWidth = s * 0.06f, cap = StrokeCap.Round)
        }
        AvatarStyle.DEEPSEEK, AvatarStyle.DEEPSEEK_PRO -> {
            drawRect(if (style == AvatarStyle.DEEPSEEK) Color(0xFF4D6BFE) else Color(0xFF2C3FB8))
            val box = s * 0.7f
            translate((s - box) / 2f, (s - box) / 2f) {
                withTransform({ scale(box / 24f, box / 24f, pivot = Offset.Zero) }) {
                    drawPath(whalePath, Color.White)
                    drawCircle(if (style == AvatarStyle.DEEPSEEK) Color(0xFF4D6BFE) else Color(0xFF2C3FB8), radius = 0.95f, center = Offset(16.6f, 12.4f))
                }
            }
        }
        AvatarStyle.PERPLEXITY, AvatarStyle.PERPLEXITY_PRO -> {
            drawRect(if (style == AvatarStyle.PERPLEXITY) Color(0xFF1F8A8A) else Color(0xFF0F3D44))
            drawAsterisk(Color(0xFFE6FFFB), s)
        }
        AvatarStyle.GEMINI_BANANA, AvatarStyle.GEMINI_BANANA_PRO, AvatarStyle.CUSTOM -> drawRect(Color(0xFF5C5ADD))
    }
}

/** Six interlocking loops, in the spirit of the GPT bots' icons. */
private fun DrawScope.drawRosette(color: Color, s: Float) {
    val w = s * 0.19f
    val h = s * 0.44f
    val offset = s * 0.085f
    val stroke = Stroke(width = s * 0.042f)
    repeat(6) { i ->
        rotate(degrees = i * 60f, pivot = center) {
            drawRoundRect(
                color = color,
                topLeft = Offset(center.x + offset - w / 2f, center.y - h * 0.62f),
                size = Size(w, h),
                cornerRadius = CornerRadius(w / 2f, w / 2f),
                style = stroke,
            )
        }
    }
}

private fun DrawScope.drawStars(s: Float) {
    val random = java.util.Random(11)
    repeat(70) {
        val x = random.nextFloat() * s
        val y = random.nextFloat() * s
        val r = (0.003f + random.nextFloat() * 0.007f) * s
        drawCircle(Color.White.copy(alpha = 0.25f + random.nextFloat() * 0.6f), r, Offset(x, y))
    }
}

/** A radial burst of uneven rays, in the spirit of the Claude bots' icons. */
private fun DrawScope.drawBurst(color: Color, s: Float) {
    val lengths = floatArrayOf(0.36f, 0.29f, 0.37f, 0.31f, 0.38f, 0.28f, 0.36f, 0.30f, 0.37f, 0.29f, 0.35f, 0.32f)
    val inner = s * 0.06f
    lengths.forEachIndexed { i, length ->
        val angle = Math.toRadians(i * 30.0 + if (i % 2 == 0) 4.0 else -3.0)
        val direction = Offset(cos(angle).toFloat(), sin(angle).toFloat())
        drawLine(
            color = color,
            start = center + direction * inner,
            end = center + direction * (s * length),
            strokeWidth = s * 0.072f,
            cap = StrokeCap.Round,
        )
    }
}

/** Four-point sparkle, in the spirit of the Gemini bots' icons. */
private fun starPath(s: Float, scale: Float): Path {
    val c = s / 2f
    val r = s * scale / 2f
    val k = r * 0.16f
    return Path().apply {
        moveTo(c, c - r)
        quadraticTo(c + k, c - k, c + r, c)
        quadraticTo(c + k, c + k, c, c + r)
        quadraticTo(c - k, c + k, c - r, c)
        quadraticTo(c - k, c - k, c, c - r)
        close()
    }
}

private fun DrawScope.drawGlobe(color: Color, s: Float) {
    val r = s * 0.25f
    val stroke = Stroke(width = s * 0.045f)
    drawCircle(color, r, center, style = stroke)
    drawOval(color, Offset(center.x - r * 0.45f, center.y - r), Size(r * 0.9f, r * 2f), style = stroke)
    drawLine(color, Offset(center.x - r, center.y), Offset(center.x + r, center.y), strokeWidth = s * 0.04f)
    drawLine(color, Offset(center.x - r * 0.86f, center.y - r * 0.5f), Offset(center.x + r * 0.86f, center.y - r * 0.5f), strokeWidth = s * 0.03f)
    drawLine(color, Offset(center.x - r * 0.86f, center.y + r * 0.5f), Offset(center.x + r * 0.86f, center.y + r * 0.5f), strokeWidth = s * 0.03f)
}

private fun DrawScope.drawPicture(color: Color, s: Float) {
    val stroke = Stroke(width = s * 0.045f)
    drawRoundRect(color, Offset(s * 0.24f, s * 0.27f), Size(s * 0.52f, s * 0.46f), CornerRadius(s * 0.07f), style = stroke)
    drawCircle(color, s * 0.05f, Offset(s * 0.40f, s * 0.41f))
    val mountains = Path().apply {
        moveTo(s * 0.28f, s * 0.68f)
        lineTo(s * 0.45f, s * 0.50f)
        lineTo(s * 0.55f, s * 0.60f)
        lineTo(s * 0.62f, s * 0.53f)
        lineTo(s * 0.72f, s * 0.68f)
        close()
    }
    drawPath(mountains, color)
}

private fun DrawScope.drawFilm(color: Color, s: Float) {
    drawRoundRect(color, Offset(s * 0.22f, s * 0.29f), Size(s * 0.56f, s * 0.42f), CornerRadius(s * 0.08f), style = Stroke(width = s * 0.045f))
    val play = Path().apply {
        moveTo(s * 0.44f, s * 0.40f)
        lineTo(s * 0.44f, s * 0.60f)
        lineTo(s * 0.60f, s * 0.50f)
        close()
    }
    drawPath(play, color)
}

private fun DrawScope.drawAsterisk(color: Color, s: Float) {
    repeat(4) { i ->
        rotate(degrees = i * 45f, pivot = center) {
            drawLine(color, Offset(center.x, center.y - s * 0.27f), Offset(center.x, center.y + s * 0.27f), strokeWidth = s * 0.05f, cap = StrokeCap.Round)
        }
    }
    drawCircle(color, s * 0.075f, center)
}

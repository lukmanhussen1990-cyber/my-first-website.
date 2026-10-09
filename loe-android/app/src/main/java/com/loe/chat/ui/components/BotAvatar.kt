package com.loe.chat.ui.components

import androidx.annotation.DrawableRes
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.BlendMode
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.ColorFilter
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.asAndroidBitmap
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.translate
import androidx.compose.ui.graphics.drawscope.withTransform
import androidx.compose.ui.graphics.vector.PathParser
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.res.imageResource
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import coil.compose.AsyncImage
import com.loe.chat.R
import com.loe.chat.data.AvatarStyle
import com.loe.chat.data.Bot
import com.loe.chat.data.Profile
import java.io.File

/** Rounded-square bot avatar: provider logos for the official bots, drawn shapes for the rest. */
@Composable
fun BotAvatar(bot: Bot, size: Dp, modifier: Modifier = Modifier) {
    val shape = RoundedCornerShape(size * 0.25f)
    val logo = brandLogo(bot.avatar)
    when {
        bot.avatar == AvatarStyle.CUSTOM -> CustomAvatar(bot, size, modifier.clip(shape))
        bot.avatar == AvatarStyle.LOE -> Image(
            painterResource(R.drawable.loe_icon),
            contentDescription = null,
            contentScale = ContentScale.Crop,
            modifier = modifier.size(size).clip(shape),
        )
        bot.avatar == AvatarStyle.GEMINI_BANANA -> EmojiAvatar(
            "🍌", size,
            Brush.linearGradient(listOf(Color(0xFFFFF1A6), Color(0xFFFFCF3F))),
            modifier.clip(shape),
        )
        bot.avatar == AvatarStyle.GEMINI_BANANA_PRO -> EmojiAvatar(
            "🍌", size,
            Brush.linearGradient(listOf(Color(0xFF1E293B), Color(0xFF0B1020))),
            modifier.clip(shape),
        )
        logo != null -> Box(
            modifier.size(size).clip(shape).drawBehind { drawAvatar(bot.avatar) },
            contentAlignment = Alignment.Center,
        ) {
            if (bot.avatar == AvatarStyle.OPENAI_SPACE) {
                Image(
                    cachedBitmap(R.drawable.bot_astra_galaxy),
                    contentDescription = null,
                    contentScale = ContentScale.Crop,
                    colorFilter = ColorFilter.tint(Color(0x73000000), BlendMode.SrcAtop),
                    modifier = Modifier.matchParentSize(),
                )
            }
            Image(
                cachedBitmap(logo.image),
                contentDescription = null,
                colorFilter = ColorFilter.tint(logo.tint),
                modifier = Modifier.size(size * logo.scale),
            )
        }
        else -> Canvas(modifier.size(size).clip(shape)) { drawAvatar(bot.avatar) }
    }
}

/** A provider's logo: a white mask in drawable-nodpi, tinted when drawn. */
private class BrandLogo(@DrawableRes val image: Int, val tint: Color, val scale: Float)

private fun brandLogo(style: AvatarStyle): BrandLogo? = when (style) {
    AvatarStyle.CLAUDE_DARK -> BrandLogo(R.drawable.logo_claude, Color(0xFFD97757), 0.72f)
    AvatarStyle.CLAUDE_CREAM -> BrandLogo(R.drawable.logo_claude, Color(0xFFD97757), 0.72f)
    AvatarStyle.CLAUDE_WARM -> BrandLogo(R.drawable.logo_claude, Color(0xFFE8A07E), 0.72f)
    AvatarStyle.CLAUDE_LIGHT -> BrandLogo(R.drawable.logo_claude, Color(0xFFDE8460), 0.72f)
    AvatarStyle.OPENAI_SPACE, AvatarStyle.OPENAI_SUNSET, AvatarStyle.OPENAI_BLOSSOM, AvatarStyle.OPENAI_LAGOON,
    AvatarStyle.OPENAI_OCEAN, AvatarStyle.OPENAI_AURORA, AvatarStyle.OPENAI_IMAGE,
    -> BrandLogo(R.drawable.logo_openai, Color.White, 0.66f)
    AvatarStyle.PERPLEXITY, AvatarStyle.PERPLEXITY_PRO -> BrandLogo(R.drawable.logo_perplexity, Color(0xFF1FB8CD), 0.64f)
    else -> null
}

/** Decoded once per process; mipmaps keep the logos smooth at small sizes. */
private val bitmapCache = HashMap<Int, ImageBitmap>()

@Composable
private fun cachedBitmap(@DrawableRes id: Int): ImageBitmap {
    val resources = LocalContext.current.resources
    return remember(id) {
        bitmapCache.getOrPut(id) {
            ImageBitmap.imageResource(resources, id).also { it.asAndroidBitmap().setHasMipMap(true) }
        }
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

/** Draws a whole avatar, or just the background for styles that carry a [BrandLogo]. */
private fun DrawScope.drawAvatar(style: AvatarStyle) {
    val s = size.minDimension
    when (style) {
        AvatarStyle.LOE -> drawRect(Color(0xFF6C58F5))
        AvatarStyle.LOE_SEARCH -> {
            drawRect(Brush.linearGradient(listOf(Color(0xFF2DD4BF), Color(0xFF0E7490)), Offset.Zero, Offset(s, s)))
            drawGlobe(Color.White, s)
        }
        AvatarStyle.OPENAI_SPACE -> drawRect(Color(0xFF06060A))
        AvatarStyle.OPENAI_SUNSET ->
            drawRect(Brush.linearGradient(listOf(Color(0xFFA9C3F0), Color(0xFFF0A6CF), Color(0xFFF5A15C)), Offset.Zero, Offset(s, s)))
        AvatarStyle.OPENAI_BLOSSOM ->
            drawRect(Brush.linearGradient(listOf(Color(0xFFF7A1D9), Color(0xFFC084FC), Color(0xFFF472B6)), Offset.Zero, Offset(s, s)))
        AvatarStyle.OPENAI_LAGOON -> {
            drawRect(Brush.linearGradient(listOf(Color(0xFF14B8C9), Color(0xFF34D399), Color(0xFF1D72E8)), Offset(0f, s), Offset(s, 0f)))
            drawRect(Brush.radialGradient(listOf(Color(0x5534D399), Color.Transparent), Offset(s * 0.2f, s * 0.25f), s * 0.6f))
        }
        AvatarStyle.OPENAI_OCEAN ->
            drawRect(Brush.linearGradient(listOf(Color(0xFF5EE0D6), Color(0xFF2FA4E7), Color(0xFF2563EB)), Offset.Zero, Offset(s, s)))
        AvatarStyle.OPENAI_AURORA ->
            drawRect(Brush.linearGradient(listOf(Color(0xFF0F172A), Color(0xFF3730A3), Color(0xFF7C3AED)), Offset(0f, s), Offset(s, 0f)))
        AvatarStyle.OPENAI_IMAGE ->
            drawRect(Brush.linearGradient(listOf(Color(0xFFFDBA74), Color(0xFFFB7185), Color(0xFFA78BFA)), Offset.Zero, Offset(s, s)))
        AvatarStyle.CLAUDE_DARK -> drawRect(Color.Black)
        AvatarStyle.CLAUDE_CREAM -> drawRect(Color(0xFFE9E8E1))
        AvatarStyle.CLAUDE_WARM -> drawRect(Color(0xFF2B2622))
        AvatarStyle.CLAUDE_LIGHT -> drawRect(Color(0xFFFAF7F2))
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
        AvatarStyle.PERPLEXITY -> drawRect(Color(0xFF13292C))
        AvatarStyle.PERPLEXITY_PRO -> drawRect(Color(0xFF091717))
        AvatarStyle.GEMINI_BANANA, AvatarStyle.GEMINI_BANANA_PRO, AvatarStyle.CUSTOM -> drawRect(Color(0xFF6C58F5))
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

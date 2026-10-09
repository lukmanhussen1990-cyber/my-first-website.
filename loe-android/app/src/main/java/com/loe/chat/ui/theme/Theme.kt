package com.loe.chat.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Typography
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp
import com.loe.chat.data.ThemeMode

/** Colors sampled from the reference app, plus a matching dark palette. */
@Immutable
data class LoeColors(
    val background: Color,
    val surface: Color,
    val composer: Color,
    val pill: Color,
    val divider: Color,
    val menuBackground: Color,
    val menuCard: Color,
    val primary: Color,
    val onPrimary: Color,
    val link: Color,
    val chipSelectedBg: Color,
    val chipSelectedText: Color,
    val chipBorder: Color,
    val text: Color,
    val textSecondary: Color,
    val textTertiary: Color,
    val danger: Color,
    val userBubble: Color,
    val userBubbleText: Color,
    val userBubbleMeta: Color,
    val botBubble: Color,
    val tag: Color,
    val outline: Color,
    val codeBackground: Color,
    val isDark: Boolean,
)

val LightLoeColors = LoeColors(
    background = Color(0xFFFFFFFF),
    surface = Color(0xFFF5F4F7),
    composer = Color(0xFFEAE9EE),
    pill = Color(0xFFE3E2E7),
    divider = Color(0xFFEAE9EE),
    menuBackground = Color(0xFFF5F4F7),
    menuCard = Color(0xFFFFFFFF),
    primary = Color(0xFF5C5ADD),
    onPrimary = Color(0xFFFFFFFF),
    link = Color(0xFF413EA8),
    chipSelectedBg = Color(0xFFE3E6F7),
    chipSelectedText = Color(0xFF322F7F),
    chipBorder = Color(0xFFCCCDD2),
    text = Color(0xFF0A0A0A),
    textSecondary = Color(0xFF4E4F52),
    textTertiary = Color(0xFF6E6E6B),
    danger = Color(0xFFAC1640),
    userBubble = Color(0xFF5C5ADD),
    userBubbleText = Color(0xFFFFFFFF),
    userBubbleMeta = Color(0xFFBDBDF1),
    botBubble = Color(0xFFF5F4F7),
    tag = Color(0xFFEEEDF0),
    outline = Color(0xFFE6E5E8),
    codeBackground = Color(0xFFEAE9EE),
    isDark = false,
)

val DarkLoeColors = LoeColors(
    background = Color(0xFF0F0F10),
    surface = Color(0xFF1C1C1F),
    composer = Color(0xFF26262A),
    pill = Color(0xFF2E2E33),
    divider = Color(0xFF26262A),
    menuBackground = Color(0xFF0F0F10),
    menuCard = Color(0xFF1C1C1F),
    primary = Color(0xFF6C6AF0),
    onPrimary = Color(0xFFFFFFFF),
    link = Color(0xFFA5A3FF),
    chipSelectedBg = Color(0xFF2B2C4A),
    chipSelectedText = Color(0xFFD3D2FF),
    chipBorder = Color(0xFF3A3A40),
    text = Color(0xFFF2F2F4),
    textSecondary = Color(0xFFB4B4BC),
    textTertiary = Color(0xFF8E8E93),
    danger = Color(0xFFFF5C7A),
    userBubble = Color(0xFF5C5ADD),
    userBubbleText = Color(0xFFFFFFFF),
    userBubbleMeta = Color(0xFFC9C8F7),
    botBubble = Color(0xFF1C1C1F),
    tag = Color(0xFF2A2A2E),
    outline = Color(0xFF34343A),
    codeBackground = Color(0xFF26262A),
    isDark = true,
)

val LocalLoeColors = staticCompositionLocalOf { LightLoeColors }

/** Theme accessors, used as `LoeTheme.colors` (like `MaterialTheme.colorScheme`). */
object LoeTheme {
    val colors: LoeColors
        @Composable get() = LocalLoeColors.current
}

private val LoeTypography = Typography().let { base ->
    base.copy(
        bodyLarge = base.bodyLarge.copy(fontSize = 17.sp, lineHeight = 24.sp),
        bodyMedium = base.bodyMedium.copy(fontSize = 15.sp, lineHeight = 21.sp),
        titleLarge = TextStyle(fontSize = 20.sp, fontWeight = FontWeight.Bold, lineHeight = 26.sp),
    )
}

@Composable
fun isLoeDark(mode: ThemeMode): Boolean = when (mode) {
    ThemeMode.LIGHT -> false
    ThemeMode.DARK -> true
    ThemeMode.SYSTEM -> isSystemInDarkTheme()
}

@Composable
fun LoeTheme(dark: Boolean, content: @Composable () -> Unit) {
    val colors = if (dark) DarkLoeColors else LightLoeColors
    val scheme = if (dark) {
        darkColorScheme(
            primary = colors.primary,
            onPrimary = colors.onPrimary,
            background = colors.background,
            surface = colors.background,
            onBackground = colors.text,
            onSurface = colors.text,
            surfaceVariant = colors.surface,
            onSurfaceVariant = colors.textSecondary,
            surfaceContainerLow = colors.surface,
            surfaceContainer = colors.surface,
            surfaceContainerHigh = colors.surface,
            surfaceContainerHighest = colors.composer,
            outline = colors.chipBorder,
            outlineVariant = colors.divider,
            error = colors.danger,
        )
    } else {
        lightColorScheme(
            primary = colors.primary,
            onPrimary = colors.onPrimary,
            background = colors.background,
            surface = colors.background,
            onBackground = colors.text,
            onSurface = colors.text,
            surfaceVariant = colors.surface,
            onSurfaceVariant = colors.textSecondary,
            surfaceContainerLow = colors.background,
            surfaceContainer = colors.background,
            surfaceContainerHigh = colors.background,
            surfaceContainerHighest = colors.composer,
            outline = colors.chipBorder,
            outlineVariant = colors.divider,
            error = colors.danger,
        )
    }
    CompositionLocalProvider(LocalLoeColors provides colors) {
        MaterialTheme(colorScheme = scheme, typography = LoeTypography, content = content)
    }
}

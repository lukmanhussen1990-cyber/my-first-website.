package com.runova.app.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.ReadOnlyComposable
import androidx.compose.runtime.remember
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.TextUnit
import androidx.compose.ui.unit.em
import androidx.compose.ui.unit.sp

/** Colour tokens of the RUNOVA design language (dark is the signature look). */
@Immutable
data class RunovaColors(
    val isDark: Boolean,
    val background: Color,
    val backgroundTop: Color,
    val surface: Color,
    val surfaceHigh: Color,
    val surfaceLow: Color,
    val border: Color,
    val divider: Color,
    /** Accent used for fills: buttons, rings, bars. */
    val lime: Color,
    val limeDeep: Color,
    val onLime: Color,
    /** Accent used for text and icons on surfaces (darker in the light theme for contrast). */
    val accent: Color,
    val textPrimary: Color,
    val textSecondary: Color,
    val textTertiary: Color,
    val track: Color,
    val orange: Color,
    val red: Color,
    val blue: Color,
    val purple: Color,
    val green: Color,
    val teal: Color,
    val yellow: Color,
    val navBar: Color,
    val mapBackground: Color,
    val mapGrid: Color,
    val scrim: Color,
)

val DarkRunovaColors = RunovaColors(
    isDark = true,
    background = Color(0xFF060B0E),
    backgroundTop = Color(0xFF0B1418),
    surface = Color(0xFF121B20),
    surfaceHigh = Color(0xFF1A252B),
    surfaceLow = Color(0xFF0D1519),
    border = Color(0x17FFFFFF),
    divider = Color(0x12FFFFFF),
    lime = Color(0xFFCBFB4E),
    limeDeep = Color(0xFF78D11B),
    onLime = Color(0xFF0A0F07),
    accent = Color(0xFFCBFB4E),
    textPrimary = Color(0xFFF4F7F5),
    textSecondary = Color(0xFF8D989F),
    textTertiary = Color(0xFF5C686F),
    track = Color(0xFF1E282E),
    orange = Color(0xFFFF7A2F),
    red = Color(0xFFFF4B45),
    blue = Color(0xFF2E9BFF),
    purple = Color(0xFFB26BFF),
    green = Color(0xFF63E05A),
    teal = Color(0xFF3CD8B0),
    yellow = Color(0xFFFFC53D),
    navBar = Color(0xFF0A1215),
    mapBackground = Color(0xFF0F171B),
    mapGrid = Color(0xFF18232A),
    scrim = Color(0xB3000000),
)

val LightRunovaColors = RunovaColors(
    isDark = false,
    background = Color(0xFFF2F5F3),
    backgroundTop = Color(0xFFFFFFFF),
    surface = Color(0xFFFFFFFF),
    surfaceHigh = Color(0xFFE9EEEB),
    surfaceLow = Color(0xFFF7F9F8),
    border = Color(0x14000000),
    divider = Color(0x12000000),
    lime = Color(0xFFBDF23A),
    limeDeep = Color(0xFF66B80F),
    onLime = Color(0xFF0A0F07),
    accent = Color(0xFF4C8A00),
    textPrimary = Color(0xFF0E1417),
    textSecondary = Color(0xFF5D6970),
    textTertiary = Color(0xFF8C979D),
    track = Color(0xFFE2E8E5),
    orange = Color(0xFFF46A1F),
    red = Color(0xFFE8392F),
    blue = Color(0xFF1E86F0),
    purple = Color(0xFF9A4FF0),
    green = Color(0xFF34B835),
    teal = Color(0xFF1FB38D),
    yellow = Color(0xFFE8A600),
    navBar = Color(0xFFFFFFFF),
    mapBackground = Color(0xFFE7ECE9),
    mapGrid = Color(0xFFD9E0DC),
    scrim = Color(0x80000000),
)

/** Font families; the platform provides the real Barlow fonts. */
@Immutable
data class RunovaFonts(
    val text: FontFamily = FontFamily.Default,
    val numbers: FontFamily = FontFamily.Default,
    /** Strongly condensed numerals for the live run metrics. */
    val condensed: FontFamily = numbers,
)

@Immutable
data class RunovaTypography(
    val display: TextStyle,
    /** Wide bold numerals used on the home dashboard. */
    val displayWide: TextStyle,
    val tileValue: TextStyle,
    val metricXL: TextStyle,
    val metricL: TextStyle,
    val metricM: TextStyle,
    val metricS: TextStyle,
    val titleXL: TextStyle,
    val titleL: TextStyle,
    val titleM: TextStyle,
    val titleS: TextStyle,
    val body: TextStyle,
    val bodyS: TextStyle,
    val label: TextStyle,
    val caption: TextStyle,
    val button: TextStyle,
)

fun runovaTypography(fonts: RunovaFonts): RunovaTypography {
    fun t(family: FontFamily, weight: FontWeight, size: Int, spacing: TextUnit = 0.sp, line: TextUnit = TextUnit.Unspecified) =
        TextStyle(fontFamily = family, fontWeight = weight, fontSize = size.sp, letterSpacing = spacing, lineHeight = line)
    val n = fonts.numbers
    val x = fonts.text
    return RunovaTypography(
        display = t(n, FontWeight.Bold, 60, (-0.01).em),
        displayWide = t(x, FontWeight.Bold, 58, (-0.02).em),
        tileValue = t(x, FontWeight.Bold, 25, (-0.01).em),
        metricXL = t(fonts.condensed, FontWeight.Bold, 60, 0.em),
        metricL = t(n, FontWeight.Bold, 38),
        metricM = t(n, FontWeight.Bold, 27),
        metricS = t(n, FontWeight.SemiBold, 21),
        titleXL = t(x, FontWeight.ExtraBold, 31, line = 36.sp),
        titleL = t(x, FontWeight.Bold, 26),
        titleM = t(x, FontWeight.Bold, 20),
        titleS = t(x, FontWeight.SemiBold, 17),
        body = t(x, FontWeight.Medium, 16, line = 23.sp),
        bodyS = t(x, FontWeight.Normal, 14, line = 20.sp),
        label = t(x, FontWeight.Medium, 13),
        caption = t(x, FontWeight.SemiBold, 11),
        button = t(x, FontWeight.ExtraBold, 18, 0.02.em),
    )
}

val LocalRunovaColors = staticCompositionLocalOf { DarkRunovaColors }
val LocalRunovaFonts = staticCompositionLocalOf { RunovaFonts() }
val LocalRunovaTypography = staticCompositionLocalOf { runovaTypography(RunovaFonts()) }

/** Shorthand accessors: `Runova.colors.lime`, `Runova.type.metricXL`. */
object Runova {
    val colors: RunovaColors
        @Composable @ReadOnlyComposable get() = LocalRunovaColors.current
    val type: RunovaTypography
        @Composable @ReadOnlyComposable get() = LocalRunovaTypography.current
}

@Composable
fun RunovaTheme(dark: Boolean = true, fonts: RunovaFonts = LocalRunovaFonts.current, content: @Composable () -> Unit) {
    val colors = if (dark) DarkRunovaColors else LightRunovaColors
    val typography = remember(fonts) { runovaTypography(fonts) }
    val scheme = if (dark) {
        darkColorScheme(
            primary = colors.lime,
            onPrimary = colors.onLime,
            secondary = colors.accent,
            background = colors.background,
            onBackground = colors.textPrimary,
            surface = colors.surface,
            onSurface = colors.textPrimary,
            surfaceVariant = colors.surfaceHigh,
            onSurfaceVariant = colors.textSecondary,
            outline = colors.border,
            error = colors.red,
        )
    } else {
        lightColorScheme(
            primary = colors.limeDeep,
            onPrimary = Color.White,
            secondary = colors.accent,
            background = colors.background,
            onBackground = colors.textPrimary,
            surface = colors.surface,
            onSurface = colors.textPrimary,
            surfaceVariant = colors.surfaceHigh,
            onSurfaceVariant = colors.textSecondary,
            outline = colors.border,
            error = colors.red,
        )
    }
    CompositionLocalProvider(
        LocalRunovaColors provides colors,
        LocalRunovaFonts provides fonts,
        LocalRunovaTypography provides typography,
    ) {
        MaterialTheme(colorScheme = scheme, content = content)
    }
}

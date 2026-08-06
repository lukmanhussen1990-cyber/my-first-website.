package com.alarmhandler.app.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Shapes
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.graphics.RectangleShape
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.unit.dp
import androidx.compose.foundation.shape.RoundedCornerShape
import com.alarmhandler.app.data.prefs.AppSettings
import com.alarmhandler.app.data.prefs.ThemeMode

private val LightColors = lightColorScheme(
    primary = PixelPalette.Coral,
    onPrimary = PixelPalette.Paper,
    primaryContainer = PixelPalette.CoralPale,
    onPrimaryContainer = PixelPalette.Ink,
    secondary = PixelPalette.CoralMuted,
    onSecondary = PixelPalette.Paper,
    secondaryContainer = PixelPalette.Stone,
    onSecondaryContainer = PixelPalette.Ink,
    tertiary = PixelPalette.CoralDeep,
    onTertiary = PixelPalette.Paper,
    background = PixelPalette.OffWhite,
    onBackground = PixelPalette.Ink,
    surface = PixelPalette.Paper,
    onSurface = PixelPalette.Ink,
    surfaceVariant = PixelPalette.Stone,
    onSurfaceVariant = PixelPalette.InkSoft,
    outline = PixelPalette.Ink,
    outlineVariant = PixelPalette.Stone,
    error = PixelPalette.Danger,
    onError = PixelPalette.Paper,
)

private val DarkColors = darkColorScheme(
    primary = PixelPalette.Coral,
    onPrimary = PixelPalette.Night,
    primaryContainer = PixelPalette.CoralDeep,
    onPrimaryContainer = PixelPalette.OffWhite,
    secondary = PixelPalette.CoralMuted,
    onSecondary = PixelPalette.Night,
    secondaryContainer = PixelPalette.NightRaised,
    onSecondaryContainer = PixelPalette.OffWhite,
    tertiary = PixelPalette.CoralPale,
    onTertiary = PixelPalette.Night,
    background = PixelPalette.Night,
    onBackground = PixelPalette.OffWhite,
    surface = PixelPalette.NightSurface,
    onSurface = PixelPalette.OffWhite,
    surfaceVariant = PixelPalette.NightRaised,
    onSurfaceVariant = Color_NightMuted,
    outline = PixelPalette.OffWhite,
    outlineVariant = PixelPalette.NightLine,
    error = PixelPalette.Coral,
    onError = PixelPalette.Night,
)

private val Color_NightMuted get() = androidx.compose.ui.graphics.Color(0xFFC7C3BB)

// Material's Shapes only accepts corner-based shapes, so "square" is a zero
// radius rather than RectangleShape.
private val Square = RoundedCornerShape(0.dp)

private val BlockyShapes = Shapes(
    extraSmall = Square,
    small = Square,
    medium = Square,
    large = Square,
    extraLarge = Square,
)

private val SoftShapes = Shapes(
    extraSmall = RoundedCornerShape(6.dp),
    small = RoundedCornerShape(10.dp),
    medium = RoundedCornerShape(14.dp),
    large = RoundedCornerShape(20.dp),
    extraLarge = RoundedCornerShape(28.dp),
)

/**
 * Style switches that are read all over the UI but are not part of Material's
 * own theme: the pixel-art look and the reduced-motion preference.
 */
data class PixelStyle(
    val pixelArt: Boolean = true,
    val reducedMotion: Boolean = false,
) {
    /** Hard offset shadows only make sense in the blocky style. */
    val shadowOffset get() = if (pixelArt) 4.dp else 0.dp
    val borderWidth get() = if (pixelArt) 3.dp else 1.dp
    val shape: Shape get() = if (pixelArt) RectangleShape else RoundedCornerShape(14.dp)
}

val LocalPixelStyle = staticCompositionLocalOf { PixelStyle() }

@Composable
fun AlarmHandlerTheme(
    settings: AppSettings,
    content: @Composable () -> Unit,
) {
    val dark = when (settings.themeMode) {
        ThemeMode.LIGHT -> false
        ThemeMode.DARK -> true
        ThemeMode.SYSTEM -> isSystemInDarkTheme()
    }
    val style = PixelStyle(
        pixelArt = settings.pixelTheme,
        reducedMotion = settings.reducedMotion,
    )
    CompositionLocalProvider(LocalPixelStyle provides style) {
        MaterialTheme(
            colorScheme = if (dark) DarkColors else LightColors,
            typography = PixelTypography,
            shapes = if (settings.pixelTheme) BlockyShapes else SoftShapes,
            content = content,
        )
    }
}

package com.weplay.guesserai.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Typography
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

val Neon = Color(0xFFA855F7)
val NeonDeep = Color(0xFF7C3AED)
val NeonPink = Color(0xFFF0ABFC)
val Lilac = Color(0xFFE9D5FF)
val CyanAccent = Color(0xFF22D3EE)
val Ok = Color(0xFF4ADE80)
val Warn = Color(0xFFFBBF24)
val Bad = Color(0xFFF87171)
val Bg = Color(0xFF0E0A1A)
val Surface1 = Color(0xFF171028)
val Surface2 = Color(0xFF211638)

private val Scheme = darkColorScheme(
    primary = Neon,
    onPrimary = Color.White,
    primaryContainer = NeonDeep,
    onPrimaryContainer = Color.White,
    secondary = CyanAccent,
    onSecondary = Color(0xFF00151A),
    tertiary = NeonPink,
    background = Bg,
    onBackground = Color(0xFFF1EAFF),
    surface = Surface1,
    onSurface = Color(0xFFF1EAFF),
    surfaceVariant = Surface2,
    onSurfaceVariant = Color(0xFFC4B5FD),
    surfaceContainer = Surface1,
    surfaceContainerHigh = Surface2,
    outline = Color(0xFF5B3F8C),
    outlineVariant = Color(0xFF3A2860),
    error = Bad,
)

@Composable
fun WePlayTheme(content: @Composable () -> Unit) {
    MaterialTheme(colorScheme = Scheme, typography = Typography(), content = content)
}

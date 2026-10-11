package com.imran.jarvis.ui.theme

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color

// JARVIS is dark only: there is deliberately no light colour scheme.
private val JarvisColorScheme = darkColorScheme(
    primary = JarvisColors.Cyan,
    onPrimary = Color(0xFF00212B),
    secondary = JarvisColors.Blue,
    onSecondary = Color.White,
    background = JarvisColors.Background,
    onBackground = JarvisColors.TextPrimary,
    surface = JarvisColors.Card,
    onSurface = JarvisColors.TextPrimary,
    surfaceVariant = JarvisColors.CardHigh,
    onSurfaceVariant = JarvisColors.TextSecondary,
    outline = JarvisColors.Border,
    outlineVariant = JarvisColors.BorderSoft,
    error = Color(0xFFFF6B6B),
)

@Composable
fun JarvisTheme(content: @Composable () -> Unit) {
    MaterialTheme(colorScheme = JarvisColorScheme, typography = JarvisTypography) {
        content()
    }
}

/** The dark navy gradient behind every screen. */
@Composable
fun JarvisBackground(modifier: Modifier = Modifier, content: @Composable () -> Unit) {
    Box(
        modifier = modifier
            .fillMaxSize()
            .background(
                Brush.verticalGradient(
                    listOf(JarvisColors.BackgroundTop, JarvisColors.Background, JarvisColors.BackgroundBottom),
                ),
            ),
    ) {
        content()
    }
}

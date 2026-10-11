package com.imran.jarvis.ui.components

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.MoreVert
import androidx.compose.material.icons.filled.Menu
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.imran.jarvis.ui.theme.JarvisColors
import com.imran.jarvis.ui.theme.titleStyle

/** The glowing "JARVIS" title with the small "by Imran" under it. */
@Composable
fun JarvisTitle(modifier: Modifier = Modifier, sizeSp: Float = 30f) {
    Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = modifier) {
        Text(text = "JARVIS", style = titleStyle(sizeSp))
        Text(text = "by Imran", color = Color(0xFFB4C5D8), fontSize = 13.sp)
    }
}

/** Title in the middle, one button on each side (any of them can be empty). */
@Composable
fun JarvisTopBar(
    modifier: Modifier = Modifier,
    start: @Composable () -> Unit = {},
    end: @Composable () -> Unit = {},
) {
    Box(
        modifier = modifier
            .fillMaxWidth()
            .height(76.dp)
            .padding(horizontal = 8.dp),
    ) {
        Box(Modifier.align(Alignment.CenterStart)) { start() }
        JarvisTitle(Modifier.align(Alignment.Center))
        Box(Modifier.align(Alignment.CenterEnd)) { end() }
    }
}

@Composable
fun MenuButton(onClick: () -> Unit) {
    IconButton(onClick = onClick) {
        Icon(Icons.Filled.Menu, contentDescription = "Menu", tint = JarvisColors.TextPrimary)
    }
}

@Composable
fun SettingsButton(onClick: () -> Unit) {
    IconButton(onClick = onClick) {
        Icon(Icons.Filled.Settings, contentDescription = "Settings", tint = JarvisColors.Cyan)
    }
}

@Composable
fun BackButton(onClick: () -> Unit) {
    IconButton(onClick = onClick) {
        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back", tint = JarvisColors.TextPrimary)
    }
}

@Composable
fun MoreButton(onClick: () -> Unit) {
    IconButton(onClick = onClick) {
        Icon(Icons.Filled.MoreVert, contentDescription = "More", tint = JarvisColors.TextPrimary)
    }
}

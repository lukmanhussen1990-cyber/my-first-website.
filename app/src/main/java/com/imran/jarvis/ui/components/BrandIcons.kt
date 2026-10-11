package com.imran.jarvis.ui.components

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.size
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Phone
import androidx.compose.material3.Icon
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.imran.jarvis.ui.theme.JarvisColors

/** A WhatsApp-style chat bubble with a phone handset, drawn by hand (no logo files are needed). */
@Composable
fun WhatsAppIcon(modifier: Modifier = Modifier, size: Dp = 34.dp, tint: Color = JarvisColors.Green) {
    Box(modifier = modifier.size(size), contentAlignment = Alignment.Center) {
        Canvas(modifier = Modifier.size(size)) {
            val s = this.size.minDimension
            val c = Offset(s / 2f, s * 0.47f)
            val r = s * 0.38f
            drawCircle(tint, radius = r, center = c, style = Stroke(s * 0.085f))

            // Little tail at the bottom left
            val tail = Path().apply {
                moveTo(c.x - r * 0.80f, c.y + r * 0.50f)
                lineTo(c.x - r * 1.15f, c.y + r * 1.20f)
                lineTo(c.x - r * 0.15f, c.y + r * 0.96f)
                close()
            }
            drawPath(tail, tint)
        }
        Icon(
            imageVector = Icons.Filled.Phone,
            contentDescription = null,
            tint = tint,
            modifier = Modifier.size(size * 0.46f),
        )
    }
}

/** The red YouTube play button. */
@Composable
fun YouTubeIcon(modifier: Modifier = Modifier, size: Dp = 36.dp) {
    Canvas(modifier = modifier.size(size)) {
        val w = this.size.width
        val h = w * 0.72f
        val top = (this.size.height - h) / 2f
        drawRoundRect(
            color = JarvisColors.Red,
            topLeft = Offset(0f, top),
            size = Size(w, h),
            cornerRadius = CornerRadius(w * 0.22f),
        )
        val play = Path().apply {
            moveTo(w * 0.40f, top + h * 0.28f)
            lineTo(w * 0.40f, top + h * 0.72f)
            lineTo(w * 0.68f, top + h * 0.50f)
            close()
        }
        drawPath(play, Color.White)
    }
}

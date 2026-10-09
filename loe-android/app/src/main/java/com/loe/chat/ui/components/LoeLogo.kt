package com.loe.chat.ui.components

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Fill
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.translate
import androidx.compose.ui.graphics.drawscope.withTransform
import androidx.compose.ui.graphics.vector.PathParser
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.TextUnit
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.loe.chat.ui.theme.LoeTheme

/** The Loe mascot: a speech bubble with two eyes and a smile, drawn in a 24×24 unit box. */
object LoeShapes {
    const val BUBBLE =
        "M7.5,3.5 H16.5 A5,5 0 0 1 21.5,8.5 V12 A5,5 0 0 1 16.5,17 H11.2 L6.6,20.6 C6.0,21.05 5.2,20.55 5.4,19.85 " +
            "L6.25,16.85 A5,5 0 0 1 2.5,12 V8.5 A5,5 0 0 1 7.5,3.5 Z"
    const val EYES =
        "M8.05,10 A1.35,1.95 0 1 0 10.75,10 A1.35,1.95 0 1 0 8.05,10 Z " +
            "M13.25,10 A1.35,1.95 0 1 0 15.95,10 A1.35,1.95 0 1 0 13.25,10 Z"
    const val SMILE = "M10.1,13.2 Q12,14.7 13.9,13.2"

    val bubble: Path by lazy { PathParser().parsePathString(BUBBLE).toPath() }
    val eyes: Path by lazy { PathParser().parsePathString(EYES).toPath() }
    val smile: Path by lazy { PathParser().parsePathString(SMILE).toPath() }

    val gradient = listOf(Color(0xFFC86BFF), Color(0xFF7C5CFF), Color(0xFF4F86FF))
}

/**
 * Draws the mascot so its 24-unit box fills [boxSize] pixels, top-left at [topLeft].
 * [bubble] fills the body; eyes and smile use [face].
 */
fun DrawScope.drawLoeFace(topLeft: Offset, boxSize: Float, bubble: Brush, face: Color, smile: Boolean = true) {
    val scale = boxSize / 24f
    translate(topLeft.x, topLeft.y) {
        withTransform({ scale(scale, scale, pivot = Offset.Zero) }) {
            drawPath(LoeShapes.bubble, bubble, style = Fill)
            drawPath(LoeShapes.eyes, face, style = Fill)
            if (smile) drawPath(LoeShapes.smile, face, style = Stroke(width = 1.0f, cap = StrokeCap.Round))
        }
    }
}

/** The gradient mascot on its own (used next to the "Loe" wordmark). */
@Composable
fun LoeMark(size: Dp, modifier: Modifier = Modifier) {
    Canvas(modifier.size(size)) {
        drawLoeFace(
            topLeft = Offset.Zero,
            boxSize = this.size.minDimension,
            bubble = Brush.linearGradient(
                colors = LoeShapes.gradient,
                start = Offset(2.5f, 3.5f),
                end = Offset(21.5f, 21f),
            ),
            face = Color.White,
        )
    }
}

/** Mascot + "Loe" — the home screen header. */
@Composable
fun LoeWordmark(modifier: Modifier = Modifier, markSize: Dp = 32.dp, textSize: TextUnit = 28.sp) {
    Row(modifier, verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.Center) {
        LoeMark(markSize)
        Spacer(Modifier.width(6.dp))
        Text("Loe", fontSize = textSize, fontWeight = FontWeight.SemiBold, color = LoeTheme.colors.text)
    }
}

/** The launcher icon look: mascot on a black rounded square. */
@Composable
fun LoeAppIcon(size: Dp, modifier: Modifier = Modifier) {
    Box(
        modifier
            .size(size)
            .background(Color(0xFF0B0B0F), RoundedCornerShape(size * 0.26f)),
        contentAlignment = Alignment.Center,
    ) {
        LoeMark(size * 0.66f)
    }
}

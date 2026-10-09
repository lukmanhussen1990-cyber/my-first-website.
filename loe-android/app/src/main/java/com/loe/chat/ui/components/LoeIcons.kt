package com.loe.chat.ui.components

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.size
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.graphics.vector.addPathNodes
import androidx.compose.ui.graphics.vector.path
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp

object LoeIcons {
    /** Square with a pencil: "start a new chat". */
    val NewChat: ImageVector by lazy {
        ImageVector.Builder("NewChat", 24.dp, 24.dp, 24f, 24f).apply {
            path(
                stroke = SolidColor(Color.Black), strokeLineWidth = 1.8f,
                strokeLineCap = StrokeCap.Round, strokeLineJoin = StrokeJoin.Round,
            ) {
                moveTo(11f, 4f)
                horizontalLineTo(6f)
                arcTo(2f, 2f, 0f, false, false, 4f, 6f)
                verticalLineTo(18f)
                arcTo(2f, 2f, 0f, false, false, 6f, 20f)
                horizontalLineTo(18f)
                arcTo(2f, 2f, 0f, false, false, 20f, 18f)
                verticalLineTo(13f)
            }
            path(
                stroke = SolidColor(Color.Black), strokeLineWidth = 1.8f,
                strokeLineCap = StrokeCap.Round, strokeLineJoin = StrokeJoin.Round,
            ) {
                moveTo(18.4f, 3.6f)
                lineTo(20.4f, 5.6f)
                lineTo(12f, 14f)
                lineTo(9f, 15f)
                lineTo(10f, 12f)
                close()
            }
        }.build()
    }

    /** The X (formerly Twitter) mark. */
    val X: ImageVector by lazy {
        ImageVector.Builder("X", 24.dp, 24.dp, 24f, 24f).apply {
            addPath(
                pathData = addPathNodes(
                    "M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25" +
                        "H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z",
                ),
                fill = SolidColor(Color.Black),
            )
        }.build()
    }
}

/** A simple controller-shaped mascot in Discord blue (drawn, not the official asset). */
@Composable
fun DiscordMark(size: Dp, modifier: Modifier = Modifier) {
    Canvas(modifier.size(size)) {
        val s = this.size.width
        val blue = Color(0xFF5865F2)
        drawRoundRect(blue, Offset(s * 0.06f, s * 0.2f), Size(s * 0.88f, s * 0.62f), androidx.compose.ui.geometry.CornerRadius(s * 0.3f))
        drawOval(blue, Offset(s * 0.02f, s * 0.42f), Size(s * 0.32f, s * 0.42f))
        drawOval(blue, Offset(s * 0.66f, s * 0.42f), Size(s * 0.32f, s * 0.42f))
        drawOval(Color.White, Offset(s * 0.28f, s * 0.42f), Size(s * 0.15f, s * 0.18f))
        drawOval(Color.White, Offset(s * 0.57f, s * 0.42f), Size(s * 0.15f, s * 0.18f))
    }
}

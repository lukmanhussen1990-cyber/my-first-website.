package com.runova.app.ui.components

import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.graphics.vector.path
import androidx.compose.ui.unit.dp

/** Hand-made icons that Material Icons does not provide. All are tintable (single colour). */
object RunovaIcons {

    private fun stroked(name: String, width: Float = 1.9f, block: ImageVector.Builder.() -> Unit): ImageVector =
        ImageVector.Builder(name, 24.dp, 24.dp, 24f, 24f).apply(block).build()

    private fun ImageVector.Builder.line(width: Float, pathData: androidx.compose.ui.graphics.vector.PathBuilder.() -> Unit) {
        path(
            fill = null,
            stroke = SolidColor(Color.Black),
            strokeLineWidth = width,
            strokeLineCap = StrokeCap.Round,
            strokeLineJoin = StrokeJoin.Round,
            pathBuilder = pathData,
        )
    }

    private fun ImageVector.Builder.solid(pathData: androidx.compose.ui.graphics.vector.PathBuilder.() -> Unit) {
        path(fill = SolidColor(Color.Black), pathBuilder = pathData)
    }

    /** Running shoe, side view, pointing right. */
    val Sneaker: ImageVector by lazy {
        stroked("Sneaker") {
            line(1.9f) {
                moveTo(2.6f, 17.4f)
                lineTo(2.9f, 11.2f)
                curveTo(3.0f, 9.6f, 4.3f, 8.6f, 5.8f, 8.9f)
                curveTo(7.0f, 9.2f, 7.4f, 10.6f, 8.9f, 10.7f)
                curveTo(10.0f, 10.8f, 10.6f, 10.0f, 11.1f, 9.1f)
                lineTo(14.6f, 12.1f)
                curveTo(16.2f, 13.4f, 18.4f, 13.5f, 20.2f, 14.2f)
                curveTo(21.3f, 14.6f, 21.8f, 15.6f, 21.6f, 16.6f)
                lineTo(21.4f, 17.4f)
                close()
            }
            line(1.6f) {
                moveTo(12.2f, 12.3f); lineTo(13.2f, 11.2f)
                moveTo(10.5f, 13.4f); lineTo(11.6f, 12.3f)
                moveTo(2.8f, 15.0f); lineTo(21.7f, 15.0f)
            }
        }
    }

    /** Stylised sprinter used for the brand mark (filled capsules). */
    val Sprinter: ImageVector by lazy {
        ImageVector.Builder("Sprinter", 24.dp, 24.dp, 100f, 100f).apply {
            solid {
                // head
                moveTo(81f, 15f)
                arcTo(9.5f, 9.5f, 0f, true, true, 62f, 15f)
                arcTo(9.5f, 9.5f, 0f, true, true, 81f, 15f)
                close()
            }
            val w = 11.5f
            fun limb(vararg pts: Float) = path(
                fill = null,
                stroke = SolidColor(Color.Black),
                strokeLineWidth = w,
                strokeLineCap = StrokeCap.Round,
                strokeLineJoin = StrokeJoin.Round,
            ) {
                moveTo(pts[0], pts[1])
                var i = 2
                while (i < pts.size) { lineTo(pts[i], pts[i + 1]); i += 2 }
            }
            limb(62f, 31f, 46f, 55f)                 // torso
            limb(62f, 32f, 75f, 44f, 89f, 38f)       // front arm
            limb(60f, 33f, 45f, 37f, 37f, 49f)       // back arm
            limb(46f, 55f, 66f, 60f, 64f, 80f)       // front leg (knee drive)
            limb(46f, 55f, 33f, 69f, 12f, 76f)       // back leg (push off)
        }.build()
    }

    /** Friendly robot head for the AI coach. */
    val CoachBot: ImageVector by lazy {
        stroked("CoachBot") {
            line(1.8f) {
                // head
                moveTo(7f, 7.5f); lineTo(17f, 7.5f)
                curveTo(19f, 7.5f, 20.2f, 8.7f, 20.2f, 10.7f)
                lineTo(20.2f, 16.3f)
                curveTo(20.2f, 18.3f, 19f, 19.5f, 17f, 19.5f)
                lineTo(7f, 19.5f)
                curveTo(5f, 19.5f, 3.8f, 18.3f, 3.8f, 16.3f)
                lineTo(3.8f, 10.7f)
                curveTo(3.8f, 8.7f, 5f, 7.5f, 7f, 7.5f)
                close()
                // antenna
                moveTo(12f, 7.5f); lineTo(12f, 4.6f)
                // ears
                moveTo(1.6f, 12f); lineTo(1.6f, 15f)
                moveTo(22.4f, 12f); lineTo(22.4f, 15f)
            }
            solid {
                moveTo(12f, 2.2f)
                arcTo(1.4f, 1.4f, 0f, true, true, 12f, 5.0f)
                arcTo(1.4f, 1.4f, 0f, true, true, 12f, 2.2f)
                close()
                moveTo(9f, 12f)
                arcTo(1.5f, 1.5f, 0f, true, true, 9f, 15f)
                arcTo(1.5f, 1.5f, 0f, true, true, 9f, 12f)
                close()
                moveTo(15f, 12f)
                arcTo(1.5f, 1.5f, 0f, true, true, 15f, 15f)
                arcTo(1.5f, 1.5f, 0f, true, true, 15f, 12f)
                close()
            }
        }
    }

    /** Rising trend arrow, used for streak and progress badges. */
    val Streak: ImageVector by lazy {
        stroked("Streak") {
            line(1.9f) {
                moveTo(4f, 18f); lineTo(9.5f, 12.5f); lineTo(13f, 16f); lineTo(20f, 8.5f)
                moveTo(15.2f, 8.5f); lineTo(20f, 8.5f); lineTo(20f, 13.3f)
            }
        }
    }

    /** Sun rising over the horizon. */
    val Sunrise: ImageVector by lazy {
        stroked("Sunrise") {
            line(1.9f) {
                moveTo(7f, 17f)
                arcTo(5f, 5f, 0f, false, true, 17f, 17f)
                moveTo(3f, 17f); lineTo(21f, 17f)
                moveTo(12f, 5.5f); lineTo(12f, 8f)
                moveTo(4.9f, 9.9f); lineTo(6.6f, 11.6f)
                moveTo(19.1f, 9.9f); lineTo(17.4f, 11.6f)
                moveTo(7f, 20.5f); lineTo(17f, 20.5f)
            }
        }
    }
}

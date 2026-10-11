package com.imran.jarvis.ui.theme

import androidx.compose.material3.Typography
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Shadow
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp
import com.imran.jarvis.R

/** Orbitron (SIL Open Font License) gives the "JARVIS" title its sci-fi look. */
val TitleFont = FontFamily(Font(R.font.orbitron_bold, FontWeight.Bold))

val JarvisTypography = Typography()

/** The glowing white-to-ice-blue "JARVIS" lettering. */
fun titleStyle(sizeSp: Float = 30f) = TextStyle(
    fontFamily = TitleFont,
    fontWeight = FontWeight.Bold,
    fontSize = sizeSp.sp,
    letterSpacing = (sizeSp * 0.1f).sp,
    brush = Brush.verticalGradient(listOf(Color(0xFFFFFFFF), Color(0xFFBFE9FF))),
    shadow = Shadow(color = JarvisColors.Cyan.copy(alpha = 0.9f), offset = Offset.Zero, blurRadius = 26f),
)

/** Cyan glowing text, used for the "Listening..." label. */
fun glowStyle(sizeSp: Float = 20f) = TextStyle(
    fontSize = sizeSp.sp,
    fontWeight = FontWeight.Medium,
    color = JarvisColors.Cyan,
    shadow = Shadow(color = JarvisColors.Cyan.copy(alpha = 0.85f), offset = Offset.Zero, blurRadius = 20f),
)

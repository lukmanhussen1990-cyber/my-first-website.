package com.loe.chat.ui.components

import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.TextUnit
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.loe.chat.R
import com.loe.chat.ui.theme.LoeTheme

// Logo images are built from art/loe-logo.png by tools/logo/build_icons.py.

/** The logo on its black tile, as on the launcher. */
@Composable
fun LoeMark(size: Dp, modifier: Modifier = Modifier) {
    Image(
        cachedBitmap(R.drawable.loe_logo_tile),
        contentDescription = null,
        contentScale = ContentScale.Crop,
        modifier = modifier.size(size).clip(RoundedCornerShape(size * 0.24f)),
    )
}

/** Logo + "Loe" — the home screen header. */
@Composable
fun LoeWordmark(modifier: Modifier = Modifier, markSize: Dp = 32.dp, textSize: TextUnit = 28.sp) {
    Row(modifier, verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.Center) {
        LoeMark(markSize)
        Spacer(Modifier.width(8.dp))
        Text("Loe", fontSize = textSize, fontWeight = FontWeight.SemiBold, color = LoeTheme.colors.text)
    }
}

/** The launcher icon, large, with a pink neon glow. */
@Composable
fun LoeAppIcon(size: Dp, modifier: Modifier = Modifier) {
    val glow = Color(0xFFFF3EA5)
    LoeMark(
        size,
        modifier.shadow(size * 0.1f, RoundedCornerShape(size * 0.24f), ambientColor = glow, spotColor = glow),
    )
}

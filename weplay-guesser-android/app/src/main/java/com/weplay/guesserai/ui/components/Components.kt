package com.weplay.guesserai.ui.components

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.weplay.guesserai.R
import com.weplay.guesserai.ui.theme.CyanAccent
import com.weplay.guesserai.ui.theme.Lilac
import com.weplay.guesserai.ui.theme.Neon

@Composable
fun AppLogo(size: Dp = 96.dp) {
    Box(
        Modifier.size(size)
            .shadow(28.dp, RoundedCornerShape(size / 4), ambientColor = Neon, spotColor = Neon)
            .clip(RoundedCornerShape(size / 4))
            .background(Brush.linearGradient(listOf(Color(0xFF2A1250), Color(0xFF0E0A1A))))
            .border(1.5.dp, Brush.linearGradient(listOf(Lilac, Neon, CyanAccent)), RoundedCornerShape(size / 4)),
        contentAlignment = Alignment.Center,
    ) {
        Image(painterResource(R.drawable.ic_robot), contentDescription = "WePlay AI logo", Modifier.size(size))
    }
}

/** Dark glass card with a faint neon edge, used across the app. */
@Composable
fun GlassCard(modifier: Modifier = Modifier, content: @Composable ColumnScope.() -> Unit) {
    val shape = RoundedCornerShape(20.dp)
    Column(
        modifier.fillMaxWidth()
            .clip(shape)
            .background(MaterialTheme.colorScheme.surface)
            .border(1.dp, Brush.linearGradient(listOf(Neon.copy(alpha = 0.55f), Color.Transparent, CyanAccent.copy(alpha = 0.35f))), shape)
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
        content = content,
    )
}

@Composable
fun StatusPill(text: String, color: Color) {
    Row(
        Modifier.clip(RoundedCornerShape(50)).background(color.copy(alpha = 0.15f)).padding(horizontal = 10.dp, vertical = 4.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(Modifier.size(7.dp).clip(CircleShape).background(color))
        Spacer(Modifier.width(6.dp))
        Text(text, color = color, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
    }
}

@Composable
fun SectionTitle(text: String) {
    Text(
        text.uppercase(), color = MaterialTheme.colorScheme.onSurfaceVariant,
        fontSize = 12.sp, fontWeight = FontWeight.SemiBold, letterSpacing = 1.sp,
        modifier = Modifier.padding(top = 6.dp, start = 4.dp),
    )
}

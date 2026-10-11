package com.imran.jarvis.ui.components

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Person
import androidx.compose.material3.Icon
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.imran.jarvis.data.ChatMessage
import com.imran.jarvis.data.Role
import com.imran.jarvis.ui.theme.JarvisColors

/** One chat message: the user's on the right with a person icon, JARVIS's on the left with a mini orb. */
@Composable
fun ChatBubble(message: ChatMessage, userName: String, modifier: Modifier = Modifier) {
    if (message.role == Role.USER) {
        Row(
            modifier = modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.End,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            BubbleText(userName, message.text, isError = false, modifier = Modifier.weight(1f, fill = false))
            Spacer(Modifier.width(8.dp))
            UserAvatar()
        }
    } else {
        Row(
            modifier = modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.Start,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            MiniOrb(Modifier.size(44.dp))
            Spacer(Modifier.width(6.dp))
            BubbleText("JARVIS", message.text, message.isError, modifier = Modifier.weight(1f, fill = false))
        }
    }
}

@Composable
private fun BubbleText(name: String, text: String, isError: Boolean, modifier: Modifier = Modifier) {
    Surface(
        modifier = modifier.widthIn(max = 300.dp),
        shape = RoundedCornerShape(16.dp),
        color = JarvisColors.CardHigh,
        border = BorderStroke(1.dp, if (isError) Color(0xFF5B3140) else JarvisColors.Border),
    ) {
        Text(
            text = buildAnnotatedString {
                withStyle(SpanStyle(fontWeight = FontWeight.SemiBold)) { append("$name: ") }
                append(text)
            },
            color = JarvisColors.TextPrimary,
            fontSize = 15.sp,
            lineHeight = 21.sp,
            modifier = Modifier.padding(horizontal = 14.dp, vertical = 10.dp),
        )
    }
}

@Composable
private fun UserAvatar() {
    Box(
        modifier = Modifier
            .size(38.dp)
            .clip(CircleShape)
            .background(Color(0xFF0E2238))
            .border(1.dp, JarvisColors.Border, CircleShape),
        contentAlignment = Alignment.Center,
    ) {
        Icon(
            imageVector = Icons.Filled.Person,
            contentDescription = null,
            tint = Color(0xFF4DB2FF),
            modifier = Modifier.size(22.dp),
        )
    }
}

package com.loe.chat.ui.components

import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.loe.chat.data.Bot
import com.loe.chat.data.Conversation
import com.loe.chat.ui.theme.LoeTheme
import com.loe.chat.util.Text as TextUtil

/** A chat in Home / History: avatar, title, "Bot: preview", date and unread badge. */
@OptIn(ExperimentalFoundationApi::class)
@Composable
fun ConversationRow(
    conversation: Conversation,
    bot: Bot,
    onClick: () -> Unit,
    onLongClick: () -> Unit = {},
    modifier: Modifier = Modifier,
) {
    val colors = LoeTheme.colors
    val unread = conversation.unread > 0
    Row(
        modifier
            .fillMaxWidth()
            .combinedClickable(onClick = onClick, onLongClick = onLongClick)
            .padding(horizontal = 16.dp, vertical = 14.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        BotAvatar(bot, 32.dp)
        Spacer(Modifier.width(14.dp))
        Column(Modifier.weight(1f)) {
            Text(
                conversation.title,
                fontSize = 16.5.sp,
                fontWeight = if (unread) FontWeight.Bold else FontWeight.Normal,
                color = colors.text,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
            Spacer(Modifier.height(2.dp))
            val sender = conversation.lastSender
            Text(
                buildAnnotatedString {
                    if (sender != null) {
                        withStyle(SpanStyle(fontWeight = if (unread) FontWeight.Bold else FontWeight.Normal)) { append("$sender: ") }
                    }
                    append(conversation.lastPreview)
                },
                fontSize = 15.sp,
                color = if (unread) colors.text else colors.textSecondary,
                fontWeight = if (unread) FontWeight.SemiBold else FontWeight.Normal,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
        }
        Spacer(Modifier.width(10.dp))
        Column(horizontalAlignment = Alignment.End) {
            Text(TextUtil.listDate(conversation.updatedAt), fontSize = 13.5.sp, color = colors.textSecondary)
            Spacer(Modifier.height(6.dp))
            if (unread) CountBadge(conversation.unread) else Spacer(Modifier.height(20.dp))
        }
    }
}

package com.loe.chat.ui.chat

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.ArrowBack
import androidx.compose.material.icons.outlined.Description
import androidx.compose.material.icons.outlined.ErrorOutline
import androidx.compose.material.icons.outlined.Schedule
import androidx.compose.material.icons.outlined.Share
import androidx.compose.material.icons.rounded.DoneAll
import androidx.compose.material.icons.rounded.Refresh
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import com.loe.chat.data.Attachment
import com.loe.chat.data.Bot
import com.loe.chat.data.ChatMessage
import com.loe.chat.data.ErrorCodes
import com.loe.chat.data.MessageStatus
import com.loe.chat.engine.ChatEngine
import com.loe.chat.ui.components.BotAvatar
import com.loe.chat.ui.components.CountBadge
import com.loe.chat.ui.components.LoeIcons
import com.loe.chat.ui.components.MarkdownText
import com.loe.chat.ui.components.OutlinedIconPill
import com.loe.chat.ui.theme.LoeTheme
import com.loe.chat.util.Text
import kotlinx.coroutines.delay
import java.io.File

@Composable
fun ChatTopBar(
    title: String,
    bot: Bot,
    otherUnread: Int,
    onBack: () -> Unit,
    onBotClick: () -> Unit,
    onNewChat: () -> Unit,
    onShare: () -> Unit,
) {
    val colors = LoeTheme.colors
    Row(
        Modifier
            .fillMaxWidth()
            .background(colors.background)
            .statusBarsPadding()
            .height(64.dp)
            .padding(end = 4.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Row(
            Modifier
                .padding(start = 4.dp)
                .clip(RoundedCornerShape(22.dp))
                .clickable(onClick = onBack)
                .padding(start = 8.dp, end = 6.dp, top = 8.dp, bottom = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Icon(Icons.AutoMirrored.Rounded.ArrowBack, contentDescription = "Back", tint = colors.text)
            if (otherUnread > 0) {
                Spacer(Modifier.width(2.dp))
                CountBadge(otherUnread)
            }
        }
        Row(
            Modifier
                .weight(1f)
                .clip(RoundedCornerShape(12.dp))
                .clickable(onClick = onBotClick)
                .padding(horizontal = 6.dp, vertical = 4.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            BotAvatar(bot, 34.dp)
            Spacer(Modifier.width(10.dp))
            Column {
                Text(title, fontSize = 16.5.sp, fontWeight = FontWeight.Bold, color = colors.text, maxLines = 1, overflow = TextOverflow.Ellipsis)
                Text(bot.name, fontSize = 13.5.sp, color = colors.textSecondary, maxLines = 1, overflow = TextOverflow.Ellipsis)
            }
        }
        IconButton(onClick = onNewChat) {
            Icon(LoeIcons.NewChat, contentDescription = "New chat", tint = colors.text)
        }
        IconButton(onClick = onShare) {
            Icon(Icons.Outlined.Share, contentDescription = "Share chat", tint = colors.text)
        }
    }
}

@OptIn(ExperimentalFoundationApi::class)
@Composable
fun UserBubble(message: ChatMessage, onLongPress: () -> Unit, onImageClick: (File) -> Unit) {
    val colors = LoeTheme.colors
    Row(
        Modifier.fillMaxWidth().padding(start = 64.dp, end = 12.dp, top = 6.dp, bottom = 6.dp),
        horizontalArrangement = Arrangement.End,
    ) {
        Column(
            Modifier
                .clip(RoundedCornerShape(18.dp))
                .background(colors.userBubble)
                .combinedClickable(onClick = {}, onLongClick = onLongPress)
                .padding(horizontal = 16.dp, vertical = 10.dp),
        ) {
            AttachmentsView(message.attachments, onImageClick, onDark = true)
            if (message.content.isNotBlank()) {
                Text(message.content, fontSize = 17.sp, color = colors.userBubbleText, lineHeight = 23.sp)
            }
            Spacer(Modifier.height(4.dp))
            Row(Modifier.align(Alignment.End), verticalAlignment = Alignment.CenterVertically) {
                Text(Text.messageTime(message.createdAt), fontSize = 13.sp, color = colors.userBubbleMeta)
                Spacer(Modifier.width(4.dp))
                Icon(
                    if (message.status == MessageStatus.SENDING) Icons.Outlined.Schedule else Icons.Rounded.DoneAll,
                    contentDescription = if (message.status == MessageStatus.SENDING) "Sending" else "Sent",
                    tint = colors.userBubbleMeta,
                    modifier = Modifier.size(15.dp),
                )
            }
        }
    }
}

@Composable
fun BotHeader(bot: Bot) {
    Row(verticalAlignment = Alignment.CenterVertically) {
        BotAvatar(bot, 24.dp)
        Spacer(Modifier.width(8.dp))
        Text(bot.name, fontSize = 16.sp, color = LoeTheme.colors.text)
    }
}

@OptIn(ExperimentalFoundationApi::class)
@Composable
fun BotMessage(
    message: ChatMessage,
    bot: Bot,
    live: ChatEngine.LiveReply?,
    showActions: Boolean,
    onLongPress: () -> Unit,
    onShare: () -> Unit,
    onRetry: () -> Unit,
    onFixKeys: () -> Unit,
    onOpenSettings: () -> Unit,
    onImageClick: (File) -> Unit,
) {
    val colors = LoeTheme.colors
    val streaming = message.status == MessageStatus.STREAMING
    Column(Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 6.dp)) {
        BotHeader(bot)
        Spacer(Modifier.height(8.dp))
        Column(
            Modifier
                .clip(RoundedCornerShape(14.dp))
                .background(colors.botBubble)
                .combinedClickable(onClick = {}, onLongClick = onLongPress)
                .padding(horizontal = 16.dp, vertical = 12.dp),
        ) {
            val text = if (streaming) live?.text.orEmpty() else message.content
            when {
                streaming && (live == null || !live.hasOutput) -> ThinkingIndicator(live?.startedAt ?: message.createdAt)
                else -> {
                    if (text.isNotBlank()) MarkdownText(text)
                    if (message.attachments.isNotEmpty()) {
                        if (text.isNotBlank()) Spacer(Modifier.height(8.dp))
                        AttachmentsView(message.attachments, onImageClick, onDark = false)
                    }
                    when (message.status) {
                        MessageStatus.ERROR -> ErrorBox(message, onRetry, onFixKeys, onOpenSettings, hasText = text.isNotBlank())
                        MessageStatus.REFUSED -> {
                            Text(message.error.orEmpty(), fontSize = 16.sp, fontStyle = FontStyle.Italic, color = colors.textSecondary)
                        }
                        else -> Unit
                    }
                    if (!streaming && message.status != MessageStatus.ERROR) {
                        Spacer(Modifier.height(4.dp))
                        Text(
                            (if (message.status == MessageStatus.STOPPED) "Stopped · " else "") + Text.messageTime(message.createdAt),
                            fontSize = 13.sp,
                            color = colors.textSecondary,
                            modifier = Modifier.align(Alignment.End),
                        )
                    }
                }
            }
        }
        if (showActions && !streaming) {
            Spacer(Modifier.height(10.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                if (message.content.isNotBlank() || message.attachments.isNotEmpty()) {
                    OutlinedIconPill(Icons.Outlined.Share, "Share reply", onShare)
                }
                OutlinedIconPill(Icons.Rounded.Refresh, "Retry", onRetry)
            }
        }
    }
}

@Composable
private fun ThinkingIndicator(startedAt: Long) {
    var now by remember { mutableLongStateOf(System.currentTimeMillis()) }
    LaunchedEffect(startedAt) {
        while (true) {
            delay(250)
            now = System.currentTimeMillis()
        }
    }
    val elapsedMs = now - startedAt
    if (elapsedMs < 1_500) {
        val dots = ".".repeat(((elapsedMs / 400) % 3 + 1).toInt())
        Text(dots.padEnd(3, ' '), fontSize = 17.sp, color = LoeTheme.colors.text, fontWeight = FontWeight.Bold)
    } else {
        Text("Thinking... (${elapsedMs / 1000}s elapsed)", fontSize = 17.sp, color = LoeTheme.colors.text)
    }
}

@Composable
private fun ErrorBox(message: ChatMessage, onRetry: () -> Unit, onFixKeys: () -> Unit, onOpenSettings: () -> Unit, hasText: Boolean) {
    val colors = LoeTheme.colors
    if (hasText) Spacer(Modifier.height(10.dp))
    Row(verticalAlignment = Alignment.Top) {
        Icon(Icons.Outlined.ErrorOutline, contentDescription = null, tint = colors.danger, modifier = Modifier.size(20.dp).padding(top = 2.dp))
        Spacer(Modifier.width(8.dp))
        Text(message.error ?: "Something went wrong.", fontSize = 16.sp, color = colors.text, lineHeight = 22.sp)
    }
    Spacer(Modifier.height(10.dp))
    val (label, action) = when (message.errorCode) {
        ErrorCodes.NO_KEY, ErrorCodes.AUTH -> "Add API key" to onFixKeys
        ErrorCodes.BUDGET, ErrorCodes.POINTS -> "Open settings" to onOpenSettings
        else -> "Retry" to onRetry
    }
    Text(
        label,
        modifier = Modifier
            .clip(RoundedCornerShape(18.dp))
            .background(colors.primary)
            .clickable(onClick = action)
            .padding(horizontal = 16.dp, vertical = 8.dp),
        color = colors.onPrimary,
        fontWeight = FontWeight.SemiBold,
        fontSize = 15.sp,
    )
}

@Composable
private fun AttachmentsView(attachments: List<Attachment>, onImageClick: (File) -> Unit, onDark: Boolean) {
    if (attachments.isEmpty()) return
    val colors = LoeTheme.colors
    Column(verticalArrangement = Arrangement.spacedBy(6.dp), modifier = Modifier.padding(bottom = 6.dp)) {
        attachments.forEach { a ->
            if (a.isImage) {
                AsyncImage(
                    model = File(a.path),
                    contentDescription = a.name,
                    contentScale = ContentScale.FillWidth,
                    modifier = Modifier
                        .widthIn(max = 280.dp)
                        .heightIn(max = 360.dp)
                        .clip(RoundedCornerShape(12.dp))
                        .clickable { onImageClick(File(a.path)) },
                )
            } else {
                Row(
                    Modifier
                        .clip(RoundedCornerShape(10.dp))
                        .background(if (onDark) colors.userBubbleMeta.copy(alpha = 0.25f) else colors.composer)
                        .padding(horizontal = 10.dp, vertical = 8.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Icon(Icons.Outlined.Description, contentDescription = null, tint = if (onDark) colors.userBubbleText else colors.text, modifier = Modifier.size(18.dp))
                    Spacer(Modifier.width(6.dp))
                    Text(a.name, fontSize = 14.sp, color = if (onDark) colors.userBubbleText else colors.text, maxLines = 1, overflow = TextOverflow.Ellipsis)
                }
            }
        }
    }
}

@Composable
fun ContextDivider() {
    val colors = LoeTheme.colors
    Row(Modifier.fillMaxWidth().padding(horizontal = 24.dp, vertical = 14.dp), verticalAlignment = Alignment.CenterVertically) {
        HorizontalDivider(Modifier.weight(1f), color = colors.divider)
        Text("Context cleared", fontSize = 13.sp, color = colors.textSecondary, modifier = Modifier.padding(horizontal = 12.dp))
        HorizontalDivider(Modifier.weight(1f), color = colors.divider)
    }
}

/** The "Stop" pill shown above the composer while a bot is replying. */
@Composable
fun StopButton(onStop: () -> Unit, modifier: Modifier = Modifier) {
    val colors = LoeTheme.colors
    Row(
        modifier
            .clip(RoundedCornerShape(22.dp))
            .border(BorderStroke(1.dp, colors.outline), RoundedCornerShape(22.dp))
            .background(colors.background)
            .clickable(onClick = onStop)
            .padding(start = 12.dp, end = 18.dp, top = 8.dp, bottom = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(contentAlignment = Alignment.Center) {
            CircularProgressIndicator(Modifier.size(26.dp), strokeWidth = 2.dp, color = colors.textTertiary, trackColor = colors.outline)
            Box(Modifier.size(10.dp).background(colors.text, RoundedCornerShape(2.dp)))
        }
        Spacer(Modifier.width(8.dp))
        Text("Stop", fontSize = 17.sp, fontWeight = FontWeight.Bold, color = colors.text)
    }
}

@Composable
fun SmallCircle(content: @Composable () -> Unit) {
    Box(Modifier.size(38.dp).clip(CircleShape).background(LoeTheme.colors.pill), contentAlignment = Alignment.Center) { content() }
}

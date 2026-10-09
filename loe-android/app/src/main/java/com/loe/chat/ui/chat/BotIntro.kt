package com.loe.chat.ui.chat

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.KeyboardArrowRight
import androidx.compose.material.icons.outlined.Forum
import androidx.compose.material.icons.outlined.GroupAdd
import androidx.compose.material.icons.outlined.Link
import androidx.compose.material.icons.outlined.PersonAddAlt
import androidx.compose.material.icons.outlined.Share
import androidx.compose.material.icons.rounded.HowToReg
import androidx.compose.material.icons.rounded.MoreHoriz
import androidx.compose.material.icons.rounded.Shield
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.loe.chat.ai.Route
import com.loe.chat.data.Bot
import com.loe.chat.data.BotKind
import com.loe.chat.data.Conversation
import com.loe.chat.data.Creators
import com.loe.chat.ui.components.BotAvatar
import com.loe.chat.ui.components.CircleIconButton
import com.loe.chat.ui.components.LoeCard
import com.loe.chat.ui.components.OfficialTag
import com.loe.chat.ui.components.PillButton
import com.loe.chat.ui.theme.LoeTheme

/** The bot card shown at the top of a new chat. */
@Composable
fun BotIntro(
    bot: Bot,
    creatorLabel: String,
    route: Route?,
    followed: Boolean,
    lastChat: Conversation?,
    onHistory: () -> Unit,
    onToggleFollow: () -> Unit,
    onShare: () -> Unit,
    onDetails: () -> Unit,
    onCreateLikeThis: () -> Unit,
    onConnectKey: () -> Unit,
    onInvite: () -> Unit,
    onContinue: (Conversation) -> Unit,
) {
    val colors = LoeTheme.colors
    var menu by remember { mutableStateOf(false) }
    Column(Modifier.padding(horizontal = 12.dp, vertical = 8.dp)) {
        LoeCard(contentPadding = androidx.compose.foundation.layout.PaddingValues(16.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                BotAvatar(bot, 52.dp)
                Spacer(Modifier.width(14.dp))
                Column(Modifier.weight(1f)) {
                    Text(bot.name, fontSize = 20.sp, fontWeight = FontWeight.Bold, color = colors.text, maxLines = 1, overflow = TextOverflow.Ellipsis)
                    Text(
                        buildAnnotatedString {
                            append("By ")
                            withStyle(SpanStyle(color = colors.link)) { append(creatorLabel) }
                        },
                        fontSize = 15.sp,
                        color = colors.textSecondary,
                    )
                }
            }
            Spacer(Modifier.height(10.dp))
            Text(
                "${bot.points} points per message" + (bot.contextLabel.takeIf { it.isNotBlank() && it.first().isDigit() }?.let { " · $it" } ?: ""),
                fontSize = 14.5.sp,
                fontWeight = FontWeight.SemiBold,
                color = colors.textSecondary,
            )
            Spacer(Modifier.height(12.dp))
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                PillButton("History", onClick = onHistory, icon = Icons.Outlined.Forum, modifier = Modifier.weight(1f))
                CircleIconButton(
                    if (followed) Icons.Rounded.HowToReg else Icons.Outlined.PersonAddAlt,
                    if (followed) "Unfollow" else "Follow",
                    onToggleFollow,
                    tint = if (followed) colors.primary else colors.text,
                )
                CircleIconButton(Icons.Outlined.Share, "Share bot", onShare)
                Box {
                    CircleIconButton(Icons.Rounded.MoreHoriz, "More", { menu = true })
                    DropdownMenu(expanded = menu, onDismissRequest = { menu = false }) {
                        DropdownMenuItem(text = { Text("View details") }, onClick = { menu = false; onDetails() })
                        if (bot.kind == BotKind.TEXT) {
                            DropdownMenuItem(
                                text = { Text(if (bot.isCustom) "Edit bot" else "Create a bot based on this") },
                                onClick = { menu = false; onCreateLikeThis() },
                            )
                        }
                    }
                }
            }
            Spacer(Modifier.height(14.dp))
            Text(bot.description, fontSize = 16.sp, color = colors.text, lineHeight = 22.sp)
            Spacer(Modifier.height(12.dp))
            Box(Modifier.fillMaxWidth().height(1.dp).background(colors.divider))
            Spacer(Modifier.height(12.dp))
            Row(verticalAlignment = Alignment.Top) {
                Icon(Icons.Rounded.Shield, contentDescription = null, tint = colors.textSecondary, modifier = Modifier.size(20.dp).padding(top = 2.dp))
                Spacer(Modifier.width(10.dp))
                Text(
                    buildAnnotatedString {
                        if (route != null) {
                            append("Powered by ${route.provider.displayName}: ${route.model}. ")
                            withStyle(SpanStyle(color = colors.link)) { append("Learn more.") }
                        } else {
                            append("Not connected yet. ")
                            withStyle(SpanStyle(color = colors.link)) { append("Add an API key to chat with this bot.") }
                        }
                    },
                    fontSize = 14.sp,
                    color = colors.textSecondary,
                    modifier = Modifier.clickable(onClick = if (route != null) onDetails else onConnectKey),
                )
            }
            Spacer(Modifier.height(14.dp))
            Text("View details", fontSize = 16.sp, color = colors.link, modifier = Modifier.clickable(onClick = onDetails))
            if (bot.official) {
                Spacer(Modifier.height(12.dp))
                OfficialTag()
            }
        }
        Spacer(Modifier.height(12.dp))
        Row(Modifier.padding(horizontal = 12.dp), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            IntroAction(Icons.Outlined.Link, "Invite link", onInvite, Modifier.weight(1f))
            IntroAction(Icons.Outlined.GroupAdd, "Add people", onInvite, Modifier.weight(1f))
        }
        if (lastChat != null) {
            Spacer(Modifier.height(12.dp))
            Row(
                Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(14.dp))
                    .background(colors.surface)
                    .clickable { onContinue(lastChat) }
                    .padding(horizontal = 16.dp, vertical = 12.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Column(Modifier.weight(1f)) {
                    Text(lastChat.title, fontSize = 16.5.sp, color = colors.text, maxLines = 1, overflow = TextOverflow.Ellipsis)
                    Text("Continue with this bot", fontSize = 15.sp, color = colors.textSecondary)
                }
                Box(Modifier.size(40.dp).clip(CircleShape).background(colors.pill), contentAlignment = Alignment.Center) {
                    Icon(Icons.AutoMirrored.Rounded.KeyboardArrowRight, contentDescription = null, tint = colors.text)
                }
            }
        }
    }
}

@Composable
private fun IntroAction(icon: ImageVector, label: String, onClick: () -> Unit, modifier: Modifier) {
    val colors = LoeTheme.colors
    Column(
        modifier
            .clip(RoundedCornerShape(14.dp))
            .background(colors.surface)
            .clickable(onClick = onClick)
            .padding(vertical = 12.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Icon(icon, contentDescription = null, tint = colors.text, modifier = Modifier.size(22.dp))
        Spacer(Modifier.height(6.dp))
        Text(label, fontSize = 15.sp, fontWeight = FontWeight.SemiBold, color = colors.text)
    }
}

fun creatorLabel(bot: Bot, userHandle: String): String =
    if (bot.isCustom) "@${userHandle.ifBlank { "you" }}" else "@${bot.creator}"

fun creatorName(bot: Bot): String = Creators.displayName(bot.creator)

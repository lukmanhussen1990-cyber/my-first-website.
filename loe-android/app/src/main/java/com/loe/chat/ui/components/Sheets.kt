package com.loe.chat.ui.components

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Check
import androidx.compose.material.icons.rounded.Search
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.loe.chat.data.Bot
import com.loe.chat.data.ResponseStyle
import com.loe.chat.ui.theme.LoeTheme

/** Rounded search box ("Search for bots or people"). */
@Composable
fun SearchField(query: String, onQueryChange: (String) -> Unit, placeholder: String, modifier: Modifier = Modifier) {
    val colors = LoeTheme.colors
    Row(
        modifier
            .fillMaxWidth()
            .height(54.dp)
            .clip(RoundedCornerShape(27.dp))
            .border(BorderStroke(1.5.dp, colors.divider), RoundedCornerShape(27.dp))
            .padding(horizontal = 14.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(Icons.Rounded.Search, contentDescription = null, tint = colors.text, modifier = Modifier.size(26.dp))
        Spacer(Modifier.width(14.dp))
        BasicTextField(
            value = query,
            onValueChange = onQueryChange,
            singleLine = true,
            textStyle = TextStyle(fontSize = 16.sp, color = colors.text),
            cursorBrush = SolidColor(colors.primary),
            modifier = Modifier.weight(1f),
            decorationBox = { inner ->
                Box {
                    if (query.isEmpty()) Text(placeholder, fontSize = 16.sp, color = colors.textSecondary, maxLines = 1)
                    inner()
                }
            },
        )
    }
}

/** A bot in a list: avatar, name, description, optional tag and trailing content. */
@Composable
fun BotListRow(
    bot: Bot,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    avatarSize: Dp = 72.dp,
    showTag: Boolean = true,
    descriptionLines: Int = 2,
    trailing: (@Composable () -> Unit)? = null,
) {
    val colors = LoeTheme.colors
    Row(
        modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
            .padding(horizontal = 16.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        BotAvatar(bot, avatarSize)
        Spacer(Modifier.width(14.dp))
        Column(Modifier.weight(1f)) {
            Text(bot.name, fontSize = 16.5.sp, fontWeight = FontWeight.Bold, color = colors.text, maxLines = 1, overflow = TextOverflow.Ellipsis)
            Text(
                bot.description,
                fontSize = 14.5.sp,
                color = colors.text,
                maxLines = descriptionLines,
                overflow = TextOverflow.Ellipsis,
                lineHeight = 19.5.sp,
            )
            if (showTag && bot.official) {
                Spacer(Modifier.height(4.dp))
                OfficialTag()
            }
        }
        if (trailing != null) {
            Spacer(Modifier.width(8.dp))
            trailing()
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun BotPickerSheet(
    title: String,
    bots: List<Bot>,
    selectedId: String?,
    onPick: (Bot) -> Unit,
    onDismiss: () -> Unit,
) {
    val state = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    var query by remember { mutableStateOf("") }
    val filtered = remember(query, bots) {
        val q = query.trim()
        if (q.isEmpty()) bots else bots.filter { it.name.contains(q, true) || it.description.contains(q, true) || it.creator.contains(q, true) }
    }
    ModalBottomSheet(onDismissRequest = onDismiss, sheetState = state, containerColor = LoeTheme.colors.background) {
        Column(Modifier.fillMaxHeight(0.88f)) {
            Text(title, fontSize = 20.sp, fontWeight = FontWeight.Bold, color = LoeTheme.colors.text, modifier = Modifier.padding(horizontal = 16.dp))
            Spacer(Modifier.height(12.dp))
            SearchField(query, { query = it }, "Search bots", Modifier.padding(horizontal = 16.dp))
            Spacer(Modifier.height(8.dp))
            LazyColumn(Modifier.weight(1f)) {
                items(filtered, key = { it.id }) { bot ->
                    BotListRow(
                        bot = bot,
                        onClick = { onPick(bot) },
                        avatarSize = 44.dp,
                        showTag = false,
                        descriptionLines = 1,
                        trailing = if (bot.id == selectedId) {
                            { Icon(Icons.Rounded.Check, contentDescription = "Selected", tint = LoeTheme.colors.primary) }
                        } else {
                            null
                        },
                    )
                }
            }
        }
    }
}

/** The sliders button: answer length and custom instructions for a chat. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ChatOptionsSheet(
    style: ResponseStyle,
    instructions: String,
    onSave: (ResponseStyle, String) -> Unit,
    onDismiss: () -> Unit,
    extraActions: @Composable ColumnScope.() -> Unit = {},
) {
    val colors = LoeTheme.colors
    var selected by remember { mutableStateOf(style) }
    var text by remember { mutableStateOf(instructions) }
    ModalBottomSheet(onDismissRequest = onDismiss, containerColor = colors.background) {
        Column(Modifier.padding(horizontal = 16.dp).navigationBarsPadding().padding(bottom = 16.dp)) {
            Text("Chat options", fontSize = 20.sp, fontWeight = FontWeight.Bold, color = colors.text)
            Spacer(Modifier.height(16.dp))
            Text("Response length", fontSize = 15.sp, color = colors.textSecondary)
            Spacer(Modifier.height(8.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                ResponseStyle.entries.forEach { option ->
                    val active = option == selected
                    Text(
                        option.label,
                        modifier = Modifier
                            .clip(RoundedCornerShape(8.dp))
                            .background(if (active) colors.chipSelectedBg else colors.background)
                            .border(BorderStroke(1.dp, colors.chipBorder), RoundedCornerShape(8.dp))
                            .clickable { selected = option }
                            .padding(horizontal = 14.dp, vertical = 8.dp),
                        fontWeight = FontWeight.Bold,
                        color = if (active) colors.chipSelectedText else colors.text,
                    )
                }
            }
            Spacer(Modifier.height(18.dp))
            Text("Custom instructions", fontSize = 15.sp, color = colors.textSecondary)
            Spacer(Modifier.height(8.dp))
            OutlinedTextField(
                value = text,
                onValueChange = { text = it },
                placeholder = { Text("For example: Answer in simple English. Use short paragraphs.") },
                modifier = Modifier.fillMaxWidth().heightIn(min = 110.dp),
                colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = colors.primary, cursorColor = colors.primary),
            )
            Spacer(Modifier.height(16.dp))
            PrimaryButton("Save", onClick = { onSave(selected, text) })
            extraActions()
        }
    }
}

@Composable
fun SheetActionRow(icon: ImageVector, label: String, onClick: () -> Unit, destructive: Boolean = false) {
    val colors = LoeTheme.colors
    Row(
        Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(10.dp))
            .clickable(onClick = onClick)
            .padding(horizontal = 4.dp, vertical = 14.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(icon, contentDescription = null, tint = if (destructive) colors.danger else colors.text)
        Spacer(Modifier.width(16.dp))
        Text(label, fontSize = 17.sp, color = if (destructive) colors.danger else colors.text)
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ActionSheet(onDismiss: () -> Unit, content: @Composable ColumnScope.() -> Unit) {
    ModalBottomSheet(onDismissRequest = onDismiss, containerColor = LoeTheme.colors.background) {
        Column(Modifier.padding(horizontal = 16.dp).navigationBarsPadding().padding(bottom = 12.dp), content = content)
    }
}

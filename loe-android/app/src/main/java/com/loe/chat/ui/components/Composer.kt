package com.loe.chat.ui.components

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.ArrowForward
import androidx.compose.material.icons.outlined.CleaningServices
import androidx.compose.material.icons.outlined.Description
import androidx.compose.material.icons.outlined.GridView
import androidx.compose.material.icons.outlined.Mic
import androidx.compose.material.icons.rounded.Add
import androidx.compose.material.icons.rounded.AlternateEmail
import androidx.compose.material.icons.rounded.Close
import androidx.compose.material.icons.rounded.Tune
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
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.layout.Layout
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Constraints
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import com.loe.chat.data.Attachment
import com.loe.chat.data.Bot
import com.loe.chat.ui.theme.LoeTheme
import java.io.File

/**
 * The message box. Collapsed it's one row ("+ @ ⚙ Start a new chat 🎤"); focused or with text it
 * grows to the text on top and the buttons underneath, with a send button.
 */
@Composable
fun Composer(
    text: String,
    onTextChange: (String) -> Unit,
    placeholder: String,
    onSend: () -> Unit,
    modifier: Modifier = Modifier,
    attachments: List<Attachment> = emptyList(),
    onRemoveAttachment: (Attachment) -> Unit = {},
    onAttach: () -> Unit = {},
    onMention: () -> Unit = {},
    onOptions: () -> Unit = {},
    onMic: () -> Unit = {},
    showBroom: Boolean = false,
    onBroom: () -> Unit = {},
    canSend: Boolean = true,
    focusRequester: FocusRequester = remember { FocusRequester() },
) {
    val colors = LoeTheme.colors
    var focused by remember { mutableStateOf(false) }
    val hasContent = text.isNotBlank() || attachments.isNotEmpty()
    val expanded = focused || hasContent

    Column(
        modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(16.dp))
            .background(colors.composer),
    ) {
        if (attachments.isNotEmpty()) {
            Row(
                Modifier.horizontalScroll(rememberScrollState()).padding(start = 12.dp, end = 12.dp, top = 12.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                attachments.forEach { AttachmentChip(it) { onRemoveAttachment(it) } }
            }
        }
        ComposerLayout(
            expanded = expanded,
            leading = {
                Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(start = 6.dp)) {
                    if (showBroom) {
                        ComposerIcon(Icons.Outlined.CleaningServices, "Clear context", onBroom)
                        Box(Modifier.width(1.dp).height(22.dp).background(colors.chipBorder))
                    }
                    ComposerIcon(Icons.Rounded.Add, "Add photo or file", onAttach)
                    ComposerIcon(Icons.Rounded.AlternateEmail, "Mention a bot", onMention)
                    ComposerIcon(Icons.Rounded.Tune, "Options", onOptions)
                }
            },
            field = {
                BasicTextField(
                    value = text,
                    onValueChange = onTextChange,
                    textStyle = TextStyle(fontSize = 16.sp, color = colors.text, lineHeight = 22.sp),
                    cursorBrush = SolidColor(colors.primary),
                    maxLines = 6,
                    keyboardOptions = KeyboardOptions(capitalization = KeyboardCapitalization.Sentences),
                    modifier = Modifier
                        .focusRequester(focusRequester)
                        .onFocusChanged { focused = it.isFocused }
                        .padding(
                            if (expanded) PaddingValues(start = 18.dp, end = 18.dp, top = 14.dp, bottom = 4.dp)
                            else PaddingValues(start = 4.dp, end = 4.dp, top = 12.dp, bottom = 12.dp),
                        ),
                    decorationBox = { inner ->
                        Box {
                            if (text.isEmpty()) {
                                Text(placeholder, fontSize = 16.sp, color = colors.textSecondary, maxLines = 1, overflow = TextOverflow.Ellipsis)
                            }
                            inner()
                        }
                    },
                )
            },
            trailing = {
                Box(Modifier.padding(end = 8.dp)) {
                    if (hasContent && canSend) {
                        Box(
                            Modifier
                                .padding(vertical = 6.dp)
                                .size(34.dp)
                                .clip(CircleShape)
                                .background(colors.primary)
                                .clickable(onClick = onSend),
                            contentAlignment = Alignment.Center,
                        ) {
                            Icon(Icons.AutoMirrored.Rounded.ArrowForward, contentDescription = "Send", tint = Color.White, modifier = Modifier.size(20.dp))
                        }
                    } else {
                        ComposerIcon(Icons.Outlined.Mic, "Voice input", onMic)
                    }
                }
            },
        )
    }
}

@Composable
private fun ComposerLayout(
    expanded: Boolean,
    leading: @Composable () -> Unit,
    field: @Composable () -> Unit,
    trailing: @Composable () -> Unit,
) {
    // One layout for both shapes keeps the same text field instance, so focus survives the switch.
    Layout(contents = listOf(leading, field, trailing), modifier = Modifier.fillMaxWidth()) { measurables, constraints ->
        val width = constraints.maxWidth
        val lead = measurables[0].first().measure(Constraints())
        val trail = measurables[2].first().measure(Constraints())
        if (!expanded) {
            val fieldWidth = (width - lead.width - trail.width).coerceAtLeast(0)
            val input = measurables[1].first().measure(Constraints(minWidth = fieldWidth, maxWidth = fieldWidth))
            val height = maxOf(lead.height, trail.height, input.height)
            layout(width, height) {
                lead.place(0, (height - lead.height) / 2)
                input.place(lead.width, (height - input.height) / 2)
                trail.place(width - trail.width, (height - trail.height) / 2)
            }
        } else {
            val input = measurables[1].first().measure(Constraints(minWidth = width, maxWidth = width))
            val row = maxOf(lead.height, trail.height)
            val height = input.height + row
            layout(width, height) {
                input.place(0, 0)
                lead.place(0, input.height + (row - lead.height) / 2)
                trail.place(width - trail.width, input.height + (row - trail.height) / 2)
            }
        }
    }
}

@Composable
private fun ComposerIcon(icon: ImageVector, description: String, onClick: () -> Unit) {
    Box(
        Modifier
            .size(44.dp)
            .clip(CircleShape)
            .clickable(onClick = onClick),
        contentAlignment = Alignment.Center,
    ) {
        Icon(icon, contentDescription = description, tint = LoeTheme.colors.text, modifier = Modifier.size(24.dp))
    }
}

@Composable
private fun AttachmentChip(attachment: Attachment, onRemove: () -> Unit) {
    val colors = LoeTheme.colors
    Box {
        if (attachment.isImage) {
            AsyncImage(
                model = File(attachment.path),
                contentDescription = attachment.name,
                contentScale = ContentScale.Crop,
                modifier = Modifier.size(60.dp).clip(RoundedCornerShape(10.dp)),
            )
        } else {
            Row(
                Modifier
                    .height(60.dp)
                    .clip(RoundedCornerShape(10.dp))
                    .background(colors.background)
                    .padding(horizontal = 12.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Icon(Icons.Outlined.Description, contentDescription = null, tint = colors.textSecondary)
                Spacer(Modifier.width(6.dp))
                Text(attachment.name, fontSize = 14.sp, color = colors.text, maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.width(110.dp))
            }
        }
        Box(
            Modifier
                .align(Alignment.TopEnd)
                .padding(3.dp)
                .size(20.dp)
                .clip(CircleShape)
                .background(Color(0xAA000000))
                .clickable(onClick = onRemove),
            contentAlignment = Alignment.Center,
        ) {
            Icon(Icons.Rounded.Close, contentDescription = "Remove", tint = Color.White, modifier = Modifier.size(14.dp))
        }
    }
}

/** Bot selector chips above the home composer, ending with "More". */
@Composable
fun BotChipsRow(
    bots: List<Bot>,
    selectedId: String,
    onSelect: (Bot) -> Unit,
    onMore: () -> Unit,
    modifier: Modifier = Modifier,
) {
    LazyRow(
        modifier.fillMaxWidth(),
        contentPadding = PaddingValues(horizontal = 8.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        items(bots, key = { it.id }) { bot ->
            BotChip(bot, selected = bot.id == selectedId, onClick = { onSelect(bot) })
        }
        item(key = "more") {
            ChipFrame(selected = false, onClick = onMore) {
                Icon(Icons.Outlined.GridView, contentDescription = null, tint = LoeTheme.colors.text, modifier = Modifier.size(22.dp))
                Spacer(Modifier.width(6.dp))
                Text("More", fontSize = 16.sp, fontWeight = FontWeight.Bold, color = LoeTheme.colors.text)
            }
        }
    }
}

@Composable
fun BotChip(bot: Bot, selected: Boolean, onClick: () -> Unit) {
    ChipFrame(selected = selected, onClick = onClick) {
        BotAvatar(bot, 24.dp)
        Spacer(Modifier.width(8.dp))
        Text(
            bot.name,
            fontSize = 15.5.sp,
            fontWeight = FontWeight.Bold,
            color = if (selected) LoeTheme.colors.chipSelectedText else LoeTheme.colors.text,
            maxLines = 1,
        )
    }
}

@Composable
private fun ChipFrame(selected: Boolean, onClick: () -> Unit, content: @Composable () -> Unit) {
    val colors = LoeTheme.colors
    Row(
        Modifier
            .height(38.dp)
            .clip(RoundedCornerShape(8.dp))
            .background(if (selected) colors.chipSelectedBg else colors.background)
            .border(BorderStroke(1.dp, colors.chipBorder), RoundedCornerShape(8.dp))
            .clickable(onClick = onClick)
            .padding(horizontal = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) { content() }
}

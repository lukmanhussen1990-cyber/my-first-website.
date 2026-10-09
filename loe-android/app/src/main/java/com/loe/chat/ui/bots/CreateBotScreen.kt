package com.loe.chat.ui.bots

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.ExpandMore
import androidx.compose.material3.Icon
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.navigation.NavController
import com.loe.chat.AppGraph
import com.loe.chat.data.AvatarStyle
import com.loe.chat.data.Bot
import com.loe.chat.data.BotCatalog
import com.loe.chat.data.BotCategory
import com.loe.chat.ui.Routes
import com.loe.chat.ui.components.BotAvatar
import com.loe.chat.ui.components.BotPickerSheet
import com.loe.chat.ui.components.ConfirmDialog
import com.loe.chat.ui.components.LoeTopBar
import com.loe.chat.ui.components.PrimaryButton
import com.loe.chat.ui.theme.LoeTheme
import com.loe.chat.util.Toasts
import kotlinx.coroutines.launch
import java.util.UUID

private val botColors = listOf(
    0xFF5C5ADD, 0xFF0EA5E9, 0xFF10B981, 0xFFF59E0B, 0xFFEF4444, 0xFFEC4899, 0xFF8B5CF6, 0xFF111827,
)

@Composable
fun CreateBotScreen(graph: AppGraph, nav: NavController, editId: String?, baseId: String?) {
    val colors = LoeTheme.colors
    val context = androidx.compose.ui.platform.LocalContext.current
    val scope = rememberCoroutineScope()
    val allBots by graph.bots.all.collectAsState()
    val existing = remember(editId) { editId?.let { graph.bots.get(it) }?.takeIf { it.isCustom } }

    var name by rememberSaveable { mutableStateOf(existing?.name.orEmpty()) }
    var description by rememberSaveable { mutableStateOf(existing?.description.orEmpty()) }
    var prompt by rememberSaveable { mutableStateOf(existing?.systemPrompt.orEmpty()) }
    var greeting by rememberSaveable { mutableStateOf(existing?.greeting.orEmpty()) }
    var emoji by rememberSaveable { mutableStateOf(existing?.emoji.orEmpty()) }
    var color by rememberSaveable { mutableLongStateOf(existing?.color ?: botColors.first()) }
    var baseBotId by rememberSaveable {
        mutableStateOf(existing?.baseBotId ?: baseId?.takeIf { BotCatalog.officialById(it) != null } ?: BotCatalog.ASSISTANT_ID)
    }
    var pickBase by remember { mutableStateOf(false) }
    var confirmDelete by remember { mutableStateOf(false) }

    val baseBot = BotCatalog.officialById(baseBotId) ?: BotCatalog.assistant
    val cleanName = name.trim()
    val nameTaken = allBots.any { it.name.equals(cleanName, ignoreCase = true) && it.id != existing?.id }
    val nameValid = cleanName.length in 2..30 && cleanName.all { it.isLetterOrDigit() || it in "-_." } && !nameTaken
    val canSave = nameValid && prompt.isNotBlank()

    val preview = Bot(
        id = existing?.id ?: "preview",
        name = cleanName.ifBlank { "B" },
        creator = "you",
        description = description,
        avatar = AvatarStyle.CUSTOM,
        categories = setOf(BotCategory.YOURS),
        points = baseBot.points,
        official = false,
        baseBotId = baseBot.id,
        color = color,
        emoji = emoji.takeIf { it.isNotBlank() },
    )
    val fieldColors = OutlinedTextFieldDefaults.colors(focusedBorderColor = colors.primary, cursorColor = colors.primary, focusedLabelColor = colors.link)

    Column(Modifier.fillMaxSize().background(colors.background).imePadding()) {
        LoeTopBar(if (existing != null) "Edit bot" else "Create a bot", onBack = { nav.popBackStack() })
        Column(
            Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(horizontal = 16.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp),
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                BotAvatar(preview, 72.dp)
                Spacer(Modifier.width(16.dp))
                Column {
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        botColors.take(4).forEach { ColorDot(it, it == color) { color = it } }
                    }
                    Spacer(Modifier.height(8.dp))
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        botColors.drop(4).forEach { ColorDot(it, it == color) { color = it } }
                    }
                }
            }
            OutlinedTextField(
                emoji, { emoji = it.take(4) },
                label = { Text("Emoji for the picture (optional)") }, singleLine = true, colors = fieldColors, modifier = Modifier.fillMaxWidth(),
            )
            OutlinedTextField(
                name, { name = it.take(30) },
                label = { Text("Bot name") },
                singleLine = true,
                isError = cleanName.isNotEmpty() && !nameValid,
                supportingText = {
                    Text(
                        when {
                            nameTaken -> "That name is already used by another bot."
                            cleanName.isNotEmpty() && !nameValid -> "2–30 letters, numbers, - _ or . (no spaces)."
                            else -> "People mention it in chats as @${cleanName.ifBlank { "Name" }}"
                        },
                    )
                },
                colors = fieldColors,
                modifier = Modifier.fillMaxWidth(),
            )
            OutlinedTextField(
                description, { description = it.take(300) },
                label = { Text("Description (optional)") }, minLines = 2, colors = fieldColors, modifier = Modifier.fillMaxWidth(),
            )
            Text("Base bot", fontSize = 15.sp, color = colors.textSecondary)
            Row(
                Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(12.dp))
                    .background(colors.surface)
                    .clickable { pickBase = true }
                    .padding(12.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                BotAvatar(baseBot, 32.dp)
                Spacer(Modifier.width(12.dp))
                Column(Modifier.weight(1f)) {
                    Text(baseBot.name, fontSize = 17.sp, fontWeight = FontWeight.Bold, color = colors.text)
                    Text("${baseBot.points} points per message", fontSize = 14.sp, color = colors.textSecondary)
                }
                Icon(Icons.Rounded.ExpandMore, contentDescription = null, tint = colors.text)
            }
            OutlinedTextField(
                prompt, { prompt = it.take(8000) },
                label = { Text("Prompt") },
                placeholder = { Text("Tell your bot who it is, what it knows and how to reply. For example: You are a friendly Vietnamese tutor…") },
                minLines = 6,
                colors = fieldColors,
                modifier = Modifier.fillMaxWidth().heightIn(min = 160.dp),
            )
            OutlinedTextField(
                greeting, { greeting = it.take(500) },
                label = { Text("Greeting message (optional)") }, minLines = 2, colors = fieldColors, modifier = Modifier.fillMaxWidth(),
            )
            PrimaryButton(
                if (existing != null) "Save changes" else "Create bot",
                enabled = canSave,
                onClick = {
                    val bot = preview.copy(
                        id = existing?.id ?: "custom-" + UUID.randomUUID().toString().take(8),
                        name = cleanName,
                        description = description.trim().ifBlank { "A bot by you, based on ${baseBot.name}." },
                        systemPrompt = prompt.trim(),
                        greeting = greeting.trim().ifBlank { null },
                        createdAt = existing?.createdAt ?: System.currentTimeMillis(),
                    )
                    scope.launch {
                        graph.repository.saveCustomBot(bot)
                        Toasts.show(context, if (existing != null) "Bot saved" else "${bot.name} created")
                        if (existing != null) {
                            nav.popBackStack()
                        } else {
                            nav.navigate(Routes.newChat(bot.id)) { popUpTo(Routes.CREATE_BOT) { inclusive = true } }
                        }
                    }
                },
            )
            if (existing != null) {
                Text(
                    "Delete bot",
                    color = colors.danger,
                    fontWeight = FontWeight.Bold,
                    fontSize = 17.sp,
                    modifier = Modifier.align(Alignment.CenterHorizontally).clickable { confirmDelete = true }.padding(8.dp),
                )
            }
            Spacer(Modifier.height(24.dp))
        }
    }

    if (pickBase) {
        BotPickerSheet(
            title = "Base bot",
            bots = BotCatalog.baseBots,
            selectedId = baseBotId,
            onPick = {
                baseBotId = it.id
                pickBase = false
            },
            onDismiss = { pickBase = false },
        )
    }
    if (confirmDelete && existing != null) {
        ConfirmDialog(
            title = "Delete ${existing.name}?",
            message = "The bot will be removed. Chats you had with it stay in your history.",
            confirmText = "Delete",
            destructive = true,
            onConfirm = {
                confirmDelete = false
                scope.launch {
                    graph.repository.deleteCustomBot(existing.id)
                    nav.popBackStack()
                }
            },
            onDismiss = { confirmDelete = false },
        )
    }
}

@Composable
private fun ColorDot(value: Long, selected: Boolean, onClick: () -> Unit) {
    val colors = LoeTheme.colors
    Spacer(
        Modifier
            .size(30.dp)
            .clip(CircleShape)
            .background(Color(value))
            .border(if (selected) 3.dp else 0.dp, if (selected) colors.text else Color.Transparent, CircleShape)
            .clickable(onClick = onClick),
    )
}

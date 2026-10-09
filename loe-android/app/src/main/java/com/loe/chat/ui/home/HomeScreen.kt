package com.loe.chat.ui.home

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.GroupAdd
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.produceState
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.navigation.NavController
import com.loe.chat.AppGraph
import com.loe.chat.data.Attachment
import com.loe.chat.data.Bot
import com.loe.chat.data.BotCategory
import com.loe.chat.data.ResponseStyle
import com.loe.chat.ui.Routes
import com.loe.chat.ui.components.BotAvatar
import com.loe.chat.ui.components.BotChipsRow
import com.loe.chat.ui.components.BotPickerSheet
import com.loe.chat.ui.components.ChatOptionsSheet
import com.loe.chat.ui.components.Composer
import com.loe.chat.ui.components.ConversationRow
import com.loe.chat.ui.components.LoeWordmark
import com.loe.chat.ui.components.SectionHeader
import com.loe.chat.ui.components.rememberComposerTools
import com.loe.chat.ui.theme.LoeTheme
import com.loe.chat.util.Intents
import kotlinx.coroutines.launch

private val homeSections = listOf(
    BotCategory.OFFICIAL to "Official bots",
    BotCategory.BUDGET to "Budget-friendly bots",
    BotCategory.SEARCH to "Search bots",
    BotCategory.IMAGE to "Image generation bots",
    BotCategory.VIDEO to "Video generation bots",
)

private val fallbackChipBots = listOf("claude-fable-5.1", "gpt-6-astra", "gemini-3.5-flash", "claude-opus-5.5")

@Composable
fun HomeScreen(graph: AppGraph, nav: NavController) {
    val colors = LoeTheme.colors
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val focus = LocalFocusManager.current
    val settings by graph.settings.state.collectAsState()
    val conversations by remember { graph.repository.conversations() }.collectAsState(initial = emptyList())
    val allBots by graph.bots.all.collectAsState()

    var selectedBotId by rememberSaveable { mutableStateOf(settings.defaultBotId) }
    var text by rememberSaveable { mutableStateOf("") }
    var attachments by remember { mutableStateOf(listOf<Attachment>()) }
    var style by rememberSaveable { mutableStateOf(ResponseStyle.DEFAULT) }
    var instructions by rememberSaveable { mutableStateOf("") }
    var showPicker by remember { mutableStateOf(false) }
    var showOptions by remember { mutableStateOf(false) }
    var sending by remember { mutableStateOf(false) }

    // Follow the default bot when it changes in Settings.
    LaunchedEffect(settings.defaultBotId) { selectedBotId = settings.defaultBotId }

    val recentBotIds by produceState(initialValue = emptyList<String>(), conversations) {
        value = graph.repository.recentBotIds(6)
    }
    val chipBots: List<Bot> = remember(selectedBotId, recentBotIds, allBots, settings.defaultBotId) {
        val ids = LinkedHashSet<String>().apply {
            add(settings.defaultBotId)
            addAll(recentBotIds)
            addAll(fallbackChipBots)
        }
        val base = ids.mapNotNull { graph.bots.get(it) }.take(4)
        if (base.any { it.id == selectedBotId }) base else listOfNotNull(graph.bots.get(selectedBotId)) + base.take(3)
    }

    val (tools, attachMenu) = rememberComposerTools(
        onAttachment = { attachments = attachments + it },
        onSpeech = { spoken -> text = if (text.isBlank()) spoken else "$text $spoken" },
    )

    fun send() {
        val message = text.trim()
        if ((message.isEmpty() && attachments.isEmpty()) || sending) return
        sending = true
        scope.launch {
            val id = graph.engine.startChat(selectedBotId, message, attachments, style, instructions)
            text = ""
            attachments = emptyList()
            style = ResponseStyle.DEFAULT
            instructions = ""
            sending = false
            focus.clearFocus()
            nav.navigate(Routes.chat(id))
        }
    }

    Column(
        Modifier
            .fillMaxSize()
            .background(colors.background)
            .imePadding(),
    ) {
        // Header: Loe logo centered, "invite" on the right.
        Box(
            Modifier
                .fillMaxWidth()
                .statusBarsPadding()
                .height(56.dp),
        ) {
            LoeWordmark(Modifier.align(Alignment.Center))
            IconButton(
                onClick = { Intents.shareText(context, "Chat with GPT, Claude, Gemini, Grok and more in one app — try Loe!", "Join me on Loe") },
                modifier = Modifier.align(Alignment.CenterEnd).padding(end = 8.dp),
            ) {
                Icon(Icons.Outlined.GroupAdd, contentDescription = "Invite friends", tint = colors.text)
            }
        }

        LazyColumn(Modifier.weight(1f).fillMaxWidth()) {
            if (!settings.hasAnyKey()) {
                item(key = "connect-key") {
                    Row(
                        Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 16.dp, vertical = 8.dp)
                            .clip(RoundedCornerShape(14.dp))
                            .background(colors.chipSelectedBg)
                            .clickable { nav.navigate(Routes.API_KEYS) }
                            .padding(horizontal = 16.dp, vertical = 12.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Column(Modifier.weight(1f)) {
                            Text("Connect an AI provider", fontSize = 16.sp, fontWeight = FontWeight.Bold, color = colors.chipSelectedText)
                            Text(
                                "Add an API key to start chatting. Google Gemini has a free tier.",
                                fontSize = 14.sp, color = colors.text, lineHeight = 19.sp,
                            )
                        }
                        Spacer(Modifier.width(12.dp))
                        Text(
                            "Set up",
                            modifier = Modifier
                                .clip(RoundedCornerShape(16.dp))
                                .background(colors.primary)
                                .padding(horizontal = 14.dp, vertical = 7.dp),
                            color = colors.onPrimary,
                            fontWeight = FontWeight.SemiBold,
                            fontSize = 14.sp,
                        )
                    }
                }
            }
            val latest = conversations.firstOrNull()
            if (latest != null) {
                item(key = "recent") {
                    ConversationRow(
                        conversation = latest,
                        bot = graph.bots.getOrAssistant(latest.botId),
                        onClick = { nav.navigate(Routes.chat(latest.id)) },
                    )
                    HorizontalDivider(thickness = 1.dp, color = colors.divider)
                }
            } else {
                item(key = "welcome") {
                    Text(
                        "Hi ${settings.profile.name.substringBefore(' ').ifBlank { "there" }}! Pick a bot below or type a message to start.",
                        fontSize = 16.sp,
                        color = colors.textSecondary,
                        textAlign = TextAlign.Center,
                        modifier = Modifier.fillMaxWidth().padding(horizontal = 24.dp, vertical = 14.dp),
                    )
                    HorizontalDivider(thickness = 1.dp, color = colors.divider)
                }
            }
            homeSections.forEach { (category, title) ->
                val bots = allBots.filter { category in it.categories }
                if (bots.isNotEmpty()) {
                    item(key = "header-$category") {
                        Spacer(Modifier.height(12.dp))
                        SectionHeader(title, onSeeAll = { nav.navigate(Routes.explore(category)) })
                        Spacer(Modifier.height(12.dp))
                    }
                    item(key = "row-$category") {
                        LazyRow(
                            contentPadding = PaddingValues(horizontal = 14.dp),
                            horizontalArrangement = Arrangement.spacedBy(12.dp),
                        ) {
                            items(bots, key = { it.id }) { bot ->
                                BotCard(bot) { nav.navigate(Routes.newChat(bot.id)) }
                            }
                        }
                    }
                }
            }
            item(key = "bottom-space") { Spacer(Modifier.height(16.dp)) }
        }

        // Bot chips + composer, pinned above the tab bar (and above the keyboard).
        Spacer(Modifier.height(6.dp))
        BotChipsRow(
            bots = chipBots,
            selectedId = selectedBotId,
            onSelect = { selectedBotId = it.id },
            onMore = { showPicker = true },
        )
        Spacer(Modifier.height(8.dp))
        Composer(
            text = text,
            onTextChange = { text = it },
            placeholder = "Start a new chat",
            onSend = ::send,
            attachments = attachments,
            onRemoveAttachment = { a -> attachments = attachments - a },
            onAttach = tools.openAttachMenu,
            onMention = { showPicker = true },
            onOptions = { showOptions = true },
            onMic = tools.startVoice,
            canSend = !sending,
            modifier = Modifier.padding(horizontal = 8.dp),
        )
        Spacer(Modifier.height(8.dp))
    }

    attachMenu()

    if (showPicker) {
        BotPickerSheet(
            title = "Choose a bot",
            bots = allBots,
            selectedId = selectedBotId,
            onPick = {
                selectedBotId = it.id
                showPicker = false
            },
            onDismiss = { showPicker = false },
        )
    }
    if (showOptions) {
        ChatOptionsSheet(
            style = style,
            instructions = instructions,
            onSave = { newStyle, newInstructions ->
                style = newStyle
                instructions = newInstructions
                showOptions = false
            },
            onDismiss = { showOptions = false },
        )
    }
}

@Composable
private fun BotCard(bot: Bot, onClick: () -> Unit) {
    Column(
        Modifier
            .width(100.dp)
            .clip(RoundedCornerShape(16.dp))
            .clickable(onClick = onClick),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        BotAvatar(bot, 96.dp)
        Spacer(Modifier.height(8.dp))
        Text(
            // Let long names wrap after a hyphen ("Claude-Opus-" / "5.5") rather than mid-word.
            bot.name.replace("-", "-\u200B"),
            fontSize = 14.5.sp,
            color = LoeTheme.colors.text,
            textAlign = TextAlign.Center,
            maxLines = 2,
            lineHeight = 19.sp,
        )
    }
}

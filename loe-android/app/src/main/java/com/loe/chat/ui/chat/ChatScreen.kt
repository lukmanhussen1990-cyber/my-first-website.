package com.loe.chat.ui.chat

import androidx.compose.foundation.background
import androidx.compose.foundation.gestures.animateScrollBy
import androidx.compose.foundation.gestures.scrollBy
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.selection.SelectionContainer
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.DriveFileRenameOutline
import androidx.compose.material.icons.outlined.ContentCopy
import androidx.compose.material.icons.outlined.Delete
import androidx.compose.material.icons.outlined.Download
import androidx.compose.material.icons.outlined.Share
import androidx.compose.material.icons.outlined.TextFields
import androidx.compose.material.icons.rounded.Refresh
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.produceState
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.unit.dp
import androidx.navigation.NavController
import com.loe.chat.AppGraph
import com.loe.chat.ai.Router
import com.loe.chat.data.Attachment
import com.loe.chat.data.Bot
import com.loe.chat.data.ChatMessage
import com.loe.chat.data.Conversation
import com.loe.chat.data.ResponseStyle
import com.loe.chat.data.Role
import com.loe.chat.ui.Routes
import com.loe.chat.ui.components.ActionSheet
import com.loe.chat.ui.components.BotPickerSheet
import com.loe.chat.ui.components.ChatOptionsSheet
import com.loe.chat.ui.components.Composer
import com.loe.chat.ui.components.ConfirmDialog
import com.loe.chat.ui.components.SheetActionRow
import com.loe.chat.ui.components.TextInputDialog
import com.loe.chat.ui.components.rememberComposerTools
import com.loe.chat.ui.theme.LoeTheme
import com.loe.chat.util.ImageSaver
import com.loe.chat.util.Intents
import com.loe.chat.util.Toasts
import com.loe.chat.util.viewImage
import kotlinx.coroutines.launch
import java.io.File

@Composable
fun ChatScreen(graph: AppGraph, nav: NavController, initialConversationId: Long, initialBotId: String?) {
    val colors = LoeTheme.colors
    val context = LocalContext.current
    val clipboard = LocalClipboardManager.current
    val focusManager = LocalFocusManager.current
    val scope = rememberCoroutineScope()
    val settings by graph.settings.state.collectAsState()

    var conversationId by rememberSaveable { mutableLongStateOf(initialConversationId) }
    val conversation by remember(conversationId) { graph.repository.conversation(conversationId) }.collectAsState(initial = null)
    val messages by remember(conversationId) { graph.repository.messages(conversationId) }.collectAsState(initial = emptyList())
    val liveMap by graph.engine.live.collectAsState()
    val busyIds by graph.engine.busy.collectAsState()
    val totalUnread by remember { graph.repository.totalUnread() }.collectAsState(initial = 0)
    val customBots by graph.bots.customBots.collectAsState()
    val allBots by graph.bots.all.collectAsState()

    val live = liveMap[conversationId]
    val busy = conversationId in busyIds
    val bot: Bot = remember(conversation?.botId, initialBotId, customBots) {
        graph.bots.getOrAssistant(conversation?.botId ?: initialBotId ?: graph.settings.current.defaultBotId)
    }
    val route = remember(bot, settings) { Router.resolve(bot, settings) }
    val lastChat by produceState<Conversation?>(null, bot.id, conversationId) {
        value = graph.repository.lastConversationWithBot(bot.id, excludeId = conversationId)
    }

    var text by rememberSaveable { mutableStateOf("") }
    var attachments by remember { mutableStateOf(listOf<Attachment>()) }
    var pendingStyle by rememberSaveable { mutableStateOf(ResponseStyle.DEFAULT) }
    var pendingInstructions by rememberSaveable { mutableStateOf("") }
    var showMention by remember { mutableStateOf(false) }
    var showOptions by remember { mutableStateOf(false) }
    var showRename by remember { mutableStateOf(false) }
    var confirmDelete by remember { mutableStateOf(false) }
    var actionsFor by remember { mutableStateOf<ChatMessage?>(null) }
    var selectTextOf by remember { mutableStateOf<String?>(null) }

    // This chat is on screen: its replies aren't unread.
    DisposableEffect(conversationId) {
        graph.engine.openConversationId = conversationId
        onDispose {
            if (graph.engine.openConversationId == conversationId) graph.engine.openConversationId = -1L
        }
    }
    LaunchedEffect(conversationId, conversation?.unread) {
        if (conversationId > 0 && (conversation?.unread ?: 0) > 0) graph.repository.markRead(conversationId)
    }

    val listState = rememberLazyListState()
    val itemCount = messages.size + if (messages.isEmpty()) 1 else 0
    LaunchedEffect(messages.size, messages.lastOrNull()?.status) {
        if (messages.isNotEmpty()) {
            listState.animateScrollToItem(itemCount - 1)
            listState.animateScrollBy(100_000f)
        }
    }
    LaunchedEffect(live?.text?.length) {
        if (live != null && messages.isNotEmpty()) {
            val lastVisible = listState.layoutInfo.visibleItemsInfo.lastOrNull()?.index ?: 0
            if (lastVisible >= itemCount - 2) listState.scrollBy(100_000f)
        }
    }

    val (tools, attachMenu) = rememberComposerTools(
        onAttachment = { attachments = attachments + it },
        onSpeech = { spoken -> text = if (text.isBlank()) spoken else "$text $spoken" },
    )

    fun send() {
        val message = text.trim()
        if ((message.isEmpty() && attachments.isEmpty()) || busy) return
        val files = attachments
        text = ""
        attachments = emptyList()
        focusManager.clearFocus()
        if (conversationId <= 0) {
            scope.launch {
                conversationId = graph.engine.startChat(bot.id, message, files, pendingStyle, pendingInstructions)
            }
        } else {
            graph.engine.send(conversationId, message, files)
        }
    }

    fun botFor(message: ChatMessage): Bot = graph.bots.getOrAssistant(message.botId ?: bot.id)

    fun shareConversation() {
        if (messages.isEmpty()) {
            Intents.shareText(context, "Chat with ${bot.name} on Loe: ${bot.description}")
            return
        }
        val transcript = buildString {
            appendLine(conversation?.title ?: "Loe chat")
            appendLine()
            messages.forEach { m ->
                when (m.role) {
                    Role.USER -> appendLine("You: ${m.content}")
                    Role.BOT, Role.GREETING -> if (m.content.isNotBlank()) appendLine("${botFor(m).name}: ${m.content}")
                    Role.DIVIDER -> appendLine("— context cleared —")
                }
                appendLine()
            }
            append("Shared from Loe")
        }
        Intents.shareText(context, transcript, conversation?.title)
    }

    val lastBotId = messages.lastOrNull { it.role == Role.BOT }?.id

    Column(
        Modifier
            .fillMaxSize()
            .background(colors.background)
            .imePadding(),
    ) {
        ChatTopBar(
            title = conversation?.title ?: "New chat",
            bot = bot,
            otherUnread = (totalUnread - (conversation?.unread ?: 0)).coerceAtLeast(0),
            onBack = { nav.popBackStack() },
            onBotClick = { nav.navigate(Routes.botDetails(bot.id)) },
            onNewChat = {
                nav.navigate(Routes.newChat(bot.id)) {
                    popUpTo(Routes.CHAT) { inclusive = true }
                }
            },
            onShare = ::shareConversation,
        )
        Box(Modifier.weight(1f)) {
            LazyColumn(
                state = listState,
                modifier = Modifier.fillMaxSize(),
                contentPadding = PaddingValues(top = 4.dp, bottom = 12.dp),
            ) {
                if (messages.isEmpty()) {
                    item(key = "intro") {
                        BotIntro(
                            bot = bot,
                            creatorLabel = creatorLabel(bot, settings.profile.handle),
                            route = route,
                            followed = bot.id in settings.followedBots,
                            lastChat = lastChat,
                            onHistory = { nav.navigate(Routes.history(bot.id)) },
                            onToggleFollow = { graph.settings.setFollowed(bot.id, bot.id !in settings.followedBots) },
                            onShare = { Intents.shareText(context, "Chat with ${bot.name} on Loe — ${bot.description}") },
                            onDetails = { nav.navigate(Routes.botDetails(bot.id)) },
                            onCreateLikeThis = {
                                if (bot.isCustom) nav.navigate(Routes.createBot(editId = bot.id))
                                else nav.navigate(Routes.createBot(baseId = bot.id))
                            },
                            onConnectKey = { nav.navigate(Routes.API_KEYS) },
                            onInvite = { Intents.shareText(context, "Join me on Loe and chat with ${bot.name}, GPT, Claude, Gemini and more.", "Loe invite") },
                            onContinue = { chat ->
                                nav.navigate(Routes.chat(chat.id)) { popUpTo(Routes.CHAT) { inclusive = true } }
                            },
                        )
                    }
                }
                items(messages, key = { it.id }) { message ->
                    when (message.role) {
                        Role.USER -> UserBubble(
                            message,
                            onLongPress = { actionsFor = message },
                            onImageClick = { Intents.viewImage(context, it) },
                        )
                        Role.BOT, Role.GREETING -> BotMessage(
                            message = message,
                            bot = botFor(message),
                            live = liveMap[conversationId]?.takeIf { it.messageId == message.id },
                            showActions = message.role == Role.BOT && message.id == lastBotId,
                            onLongPress = { actionsFor = message },
                            onShare = { Intents.shareText(context, message.content) },
                            onRetry = { graph.engine.retry(conversationId, message.id) },
                            onFixKeys = { nav.navigate(Routes.API_KEYS) },
                            onOpenSettings = { nav.navigate(Routes.SETTINGS) },
                            onImageClick = { Intents.viewImage(context, it) },
                        )
                        Role.DIVIDER -> ContextDivider()
                    }
                }
            }
        }
        if (busy) {
            StopButton(
                onStop = { graph.engine.stop(conversationId) },
                modifier = Modifier.align(Alignment.CenterHorizontally).padding(bottom = 8.dp, top = 4.dp),
            )
        }
        Composer(
            text = text,
            onTextChange = { text = it },
            placeholder = "Message",
            onSend = ::send,
            attachments = attachments,
            onRemoveAttachment = { a -> attachments = attachments - a },
            onAttach = tools.openAttachMenu,
            onMention = { showMention = true },
            onOptions = { showOptions = true },
            onMic = tools.startVoice,
            showBroom = true,
            onBroom = {
                if (conversationId > 0 && messages.isNotEmpty() && messages.last().role != Role.DIVIDER) {
                    graph.engine.clearContext(conversationId)
                    Toasts.show(context, "Context cleared. ${bot.name} won't see earlier messages.")
                } else {
                    Toasts.show(context, "Nothing to clear yet.")
                }
            },
            canSend = !busy,
            modifier = Modifier.padding(horizontal = 8.dp),
        )
        Spacer(Modifier.height(8.dp).navigationBarsPadding())
    }

    attachMenu()

    if (showMention) {
        BotPickerSheet(
            title = "Mention a bot",
            bots = allBots,
            selectedId = null,
            onPick = { picked ->
                text = "@${picked.name} " + text.replace(Regex("^@[A-Za-z0-9._-]+\\s*"), "")
                showMention = false
            },
            onDismiss = { showMention = false },
        )
    }

    if (showOptions) {
        ChatOptionsSheet(
            style = conversation?.let { ResponseStyle.fromId(it.style) } ?: pendingStyle,
            instructions = conversation?.instructions ?: pendingInstructions,
            onSave = { style, instructions ->
                if (conversationId > 0) {
                    scope.launch { graph.repository.setOptions(conversationId, style, instructions) }
                } else {
                    pendingStyle = style
                    pendingInstructions = instructions
                }
                showOptions = false
                Toasts.show(context, "Chat options saved")
            },
            onDismiss = { showOptions = false },
            extraActions = {
                if (conversationId > 0) {
                    Spacer(Modifier.height(8.dp))
                    SheetActionRow(Icons.Outlined.DriveFileRenameOutline, "Rename chat", { showOptions = false; showRename = true })
                    SheetActionRow(Icons.Outlined.Delete, "Delete chat", { showOptions = false; confirmDelete = true }, destructive = true)
                }
            },
        )
    }

    if (showRename) {
        TextInputDialog(
            title = "Rename chat",
            initial = conversation?.title.orEmpty(),
            onConfirm = { title ->
                if (title.isNotBlank()) scope.launch { graph.repository.setTitle(conversationId, title.trim()) }
                showRename = false
            },
            onDismiss = { showRename = false },
        )
    }

    if (confirmDelete) {
        ConfirmDialog(
            title = "Delete chat?",
            message = "This chat and its messages will be deleted from this device.",
            confirmText = "Delete",
            destructive = true,
            onConfirm = {
                confirmDelete = false
                graph.engine.stop(conversationId)
                val id = conversationId
                scope.launch { graph.repository.deleteConversation(id) }
                nav.popBackStack()
            },
            onDismiss = { confirmDelete = false },
        )
    }

    actionsFor?.let { message ->
        val images = message.attachments.filter { it.isImage }.map { File(it.path) }
        ActionSheet(onDismiss = { actionsFor = null }) {
            if (message.content.isNotBlank()) {
                SheetActionRow(Icons.Outlined.ContentCopy, "Copy text", {
                    clipboard.setText(AnnotatedString(message.content))
                    Toasts.show(context, "Copied")
                    actionsFor = null
                })
                SheetActionRow(Icons.Outlined.TextFields, "Select text", {
                    selectTextOf = message.content
                    actionsFor = null
                })
                SheetActionRow(Icons.Outlined.Share, "Share", {
                    Intents.shareText(context, message.content)
                    actionsFor = null
                })
            }
            images.firstOrNull()?.let { file ->
                SheetActionRow(Icons.Outlined.Download, "Save image", {
                    val saved = ImageSaver.saveToGallery(context, file)
                    if (saved) Toasts.show(context, "Saved to Pictures/Loe") else Intents.shareImage(context, file)
                    actionsFor = null
                })
                SheetActionRow(Icons.Outlined.Share, "Share image", {
                    Intents.shareImage(context, file)
                    actionsFor = null
                })
            }
            if (message.role == Role.BOT && !busy) {
                SheetActionRow(Icons.Rounded.Refresh, "Retry", {
                    graph.engine.retry(conversationId, message.id)
                    actionsFor = null
                })
            }
            if (!busy) {
                SheetActionRow(Icons.Outlined.Delete, "Delete message", {
                    scope.launch { graph.repository.deleteMessage(message.id) }
                    actionsFor = null
                }, destructive = true)
            }
        }
    }

    selectTextOf?.let { content ->
        AlertDialog(
            onDismissRequest = { selectTextOf = null },
            containerColor = colors.background,
            confirmButton = { TextButton(onClick = { selectTextOf = null }) { Text("Done", color = colors.link) } },
            text = {
                SelectionContainer(Modifier.heightIn(max = 420.dp).verticalScroll(rememberScrollState())) {
                    Text(content, color = colors.text)
                }
            },
        )
    }
}

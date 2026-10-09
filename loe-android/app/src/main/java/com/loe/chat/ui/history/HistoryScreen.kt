package com.loe.chat.ui.history

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.DriveFileRenameOutline
import androidx.compose.material.icons.outlined.Delete
import androidx.compose.material.icons.rounded.Close
import androidx.compose.material.icons.rounded.Search
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.navigation.NavController
import com.loe.chat.AppGraph
import com.loe.chat.data.Conversation
import com.loe.chat.ui.Routes
import com.loe.chat.ui.components.ActionSheet
import com.loe.chat.ui.components.ConfirmDialog
import com.loe.chat.ui.components.ConversationRow
import com.loe.chat.ui.components.EmptyState
import com.loe.chat.ui.components.LoeTopBar
import com.loe.chat.ui.components.PrimaryButton
import com.loe.chat.ui.components.SearchField
import com.loe.chat.ui.components.SheetActionRow
import com.loe.chat.ui.components.TextInputDialog
import com.loe.chat.ui.theme.LoeTheme
import kotlinx.coroutines.launch

@Composable
fun HistoryScreen(graph: AppGraph, nav: NavController, botFilter: String?) {
    val colors = LoeTheme.colors
    val scope = rememberCoroutineScope()
    val conversations by remember { graph.repository.conversations() }.collectAsState(initial = emptyList())
    var searching by rememberSaveable { mutableStateOf(false) }
    var query by rememberSaveable { mutableStateOf("") }
    var menuFor by remember { mutableStateOf<Conversation?>(null) }
    var renaming by remember { mutableStateOf<Conversation?>(null) }
    var deleting by remember { mutableStateOf<Conversation?>(null) }

    val filterBot = botFilter?.let { graph.bots.get(it) }
    val shown = remember(conversations, query, botFilter) {
        conversations
            .filter { botFilter == null || it.botId == botFilter }
            .filter { c ->
                query.isBlank() || c.title.contains(query, true) || c.lastPreview.contains(query, true) ||
                    graph.bots.getOrAssistant(c.botId).name.contains(query, true)
            }
    }

    Column(Modifier.fillMaxSize().background(colors.background)) {
        LoeTopBar(
            title = filterBot?.let { "${it.name} chats" } ?: "History",
            onBack = if (botFilter != null) ({ nav.popBackStack() }) else null,
            actions = {
                IconButton(onClick = {
                    searching = !searching
                    if (!searching) query = ""
                }) {
                    Icon(if (searching) Icons.Rounded.Close else Icons.Rounded.Search, contentDescription = "Search chats", tint = colors.text)
                }
            },
        )
        if (searching) {
            SearchField(query, { query = it }, "Search your chats", Modifier.padding(horizontal = 16.dp, vertical = 6.dp))
        }
        if (shown.isEmpty()) {
            EmptyState(
                title = if (query.isNotBlank()) "No matching chats" else "No chats yet",
                message = if (query.isNotBlank()) "Try a different word." else "Your conversations with bots will show up here.",
                action = if (query.isBlank()) ({ PrimaryButton("Start a chat", { nav.navigate(Routes.HOME) }) }) else null,
            )
        } else {
            LazyColumn(Modifier.fillMaxSize()) {
                items(shown, key = { it.id }) { conversation ->
                    ConversationRow(
                        conversation = conversation,
                        bot = graph.bots.getOrAssistant(conversation.botId),
                        onClick = { nav.navigate(Routes.chat(conversation.id)) },
                        onLongClick = { menuFor = conversation },
                    )
                    HorizontalDivider(thickness = 1.dp, color = colors.divider)
                }
                item { Spacer(Modifier.height(12.dp)) }
            }
        }
    }

    menuFor?.let { conversation ->
        ActionSheet(onDismiss = { menuFor = null }) {
            SheetActionRow(Icons.Outlined.DriveFileRenameOutline, "Rename", {
                renaming = conversation
                menuFor = null
            })
            SheetActionRow(Icons.Outlined.Delete, "Delete", {
                deleting = conversation
                menuFor = null
            }, destructive = true)
        }
    }
    renaming?.let { conversation ->
        TextInputDialog(
            title = "Rename chat",
            initial = conversation.title,
            onConfirm = { title ->
                if (title.isNotBlank()) scope.launch { graph.repository.setTitle(conversation.id, title.trim()) }
                renaming = null
            },
            onDismiss = { renaming = null },
        )
    }
    deleting?.let { conversation ->
        ConfirmDialog(
            title = "Delete chat?",
            message = "\"${conversation.title}\" will be deleted from this device.",
            confirmText = "Delete",
            destructive = true,
            onConfirm = {
                graph.engine.stop(conversation.id)
                scope.launch { graph.repository.deleteConversation(conversation.id) }
                deleting = null
            },
            onDismiss = { deleting = null },
        )
    }
}

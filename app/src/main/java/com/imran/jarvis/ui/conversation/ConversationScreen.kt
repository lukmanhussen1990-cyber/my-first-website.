package com.imran.jarvis.ui.conversation

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.imran.jarvis.JarvisUiState
import com.imran.jarvis.JarvisViewModel
import com.imran.jarvis.ai.JarvisPrompt
import com.imran.jarvis.data.Phase
import com.imran.jarvis.ui.components.BackButton
import com.imran.jarvis.ui.components.ChatBubble
import com.imran.jarvis.ui.components.JarvisOrb
import com.imran.jarvis.ui.components.JarvisTopBar
import com.imran.jarvis.ui.components.ListeningLabel
import com.imran.jarvis.ui.components.MicButtonBar
import com.imran.jarvis.ui.components.MoreButton
import com.imran.jarvis.ui.components.toOrbState
import com.imran.jarvis.ui.theme.JarvisBackground
import com.imran.jarvis.ui.theme.JarvisColors

@Composable
fun ConversationScreen(
    vm: JarvisViewModel,
    onBack: () -> Unit,
    onOpenSettings: () -> Unit,
    onMic: () -> Unit,
) {
    val state by vm.state.collectAsStateWithLifecycle()
    ConversationContent(
        state = state,
        level = { vm.level.value },
        onBack = {
            vm.stopEverything()
            onBack()
        },
        onClear = vm::clearConversation,
        onOpenSettings = onOpenSettings,
        onMic = onMic,
    )
}

/** The listening / chat screen without any ViewModel, so it can be drawn from plain values. */
@Composable
fun ConversationContent(
    state: JarvisUiState,
    level: () -> Float,
    onBack: () -> Unit,
    onClear: () -> Unit,
    onOpenSettings: () -> Unit,
    onMic: () -> Unit,
) {
    val listState = rememberLazyListState()
    var menuOpen by remember { mutableStateOf(false) }

    BackHandler(onBack = onBack)

    // Always show the newest message.
    LaunchedEffect(state.messages.size) {
        if (state.messages.isNotEmpty()) listState.animateScrollToItem(state.messages.lastIndex)
    }

    JarvisBackground {
        BoxWithConstraints(Modifier.fillMaxSize().safeDrawingPadding()) {
            val orbSide = (maxHeight * 0.30f).coerceIn(150.dp, 270.dp)

            Column(Modifier.fillMaxSize()) {
                JarvisTopBar(
                    start = { BackButton(onBack) },
                    end = {
                        Box {
                            MoreButton { menuOpen = true }
                            DropdownMenu(
                                expanded = menuOpen,
                                onDismissRequest = { menuOpen = false },
                                containerColor = JarvisColors.CardHigh,
                            ) {
                                DropdownMenuItem(
                                    text = { Text("Clear conversation") },
                                    onClick = {
                                        menuOpen = false
                                        onClear()
                                    },
                                )
                                DropdownMenuItem(
                                    text = { Text("Settings") },
                                    onClick = {
                                        menuOpen = false
                                        onOpenSettings()
                                    },
                                )
                            }
                        }
                    },
                )

                Box(Modifier.fillMaxWidth().height(orbSide), contentAlignment = Alignment.Center) {
                    JarvisOrb(
                        state = state.phase.toOrbState(),
                        level = level,
                        modifier = Modifier.size(orbSide),
                    )
                }

                StatusArea(phase = state.phase, partialText = state.partialText, level = level)

                LazyColumn(
                    state = listState,
                    modifier = Modifier.weight(1f).fillMaxWidth(),
                    contentPadding = PaddingValues(horizontal = 14.dp, vertical = 8.dp),
                    verticalArrangement = Arrangement.spacedBy(10.dp),
                ) {
                    items(state.messages, key = { it.id }) { message ->
                        ChatBubble(message = message, userName = JarvisPrompt.USER_NAME)
                    }
                }

                MicButtonBar(listening = state.phase == Phase.Listening, onClick = onMic)
            }
        }
    }
}

/** "Listening..." with the sound wave, or a hint when JARVIS is idle. */
@Composable
private fun StatusArea(phase: Phase, partialText: String, level: () -> Float) {
    val label = when (phase) {
        Phase.Listening -> "Listening..."
        Phase.Thinking -> "Thinking..."
        Phase.Speaking -> "Speaking..."
        Phase.Idle -> null
    }
    Column(
        modifier = Modifier.fillMaxWidth().height(70.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        if (label == null) {
            Text(
                text = "Tap the mic and speak",
                color = JarvisColors.TextSecondary,
                fontSize = 16.sp,
                textAlign = TextAlign.Center,
                modifier = Modifier.padding(top = 16.dp),
            )
        } else {
            ListeningLabel(state = phase.toOrbState(), label = label, level = level)
            if (phase == Phase.Listening) {
                // What you are saying appears here as you speak; until then it simply says "Listening...".
                Text(
                    text = partialText.ifBlank { "Listening..." },
                    color = MaterialTheme.colorScheme.onBackground,
                    fontSize = 17.sp,
                    maxLines = 1,
                    textAlign = TextAlign.Center,
                    modifier = Modifier.padding(horizontal = 24.dp),
                )
            }
        }
    }
}

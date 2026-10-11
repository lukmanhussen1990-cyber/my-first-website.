package com.imran.jarvis.ui.home

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Alarm
import androidx.compose.material.icons.filled.FlashlightOn
import androidx.compose.material.icons.filled.GraphicEq
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.Phone
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.automirrored.filled.Chat
import androidx.compose.material3.DrawerValue
import androidx.compose.material3.Icon
import androidx.compose.material3.ModalDrawerSheet
import androidx.compose.material3.ModalNavigationDrawer
import androidx.compose.material3.NavigationDrawerItem
import androidx.compose.material3.NavigationDrawerItemDefaults
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.rememberDrawerState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.imran.jarvis.JarvisViewModel
import com.imran.jarvis.actions.QuickAction
import com.imran.jarvis.data.Phase
import com.imran.jarvis.ai.JarvisPrompt
import com.imran.jarvis.ui.components.JarvisOrb
import com.imran.jarvis.ui.components.JarvisTitle
import com.imran.jarvis.ui.components.JarvisTopBar
import com.imran.jarvis.ui.components.MenuButton
import com.imran.jarvis.ui.components.MicButtonBar
import com.imran.jarvis.ui.components.MiniOrb
import com.imran.jarvis.ui.components.SettingsButton
import com.imran.jarvis.ui.components.WhatsAppIcon
import com.imran.jarvis.ui.components.YouTubeIcon
import com.imran.jarvis.ui.components.toOrbState
import com.imran.jarvis.ui.theme.JarvisBackground
import com.imran.jarvis.ui.theme.JarvisColors
import kotlinx.coroutines.launch

@Composable
fun HomeScreen(
    vm: JarvisViewModel,
    onMic: () -> Unit,
    onOpenConversation: () -> Unit,
    onOpenSettings: () -> Unit,
) {
    val state by vm.state.collectAsStateWithLifecycle()
    val torchOn by vm.torchOn.collectAsStateWithLifecycle()
    HomeContent(
        phase = state.phase,
        torchOn = torchOn,
        onMic = onMic,
        onOpenConversation = onOpenConversation,
        onOpenSettings = onOpenSettings,
        onQuickAction = vm::onQuickAction,
    )
}

/** The Home screen without any ViewModel, so it can be drawn from plain values (tests, previews). */
@Composable
fun HomeContent(
    phase: Phase,
    torchOn: Boolean,
    onMic: () -> Unit,
    onOpenConversation: () -> Unit,
    onOpenSettings: () -> Unit,
    onQuickAction: (QuickAction) -> Unit,
) {
    val drawerState = rememberDrawerState(DrawerValue.Closed)
    val scope = rememberCoroutineScope()

    ModalNavigationDrawer(
        drawerState = drawerState,
        drawerContent = {
            HomeDrawer(
                onConversation = { scope.launch { drawerState.close() }; onOpenConversation() },
                onSettings = { scope.launch { drawerState.close() }; onOpenSettings() },
                onHome = { scope.launch { drawerState.close() } },
            )
        },
    ) {
        JarvisBackground {
            Column(modifier = Modifier.fillMaxSize().safeDrawingPadding()) {
                JarvisTopBar(
                    start = { MenuButton { scope.launch { drawerState.open() } } },
                    end = { SettingsButton(onOpenSettings) },
                )

                GreetingCard(Modifier.padding(horizontal = 16.dp, vertical = 4.dp))

                // The orb takes whatever space is left, so it fits small and large screens alike.
                BoxWithConstraints(
                    modifier = Modifier.weight(1f).fillMaxWidth(),
                    contentAlignment = Alignment.Center,
                ) {
                    val side = minOf(maxWidth * 0.94f, maxHeight)
                    JarvisOrb(
                        state = phase.toOrbState(),
                        level = { 0f },
                        modifier = Modifier
                            .size(side)
                            .clickable(
                                interactionSource = remember { MutableInteractionSource() },
                                indication = null,
                                onClick = onMic,
                            ),
                    )
                }

                Box(Modifier.fillMaxWidth(), contentAlignment = Alignment.Center) {
                    TapToSpeakPill(onMic)
                }
                Spacer(Modifier.height(14.dp))
                QuickActions(torchOn = torchOn, onAction = onQuickAction)
                MicButtonBar(listening = false, onClick = onMic)
            }
        }
    }
}

@Composable
private fun GreetingCard(modifier: Modifier = Modifier) {
    Surface(
        modifier = modifier.fillMaxWidth(),
        shape = RoundedCornerShape(20.dp),
        color = JarvisColors.Card.copy(alpha = 0.85f),
        border = BorderStroke(1.dp, JarvisColors.Border),
    ) {
        Column(
            modifier = Modifier.padding(horizontal = 20.dp, vertical = 14.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Text(
                text = "Namaste ${JarvisPrompt.USER_NAME} 👋",
                color = Color.White,
                fontSize = 26.sp,
                fontWeight = FontWeight.SemiBold,
            )
            Spacer(Modifier.height(4.dp))
            Text(
                text = "How can I help you today?",
                color = JarvisColors.TextSecondary,
                fontSize = 16.sp,
            )
        }
    }
}

@Composable
private fun TapToSpeakPill(onClick: () -> Unit) {
    val shape = RoundedCornerShape(16.dp)
    Row(
        modifier = Modifier
            .clip(shape)
            .background(JarvisColors.Card.copy(alpha = 0.9f))
            .border(1.dp, JarvisColors.Border, shape)
            .clickable(onClick = onClick)
            .padding(horizontal = 20.dp, vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(Icons.Filled.GraphicEq, contentDescription = null, tint = JarvisColors.Cyan, modifier = Modifier.size(22.dp))
        Spacer(Modifier.width(10.dp))
        Text("Tap to speak", color = Color.White, fontSize = 18.sp)
    }
}

@Composable
private fun QuickActions(torchOn: Boolean, onAction: (QuickAction) -> Unit) {
    Row(
        modifier = Modifier.fillMaxWidth().padding(horizontal = 14.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
    ) {
        QuickButton("Call", Color(0xFF0A2318), Color(0xFF15593B), { onAction(QuickAction.CALL) }) {
            Icon(Icons.Filled.Phone, contentDescription = null, tint = JarvisColors.GreenCall, modifier = Modifier.size(32.dp))
        }
        QuickButton("WhatsApp", Color(0xFF0A2318), Color(0xFF15593B), { onAction(QuickAction.WHATSAPP) }) {
            WhatsAppIcon(size = 36.dp)
        }
        QuickButton("YouTube", Color(0xFF1E0E12), Color(0xFF4A1822), { onAction(QuickAction.YOUTUBE) }) {
            YouTubeIcon(size = 38.dp)
        }
        QuickButton(
            label = "Flashlight",
            background = Color(0xFF0C1A2C),
            border = if (torchOn) JarvisColors.Torch else Color(0xFF1D3552),
            onClick = { onAction(QuickAction.FLASHLIGHT) },
        ) {
            Icon(
                Icons.Filled.FlashlightOn,
                contentDescription = null,
                tint = if (torchOn) JarvisColors.Torch else JarvisColors.IconGray,
                modifier = Modifier.size(32.dp),
            )
        }
        QuickButton("Alarm", Color(0xFF0C1A2C), Color(0xFF1D3552), { onAction(QuickAction.ALARM) }) {
            Icon(Icons.Filled.Alarm, contentDescription = null, tint = JarvisColors.IconGray, modifier = Modifier.size(32.dp))
        }
    }
}

@Composable
private fun QuickButton(
    label: String,
    background: Color,
    border: Color,
    onClick: () -> Unit,
    icon: @Composable () -> Unit,
) {
    val shape = RoundedCornerShape(18.dp)
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Box(
            modifier = Modifier
                .size(64.dp)
                .clip(shape)
                .background(background)
                .border(1.dp, border, shape)
                .clickable(onClick = onClick),
            contentAlignment = Alignment.Center,
        ) { icon() }
        Spacer(Modifier.height(6.dp))
        Text(label, color = JarvisColors.IconGray, fontSize = 12.5.sp)
    }
}

@Composable
private fun HomeDrawer(onHome: () -> Unit, onConversation: () -> Unit, onSettings: () -> Unit) {
    ModalDrawerSheet(
        drawerContainerColor = JarvisColors.Card,
        drawerContentColor = JarvisColors.TextPrimary,
    ) {
        Column(Modifier.padding(horizontal = 12.dp, vertical = 24.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(start = 8.dp, bottom = 20.dp)) {
                MiniOrb(Modifier.size(56.dp))
                Spacer(Modifier.width(12.dp))
                JarvisTitle(sizeSp = 22f)
            }
            val colors = NavigationDrawerItemDefaults.colors(
                unselectedContainerColor = Color.Transparent,
                selectedContainerColor = JarvisColors.CardHigh,
                unselectedIconColor = JarvisColors.TextSecondary,
                selectedIconColor = JarvisColors.Cyan,
                unselectedTextColor = JarvisColors.TextPrimary,
                selectedTextColor = JarvisColors.TextPrimary,
            )
            NavigationDrawerItem(
                label = { Text("Home") },
                icon = { Icon(Icons.Filled.Home, contentDescription = null) },
                selected = true,
                onClick = onHome,
                colors = colors,
            )
            NavigationDrawerItem(
                label = { Text("Conversation") },
                icon = { Icon(Icons.AutoMirrored.Filled.Chat, contentDescription = null) },
                selected = false,
                onClick = onConversation,
                colors = colors,
            )
            NavigationDrawerItem(
                label = { Text("Settings") },
                icon = { Icon(Icons.Filled.Settings, contentDescription = null) },
                selected = false,
                onClick = onSettings,
                colors = colors,
            )
        }
    }
}

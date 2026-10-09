package com.loe.chat.ui.settings

import android.Manifest
import android.os.Build
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.KeyboardArrowRight
import androidx.compose.material.icons.outlined.Info
import androidx.compose.material.icons.outlined.OfflineBolt
import androidx.compose.material.icons.rounded.ExpandMore
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Icon
import androidx.compose.material3.RadioButton
import androidx.compose.material3.RadioButtonDefaults
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.navigation.NavController
import com.loe.chat.AppGraph
import com.loe.chat.BuildConfig
import com.loe.chat.data.Provider
import com.loe.chat.data.ThemeMode
import com.loe.chat.ui.Routes
import com.loe.chat.ui.components.BotAvatar
import com.loe.chat.ui.components.BotPickerSheet
import com.loe.chat.ui.components.CardDivider
import com.loe.chat.ui.components.ConfirmDialog
import com.loe.chat.ui.components.LoeCard
import com.loe.chat.ui.components.LoeMark
import com.loe.chat.ui.components.LoeTopBar
import com.loe.chat.ui.components.PillButton
import com.loe.chat.ui.components.PrimaryButton
import com.loe.chat.ui.components.SettingsLabel
import com.loe.chat.ui.components.TextInputDialog
import com.loe.chat.ui.theme.LoeTheme
import com.loe.chat.util.Intents
import com.loe.chat.util.Text
import com.loe.chat.util.Toasts
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

private enum class SettingsDialog { DAILY, BUDGET, ADD_EMAIL, PHONE, NOTIFICATIONS, LOG_OUT, LOG_OUT_ALL, DELETE_CHATS, DELETE_ACCOUNT }

@Composable
fun SettingsScreen(graph: AppGraph, nav: NavController) {
    val colors = LoeTheme.colors
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val settings by graph.settings.state.collectAsState()
    val allBots by graph.bots.all.collectAsState()
    var dialog by remember { mutableStateOf<SettingsDialog?>(null) }
    var pickDefaultBot by remember { mutableStateOf(false) }
    var countdown by remember { mutableStateOf(Text.countdownToMidnight()) }
    LaunchedEffect(Unit) {
        while (true) {
            countdown = Text.countdownToMidnight()
            delay(1000)
        }
    }

    fun restartAtWelcome() {
        nav.navigate(com.loe.chat.ui.Routes.WELCOME) { popUpTo(0) { inclusive = true } }
    }

    Column(Modifier.fillMaxSize().background(colors.background)) {
        LoeTopBar("Settings", onBack = { nav.popBackStack() })
        Column(
            Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 16.dp),
        ) {
            SettingsLabel("Subscription")
            LoeCard {
                Text("Free plan", fontSize = 16.5.sp, fontWeight = FontWeight.Bold, color = colors.text)
                Spacer(Modifier.height(2.dp))
                Text(
                    "Connect your own API keys to send messages and access the best models, including GPT-6-Astra, " +
                        "Claude-Opus-5.5, Gemini-3.5-Flash, Nano-Banana-Pro, and Veo-3.1.",
                    fontSize = 14.5.sp,
                    color = colors.textSecondary,
                    lineHeight = 20.sp,
                )
                Spacer(Modifier.height(14.dp))
                PrimaryButton("Subscribe to Loe", onClick = { nav.navigate(Routes.SUBSCRIBE) }, height = 34.dp)
            }
            Text(
                "How billing works",
                fontSize = 13.5.sp,
                color = colors.textSecondary,
                modifier = Modifier.padding(top = 12.dp).clickable { nav.navigate(Routes.info("billing")) },
            )

            SettingsLabel("API keys")
            LoeCard(contentPadding = PaddingValues(horizontal = 16.dp, vertical = 4.dp)) {
                Provider.entries.forEachIndexed { index, provider ->
                    val connected = settings.key(provider) != null
                    Row(
                        Modifier
                            .fillMaxWidth()
                            .clickable { nav.navigate(Routes.API_KEYS) }
                            .padding(vertical = 13.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Text(provider.displayName, fontSize = 14.5.sp, color = colors.text, modifier = Modifier.weight(1f))
                        Text(
                            if (connected) "Connected" else "Not connected",
                            fontSize = 13.5.sp,
                            color = if (connected) colors.link else colors.textSecondary,
                            fontWeight = if (connected) FontWeight.SemiBold else FontWeight.Normal,
                        )
                        Icon(Icons.AutoMirrored.Rounded.KeyboardArrowRight, contentDescription = null, tint = colors.textSecondary)
                    }
                    if (index < Provider.entries.lastIndex) CardDivider()
                }
            }

            SettingsLabel("Compute points")
            LoeCard {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Column(Modifier.weight(1f)) {
                        Text("Remaining points", fontSize = 16.5.sp, fontWeight = FontWeight.Bold, color = colors.text)
                        PointsValue(settings.remainingPoints())
                        Text(
                            "Resets to ${Text.points(settings.dailyPoints)} in $countdown",
                            fontSize = 13.5.sp, color = colors.textSecondary,
                        )
                    }
                    PillButton("Edit", onClick = { dialog = SettingsDialog.DAILY })
                }
                Spacer(Modifier.height(12.dp))
                CardDivider()
                Spacer(Modifier.height(12.dp))
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Column(Modifier.weight(1f)) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Text("Global per-message budget", fontSize = 15.5.sp, fontWeight = FontWeight.Bold, color = colors.text, modifier = Modifier.weight(1f, fill = false))
                            Spacer(Modifier.width(4.dp))
                            Icon(
                                Icons.Outlined.Info, contentDescription = "About the budget", tint = colors.text,
                                modifier = Modifier.size(20.dp).clickable { nav.navigate(Routes.info("points")) },
                            )
                        }
                        PointsValue(settings.perMessageBudget)
                        Text("Applies to all chats", fontSize = 13.5.sp, color = colors.textSecondary)
                    }
                    PillButton("Edit", onClick = { dialog = SettingsDialog.BUDGET })
                }
            }
            Text(
                buildAnnotatedString {
                    append("Compute points are a daily spending guard for your API keys. ")
                    withStyle(SpanStyle(color = colors.link)) { append("Learn more") }
                },
                fontSize = 13.5.sp,
                color = colors.textSecondary,
                modifier = Modifier.padding(top = 12.dp).clickable { nav.navigate(Routes.info("points")) },
            )

            SettingsLabel("Email")
            LoeCard {
                settings.emails.forEachIndexed { index, email ->
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Column(Modifier.weight(1f)) {
                            Text(email, fontSize = 16.sp, color = colors.text)
                            Text(if (index == 0) "Primary email" else "Email", fontSize = 13.5.sp, color = colors.textSecondary)
                        }
                        Text(
                            "Remove", fontSize = 13.5.sp, color = colors.link,
                            modifier = Modifier.clickable { graph.settings.removeEmail(email) }.padding(6.dp),
                        )
                    }
                    Spacer(Modifier.height(12.dp))
                    CardDivider()
                    Spacer(Modifier.height(12.dp))
                }
                Text("Add email", fontSize = 16.sp, color = colors.link, modifier = Modifier.fillMaxWidth().clickable { dialog = SettingsDialog.ADD_EMAIL })
            }
            Text(
                "Your email is saved only on this device. Loe has no accounts or servers.",
                fontSize = 13.5.sp, color = colors.textSecondary, lineHeight = 21.sp,
                modifier = Modifier.padding(top = 12.dp),
            )

            SettingsLabel("Phone number")
            LoeCard {
                val phone = settings.phone
                if (phone == null) {
                    Text("Add a phone number", fontSize = 16.sp, color = colors.link, modifier = Modifier.fillMaxWidth().clickable { dialog = SettingsDialog.PHONE })
                } else {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text(phone, fontSize = 16.sp, color = colors.text, modifier = Modifier.weight(1f))
                        Text("Remove", fontSize = 13.5.sp, color = colors.link, modifier = Modifier.clickable { graph.settings.setPhone(null) }.padding(6.dp))
                    }
                }
            }

            SettingsLabel("Default bot")
            val defaultBot = graph.bots.getOrAssistant(settings.defaultBotId)
            LoeCard(
                modifier = Modifier.clickable { pickDefaultBot = true },
                contentPadding = PaddingValues(16.dp),
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    BotAvatar(defaultBot, 32.dp)
                    Spacer(Modifier.width(12.dp))
                    Text(defaultBot.name, fontSize = 16.sp, fontWeight = FontWeight.Bold, color = colors.text, modifier = Modifier.weight(1f))
                    Icon(Icons.Rounded.ExpandMore, contentDescription = null, tint = colors.text)
                }
            }

            SettingsLabel("Device appearance")
            LoeCard(contentPadding = PaddingValues(horizontal = 16.dp, vertical = 4.dp)) {
                listOf(
                    ThemeMode.LIGHT to "Light theme",
                    ThemeMode.DARK to "Dark theme",
                    ThemeMode.SYSTEM to "System (automatic)",
                ).forEachIndexed { index, (mode, label) ->
                    Row(
                        Modifier.fillMaxWidth().clickable { graph.settings.setTheme(mode) }.padding(vertical = 4.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Text(label, fontSize = 16.sp, color = colors.text, modifier = Modifier.weight(1f))
                        RadioButton(
                            selected = settings.theme == mode,
                            onClick = { graph.settings.setTheme(mode) },
                            colors = RadioButtonDefaults.colors(selectedColor = colors.link, unselectedColor = colors.text),
                        )
                    }
                    if (index < 2) CardDivider()
                }
            }
            Spacer(Modifier.height(16.dp))
            LoeCard {
                Text(
                    "Push notifications", fontSize = 16.sp, color = colors.link,
                    modifier = Modifier.fillMaxWidth().padding(start = 8.dp).clickable { dialog = SettingsDialog.NOTIFICATIONS },
                )
            }
            Spacer(Modifier.height(16.dp))
            LoeCard(contentPadding = PaddingValues(horizontal = 16.dp, vertical = 4.dp)) {
                val links = listOf("About" to "about", "Privacy" to "privacy", "Terms of service" to "terms", "Usage guidelines" to "guidelines", "Contact us" to "contact")
                links.forEachIndexed { index, (label, page) ->
                    Text(
                        label, fontSize = 16.sp, color = colors.link,
                        modifier = Modifier.fillMaxWidth().clickable { nav.navigate(Routes.info(page)) }.padding(start = 8.dp, top = 14.dp, bottom = 14.dp),
                    )
                    if (index < links.lastIndex) CardDivider()
                }
            }
            Spacer(Modifier.height(28.dp))
            Column(Modifier.fillMaxWidth(), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(22.dp)) {
                DangerLink("Log out") { dialog = SettingsDialog.LOG_OUT }
                DangerLink("Log out of all devices") { dialog = SettingsDialog.LOG_OUT_ALL }
                DangerLink("Delete all chats") { dialog = SettingsDialog.DELETE_CHATS }
                DangerLink("Delete account") { dialog = SettingsDialog.DELETE_ACCOUNT }
            }
            Spacer(Modifier.height(40.dp))
            Text(
                "Version: ${BuildConfig.VERSION_NAME} (${BuildConfig.VERSION_CODE})",
                fontSize = 14.5.sp, color = colors.textSecondary, textAlign = TextAlign.Center,
                modifier = Modifier.fillMaxWidth(),
            )
            Spacer(Modifier.height(36.dp))
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.Center, verticalAlignment = Alignment.CenterVertically) {
                Text("by", fontSize = 16.sp, color = colors.textSecondary)
                Spacer(Modifier.width(6.dp))
                LoeMark(24.dp)
                Spacer(Modifier.width(4.dp))
                Text("Loe", fontSize = 24.sp, fontWeight = FontWeight.Bold, color = colors.textTertiary)
            }
            Spacer(Modifier.height(32.dp))
        }
    }

    if (pickDefaultBot) {
        BotPickerSheet(
            title = "Default bot",
            bots = allBots,
            selectedId = settings.defaultBotId,
            onPick = {
                graph.settings.setDefaultBot(it.id)
                pickDefaultBot = false
            },
            onDismiss = { pickDefaultBot = false },
        )
    }

    val notificationPermission = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
        graph.settings.setNotifyReplies(granted)
        if (!granted) Toasts.show(context, "Notifications are turned off for Loe in Android settings.")
    }

    when (dialog) {
        SettingsDialog.DAILY -> TextInputDialog(
            title = "Daily points",
            initial = settings.dailyPoints.toString(),
            message = "How many compute points you can spend per day. Each bot costs a set number of points per message.",
            keyboardType = KeyboardType.Number,
            onConfirm = { value ->
                value.filter { it.isDigit() }.toIntOrNull()?.let { graph.settings.setDailyPoints(it) }
                dialog = null
            },
            onDismiss = { dialog = null },
        )
        SettingsDialog.BUDGET -> TextInputDialog(
            title = "Per-message budget",
            initial = settings.perMessageBudget.toString(),
            message = "Bots that cost more than this per message won't run until you raise it.",
            keyboardType = KeyboardType.Number,
            onConfirm = { value ->
                value.filter { it.isDigit() }.toIntOrNull()?.let { graph.settings.setMessageBudget(it) }
                dialog = null
            },
            onDismiss = { dialog = null },
        )
        SettingsDialog.ADD_EMAIL -> TextInputDialog(
            title = "Add email",
            placeholder = "name@example.com",
            keyboardType = KeyboardType.Email,
            confirmText = "Add",
            onConfirm = { value ->
                val email = value.trim()
                if (android.util.Patterns.EMAIL_ADDRESS.matcher(email).matches()) {
                    graph.settings.addEmail(email)
                    dialog = null
                } else {
                    Toasts.show(context, "That doesn't look like an email address.")
                }
            },
            onDismiss = { dialog = null },
        )
        SettingsDialog.PHONE -> TextInputDialog(
            title = "Add a phone number",
            placeholder = "+1 555 123 4567",
            keyboardType = KeyboardType.Phone,
            confirmText = "Add",
            onConfirm = { value ->
                graph.settings.setPhone(value)
                dialog = null
            },
            onDismiss = { dialog = null },
        )
        SettingsDialog.NOTIFICATIONS -> AlertDialog(
            onDismissRequest = { dialog = null },
            containerColor = colors.background,
            title = { Text("Push notifications", fontWeight = FontWeight.Bold) },
            text = {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        "Notify me when a bot finishes replying while Loe is in the background.",
                        modifier = Modifier.weight(1f), color = colors.textSecondary,
                    )
                    Spacer(Modifier.width(12.dp))
                    Switch(
                        checked = settings.notifyReplies,
                        onCheckedChange = { enabled ->
                            if (enabled && Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU && !graph.notifier.canNotify()) {
                                notificationPermission.launch(Manifest.permission.POST_NOTIFICATIONS)
                            } else {
                                graph.settings.setNotifyReplies(enabled)
                            }
                        },
                        colors = SwitchDefaults.colors(checkedTrackColor = colors.primary),
                    )
                }
            },
            confirmButton = { TextButton(onClick = { dialog = null }) { Text("Done", color = colors.link) } },
        )
        SettingsDialog.LOG_OUT -> ConfirmDialog(
            title = "Log out?",
            message = "You'll go back to the welcome screen. Your chats and API keys stay on this device.",
            confirmText = "Log out",
            destructive = true,
            onConfirm = {
                dialog = null
                graph.settings.logOut(removeKeys = false)
                restartAtWelcome()
            },
            onDismiss = { dialog = null },
        )
        SettingsDialog.LOG_OUT_ALL -> ConfirmDialog(
            title = "Log out of all devices?",
            message = "Loe only runs on this device, so this logs you out here and also removes your saved API keys.",
            confirmText = "Log out",
            destructive = true,
            onConfirm = {
                dialog = null
                graph.settings.logOut(removeKeys = true)
                restartAtWelcome()
            },
            onDismiss = { dialog = null },
        )
        SettingsDialog.DELETE_CHATS -> ConfirmDialog(
            title = "Delete all chats?",
            message = "Every conversation on this device will be permanently deleted.",
            confirmText = "Delete all",
            destructive = true,
            onConfirm = {
                dialog = null
                scope.launch {
                    graph.repository.deleteAllChats()
                    Toasts.show(context, "All chats deleted")
                }
            },
            onDismiss = { dialog = null },
        )
        SettingsDialog.DELETE_ACCOUNT -> ConfirmDialog(
            title = "Delete account?",
            message = "This erases everything Loe stored on this device: your profile, chats, bots you created and API keys. This can't be undone.",
            confirmText = "Delete everything",
            destructive = true,
            onConfirm = {
                dialog = null
                scope.launch {
                    graph.repository.deleteEverything()
                    graph.settings.clearAll()
                    restartAtWelcome()
                }
            },
            onDismiss = { dialog = null },
        )
        null -> Unit
    }
}

@Composable
private fun PointsValue(points: Int) {
    Row(verticalAlignment = Alignment.CenterVertically) {
        Text(Text.points(points), fontSize = 16.5.sp, color = LoeTheme.colors.text)
        Spacer(Modifier.width(4.dp))
        Icon(Icons.Outlined.OfflineBolt, contentDescription = "points", tint = LoeTheme.colors.text, modifier = Modifier.size(19.dp))
    }
}

@Composable
private fun DangerLink(text: String, onClick: () -> Unit) {
    Text(
        text,
        fontSize = 16.sp,
        fontWeight = FontWeight.Bold,
        color = LoeTheme.colors.danger,
        modifier = Modifier.clickable(onClick = onClick).padding(horizontal = 12.dp, vertical = 2.dp),
    )
}

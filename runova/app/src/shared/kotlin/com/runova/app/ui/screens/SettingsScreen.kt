package com.runova.app.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.AdminPanelSettings
import androidx.compose.material.icons.outlined.DeleteForever
import androidx.compose.material.icons.outlined.FileDownload
import androidx.compose.material.icons.rounded.Alarm
import androidx.compose.material.icons.rounded.LightMode
import androidx.compose.material.icons.rounded.PauseCircle
import androidx.compose.material.icons.rounded.RecordVoiceOver
import androidx.compose.material.icons.rounded.Timer
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import com.runova.app.ui.components.ChoiceChips
import com.runova.app.ui.components.GhostButton
import com.runova.app.ui.components.HairlineDivider
import com.runova.app.ui.components.LimeButton
import com.runova.app.ui.components.RunovaCard
import com.runova.app.ui.components.RunovaDialog
import com.runova.app.ui.components.RunovaTextField
import com.runova.app.ui.components.ScreenTopBar
import com.runova.app.ui.components.SectionLabel
import com.runova.app.ui.components.SettingsRow
import com.runova.app.ui.components.StepperField
import com.runova.app.ui.components.ToggleRow
import com.runova.app.ui.model.MapStyle
import com.runova.app.ui.model.SettingsUiState
import com.runova.app.ui.model.ThemeMode
import com.runova.app.ui.theme.Runova
import com.runova.core.model.UnitSystem
import java.util.Locale

class SettingsActions(
    val onBack: () -> Unit = {},
    val onUnits: (UnitSystem) -> Unit = {},
    val onVoice: (Boolean) -> Unit = {},
    val onAutoPause: (Boolean) -> Unit = {},
    val onKeepScreenOn: (Boolean) -> Unit = {},
    val onCountdown: (Boolean) -> Unit = {},
    val onTheme: (ThemeMode) -> Unit = {},
    val onMapStyle: (MapStyle) -> Unit = {},
    val onReminder: (Boolean) -> Unit = {},
    val onReminderTime: (Int, Int) -> Unit = { _, _ -> },
    val onSaveApiKey: (String) -> Unit = {},
    val onClearApiKey: () -> Unit = {},
    val onModel: (String) -> Unit = {},
    val onTestApi: () -> Unit = {},
    val onOpenPermissions: () -> Unit = {},
    val onExportAll: () -> Unit = {},
    val onDeleteAll: () -> Unit = {},
)

@Composable
fun SettingsScreen(state: SettingsUiState, actions: SettingsActions) {
    val c = Runova.colors
    var apiKey by remember { mutableStateOf("") }
    var confirmDelete by remember { mutableStateOf(false) }
    Box(Modifier.fillMaxSize().background(c.background)) {
        Column(Modifier.fillMaxSize().statusBarsPadding().imePadding()) {
            ScreenTopBar("Units & Settings", actions.onBack)
            Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(horizontal = 20.dp)) {
                SectionLabel("Units")
                ChoiceChips(listOf("Metric (km)", "Imperial (mi)"), if (state.units == UnitSystem.METRIC) 0 else 1, { actions.onUnits(if (it == 0) UnitSystem.METRIC else UnitSystem.IMPERIAL) })

                SectionLabel("Run tracking")
                RunovaCard(Modifier.fillMaxWidth()) {
                    Column(Modifier.padding(horizontal = 16.dp, vertical = 4.dp)) {
                        ToggleRow("Voice feedback", "Spoken split updates every ${if (state.units == UnitSystem.METRIC) "km" else "mile"}", state.voice, actions.onVoice, Icons.Rounded.RecordVoiceOver)
                        HairlineDivider()
                        ToggleRow("Auto-pause", "Pause when you stop, resume when you move", state.autoPause, actions.onAutoPause, Icons.Rounded.PauseCircle)
                        HairlineDivider()
                        ToggleRow("Keep screen on", "While the run screen is open", state.keepScreenOn, actions.onKeepScreenOn, Icons.Rounded.LightMode)
                        HairlineDivider()
                        ToggleRow("3-second countdown", "Before tracking starts", state.countdown, actions.onCountdown, Icons.Rounded.Timer)
                    }
                }

                SectionLabel("Appearance")
                ChoiceChips(listOf("Dark", "Light", "System"), ThemeMode.entries.indexOf(state.theme), { actions.onTheme(ThemeMode.entries[it]) })
                Spacer(Modifier.height(10.dp))
                Text("Map style", style = Runova.type.label, color = c.textSecondary, modifier = Modifier.padding(start = 6.dp, bottom = 6.dp))
                ChoiceChips(listOf("Match theme", "Dark map", "Light map"), MapStyle.entries.indexOf(state.mapStyle), { actions.onMapStyle(MapStyle.entries[it]) })

                SectionLabel("Daily reminder")
                RunovaCard(Modifier.fillMaxWidth()) {
                    Column(Modifier.padding(16.dp)) {
                        ToggleRow("Remind me to run", "A friendly nudge if you haven't run yet", state.reminderEnabled, actions.onReminder, Icons.Rounded.Alarm)
                        if (state.reminderEnabled) {
                            Spacer(Modifier.height(8.dp))
                            StepperField(
                                "Reminder time",
                                String.format(Locale.US, "%02d:%02d", state.reminderHour, state.reminderMinute),
                                onMinus = {
                                    val total = (state.reminderHour * 60 + state.reminderMinute - 15 + 1440) % 1440
                                    actions.onReminderTime(total / 60, total % 60)
                                },
                                onPlus = {
                                    val total = (state.reminderHour * 60 + state.reminderMinute + 15) % 1440
                                    actions.onReminderTime(total / 60, total % 60)
                                },
                            )
                        }
                    }
                }

                SectionLabel("AI Coach")
                RunovaCard(Modifier.fillMaxWidth()) {
                    Column(Modifier.padding(16.dp)) {
                        Text(
                            if (state.claudeKeySet) "Claude is connected. The coach answers with Claude and falls back to the offline coach when there's no connection."
                            else "The coach works offline with built-in rules. Add an Anthropic API key to get richer, conversational answers from Claude.",
                            style = Runova.type.bodyS,
                            color = c.textSecondary,
                        )
                        Spacer(Modifier.height(12.dp))
                        if (!state.claudeKeySet) {
                            RunovaTextField("Anthropic API key", apiKey, { apiKey = it.trim() }, placeholder = "sk-ant-…", keyboardType = KeyboardType.Password, secret = true, supporting = "Stored encrypted on this device only.")
                            Spacer(Modifier.height(12.dp))
                            LimeButton("Save key", { actions.onSaveApiKey(apiKey); apiKey = "" }, Modifier.fillMaxWidth(), enabled = apiKey.length > 20, height = 50.dp, glow = false, textStyle = Runova.type.titleS.copy(fontWeight = FontWeight.Bold))
                        } else {
                            Text("Model", style = Runova.type.label, color = c.textSecondary, modifier = Modifier.padding(start = 4.dp, bottom = 6.dp))
                            ChoiceChips(state.claudeModels.map { it.label }, state.claudeModels.indexOfFirst { it.id == state.claudeModel }, { actions.onModel(state.claudeModels[it].id) })
                            Spacer(Modifier.height(12.dp))
                            Row {
                                GhostButton(if (state.claudeTesting) "Testing…" else "Test connection", actions.onTestApi, Modifier.weight(1f), height = 48.dp)
                                Spacer(Modifier.width(10.dp))
                                GhostButton("Remove key", actions.onClearApiKey, Modifier.weight(1f), color = c.red, height = 48.dp)
                            }
                            if (state.claudeTestResult != null) {
                                Spacer(Modifier.height(10.dp))
                                Text(state.claudeTestResult, style = Runova.type.bodyS, color = c.textSecondary)
                            }
                        }
                    }
                }

                SectionLabel("Data & privacy")
                RunovaCard(Modifier.fillMaxWidth()) {
                    Column {
                        SettingsRow(Icons.Outlined.AdminPanelSettings, "App permissions", actions.onOpenPermissions)
                        HairlineDivider()
                        SettingsRow(Icons.Outlined.FileDownload, "Export all runs (GPX)", actions.onExportAll)
                        HairlineDivider()
                        SettingsRow(Icons.Outlined.DeleteForever, "Delete all data", { confirmDelete = true }, iconTint = c.red)
                    }
                }
                Spacer(Modifier.height(16.dp))
                Text("RUNOVA ${state.version}", style = Runova.type.caption, color = c.textTertiary, modifier = Modifier.fillMaxWidth().padding(bottom = 8.dp), textAlign = androidx.compose.ui.text.style.TextAlign.Center)
                Spacer(Modifier.navigationBarsPadding().height(16.dp))
            }
        }
        RunovaDialog(
            visible = confirmDelete,
            onDismiss = { confirmDelete = false },
            title = "Delete all data?",
            message = "All runs, routes, achievements, XP and settings will be permanently removed from this device.",
            confirmText = "Delete everything",
            onConfirm = { confirmDelete = false; actions.onDeleteAll() },
            icon = Icons.Outlined.DeleteForever,
            iconTint = c.red,
            destructive = true,
        )
    }
}

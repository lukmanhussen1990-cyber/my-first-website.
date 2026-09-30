package com.runova.app.ui.screens

import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
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
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Bluetooth
import androidx.compose.material.icons.outlined.BluetoothDisabled
import androidx.compose.material.icons.outlined.PhotoCamera
import androidx.compose.material.icons.rounded.Alarm
import androidx.compose.material.icons.rounded.Bluetooth
import androidx.compose.material.icons.rounded.BluetoothSearching
import androidx.compose.material.icons.rounded.Check
import androidx.compose.material.icons.rounded.Favorite
import androidx.compose.material.icons.rounded.LocationOn
import androidx.compose.material.icons.rounded.SignalCellularAlt
import androidx.compose.material3.CircularProgressIndicator
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
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.runova.app.ui.components.ChoiceChips
import com.runova.app.ui.components.GhostButton
import com.runova.app.ui.components.GradientIcon
import com.runova.app.ui.components.HairlineDivider
import com.runova.app.ui.components.LimeButton
import com.runova.app.ui.components.PlatformBackHandler
import com.runova.app.ui.components.RunovaCard
import com.runova.app.ui.components.RunovaIcons
import com.runova.app.ui.components.RunovaSheet
import com.runova.app.ui.components.RunovaTextField
import com.runova.app.ui.components.ScreenTopBar
import com.runova.app.ui.components.SectionLabel
import com.runova.app.ui.components.StepperField
import com.runova.app.ui.components.circleGlow
import com.runova.app.ui.model.HeartRateUiState
import com.runova.app.ui.model.HrConnection
import com.runova.app.ui.model.InboxItemUi
import com.runova.app.ui.model.InboxKind
import com.runova.app.ui.model.PersonalInfoUiState
import com.runova.app.ui.model.ProfileUiState
import com.runova.app.ui.model.ThemeMode
import com.runova.app.ui.theme.Runova
import com.runova.core.format.Fmt
import com.runova.core.format.UnitConv
import com.runova.core.model.Sex
import com.runova.core.model.UnitSystem
import com.runova.core.progress.Levels

// ================================================================================== personal info

class PersonalInfoActions(
    val onBack: () -> Unit = {},
    val onSave: (PersonalInfoUiState) -> Unit = {},
    val onPickPhoto: () -> Unit = {},
    val onRemovePhoto: () -> Unit = {},
)

@Composable
fun PersonalInfoScreen(state: PersonalInfoUiState, actions: PersonalInfoActions) {
    val c = Runova.colors
    var draft by remember(state) { mutableStateOf(state) }
    val metric = state.units == UnitSystem.METRIC
    Box(Modifier.fillMaxSize().background(c.background)) {
        Column(Modifier.fillMaxSize().statusBarsPadding().imePadding()) {
            ScreenTopBar("Personal Info", actions.onBack)
            Column(Modifier.weight(1f).verticalScroll(rememberScrollState()).padding(horizontal = 20.dp)) {
                Box(Modifier.fillMaxWidth().padding(vertical = 12.dp), contentAlignment = Alignment.Center) {
                    Box(Modifier.size(120.dp).clickable(onClick = actions.onPickPhoto)) {
                        Avatar(
                            ProfileUiState(draft.name, draft.avatar, Levels.progress(0), "", 0, 0.0, 0, state.units, "", false, "", 0, 0, 0),
                            Modifier.fillMaxSize().border(3.dp, c.lime, CircleShape),
                        )
                        Box(
                            Modifier.align(Alignment.BottomEnd).size(38.dp).clip(CircleShape).background(c.lime).border(3.dp, c.background, CircleShape),
                            contentAlignment = Alignment.Center,
                        ) { Icon(Icons.Outlined.PhotoCamera, "Change photo", tint = c.onLime, modifier = Modifier.size(20.dp)) }
                    }
                }
                if (draft.avatar != null) {
                    Text(
                        "Remove photo",
                        style = Runova.type.label,
                        color = c.red,
                        modifier = Modifier.fillMaxWidth().clickable(onClick = actions.onRemovePhoto).padding(8.dp),
                        textAlign = TextAlign.Center,
                    )
                }
                RunovaTextField("Name", draft.name, { draft = draft.copy(name = it.take(40)) }, placeholder = "Your name")
                SectionLabel("Sex (for estimates)")
                val sexes = listOf(Sex.MALE, Sex.FEMALE, Sex.OTHER)
                ChoiceChips(listOf("Male", "Female", "Other"), sexes.indexOf(draft.sex), { draft = draft.copy(sex = sexes[it]) })
                SectionLabel("Body")
                StepperField("Age", "${draft.age} years", { draft = draft.copy(age = (draft.age - 1).coerceAtLeast(10)) }, { draft = draft.copy(age = (draft.age + 1).coerceAtMost(100)) })
                Spacer(Modifier.height(10.dp))
                StepperField(
                    "Height",
                    Fmt.height(draft.heightCm, state.units),
                    { draft = draft.copy(heightCm = (draft.heightCm - if (metric) 1.0 else UnitConv.CM_PER_INCH).coerceAtLeast(120.0)) },
                    { draft = draft.copy(heightCm = (draft.heightCm + if (metric) 1.0 else UnitConv.CM_PER_INCH).coerceAtMost(230.0)) },
                )
                Spacer(Modifier.height(10.dp))
                StepperField(
                    "Weight",
                    Fmt.weight(draft.weightKg, state.units),
                    { draft = draft.copy(weightKg = (draft.weightKg - if (metric) 0.5 else UnitConv.lbToKg(1.0)).coerceAtLeast(30.0)) },
                    { draft = draft.copy(weightKg = (draft.weightKg + if (metric) 0.5 else UnitConv.lbToKg(1.0)).coerceAtMost(250.0)) },
                )
                Spacer(Modifier.height(12.dp))
                Text(
                    "Weight and height are used to estimate calories and stride length. Estimates are approximations, not medical measurements.",
                    style = Runova.type.bodyS,
                    color = c.textTertiary,
                )
                Spacer(Modifier.height(20.dp))
            }
            LimeButton(
                "Save",
                { actions.onSave(draft) },
                Modifier.fillMaxWidth().navigationBarsPadding().padding(20.dp),
                enabled = draft.name.isNotBlank(),
                glow = false,
            )
        }
    }
}

// ================================================================================== heart rate

class HeartRateActions(
    val onBack: () -> Unit = {},
    val onRequestPermission: () -> Unit = {},
    val onEnableBluetooth: () -> Unit = {},
    val onScan: () -> Unit = {},
    val onStopScan: () -> Unit = {},
    val onConnect: (String) -> Unit = {},
    val onDisconnect: () -> Unit = {},
)

@Composable
fun HeartRateScreen(state: HeartRateUiState, actions: HeartRateActions) {
    val c = Runova.colors
    Box(Modifier.fillMaxSize().background(c.background)) {
        Column(Modifier.fillMaxSize().statusBarsPadding()) {
            ScreenTopBar("Heart Rate", actions.onBack)
            Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(horizontal = 20.dp)) {
                LiveHeartCard(state)
                Spacer(Modifier.height(16.dp))
                when {
                    !state.supported -> InfoCard(Icons.Outlined.BluetoothDisabled, "Bluetooth LE not available", "This device doesn't support Bluetooth Low Energy heart-rate sensors.")
                    !state.permissionGranted -> {
                        InfoCard(Icons.Outlined.Bluetooth, "Nearby devices permission", "RUNOVA needs permission to find and connect to your heart-rate strap or watch.")
                        Spacer(Modifier.height(12.dp))
                        LimeButton("Allow", actions.onRequestPermission, Modifier.fillMaxWidth(), glow = false)
                    }
                    !state.bluetoothOn -> {
                        InfoCard(Icons.Outlined.BluetoothDisabled, "Bluetooth is off", "Turn on Bluetooth to connect a heart-rate monitor.")
                        Spacer(Modifier.height(12.dp))
                        LimeButton("Turn on Bluetooth", actions.onEnableBluetooth, Modifier.fillMaxWidth(), glow = false)
                    }
                    state.connection == HrConnection.CONNECTED -> {
                        GhostButton("Disconnect ${state.deviceName ?: "sensor"}", actions.onDisconnect, Modifier.fillMaxWidth(), color = c.red)
                    }
                    else -> {
                        if (state.scanning) GhostButton("Stop scanning", actions.onStopScan, Modifier.fillMaxWidth(), icon = Icons.Rounded.BluetoothSearching)
                        else LimeButton("Scan for devices", actions.onScan, Modifier.fillMaxWidth(), icon = Icons.Rounded.BluetoothSearching, glow = false)
                        SectionLabel(if (state.scanning) "Searching nearby…" else "Devices")
                        if (state.devices.isEmpty()) {
                            Text(
                                if (state.scanning) "Put your chest strap on (it wakes up with skin contact) or enable heart-rate broadcast on your watch."
                                else "No devices yet. Tap “Scan for devices”.",
                                style = Runova.type.bodyS,
                                color = c.textSecondary,
                                modifier = Modifier.padding(horizontal = 6.dp),
                            )
                        } else {
                            RunovaCard(Modifier.fillMaxWidth()) {
                                Column {
                                    state.devices.forEachIndexed { i, d ->
                                        Row(
                                            Modifier.fillMaxWidth().clickable { actions.onConnect(d.address) }.padding(horizontal = 18.dp, vertical = 15.dp),
                                            verticalAlignment = Alignment.CenterVertically,
                                        ) {
                                            Icon(Icons.Rounded.Bluetooth, null, tint = c.accent, modifier = Modifier.size(24.dp))
                                            Spacer(Modifier.width(14.dp))
                                            Column(Modifier.weight(1f)) {
                                                Text(d.name, style = Runova.type.body, color = c.textPrimary)
                                                Text(d.address, style = Runova.type.caption, color = c.textTertiary)
                                            }
                                            if (state.connection == HrConnection.CONNECTING && state.deviceName == d.name) {
                                                CircularProgressIndicator(Modifier.size(22.dp), color = c.lime, strokeWidth = 2.5.dp)
                                            } else {
                                                Icon(Icons.Rounded.SignalCellularAlt, null, tint = if (d.rssi > -70) c.accent else c.textSecondary, modifier = Modifier.size(20.dp))
                                            }
                                        }
                                        if (i != state.devices.lastIndex) HairlineDivider()
                                    }
                                }
                            }
                        }
                    }
                }
                Spacer(Modifier.height(16.dp))
                Text(
                    "Works with Bluetooth Smart heart-rate straps (Polar, Garmin HRM, Wahoo, …) and watches that broadcast heart rate. Once connected, BPM appears on the run screen and average/max heart rate are saved with each run.",
                    style = Runova.type.bodyS,
                    color = c.textTertiary,
                )
                Spacer(Modifier.navigationBarsPadding().height(20.dp))
            }
        }
    }
}

@Composable
private fun LiveHeartCard(state: HeartRateUiState) {
    val c = Runova.colors
    val beat = rememberInfiniteTransition().animateFloat(1f, 1.14f, infiniteRepeatable(tween(((60_000 / (state.bpm ?: 70)) / 2).coerceIn(200, 800)), RepeatMode.Reverse))
    val connected = state.connection == HrConnection.CONNECTED
    RunovaCard(Modifier.fillMaxWidth(), shape = RoundedCornerShape(26.dp), border = if (connected) c.red.copy(alpha = 0.45f) else c.border) {
        Row(Modifier.padding(20.dp), verticalAlignment = Alignment.CenterVertically) {
            Box(
                Modifier.size(78.dp).graphicsLayer { val s = if (connected) beat.value else 1f; scaleX = s; scaleY = s }.circleGlow(c.red, 14.dp, if (connected && c.isDark) 0.3f else 0f),
                contentAlignment = Alignment.Center,
            ) {
                Icon(Icons.Rounded.Favorite, null, tint = if (connected) c.red else c.textTertiary, modifier = Modifier.size(64.dp))
            }
            Spacer(Modifier.width(18.dp))
            Column {
                Text(
                    when (state.connection) {
                        HrConnection.CONNECTED -> state.deviceName ?: "Heart-rate sensor"
                        HrConnection.CONNECTING -> "Connecting…"
                        HrConnection.DISCONNECTED -> "Not connected"
                    },
                    style = Runova.type.titleS,
                    color = c.textPrimary,
                )
                Row(verticalAlignment = Alignment.Bottom) {
                    Text(if (connected) state.bpm?.toString() ?: "--" else "--", style = Runova.type.metricL, color = c.textPrimary)
                    Text(" BPM", style = Runova.type.body.copy(fontWeight = FontWeight.SemiBold), color = c.textSecondary, modifier = Modifier.padding(bottom = 7.dp))
                }
            }
        }
    }
}

@Composable
private fun InfoCard(icon: androidx.compose.ui.graphics.vector.ImageVector, title: String, text: String) {
    val c = Runova.colors
    RunovaCard(Modifier.fillMaxWidth()) {
        Row(Modifier.padding(16.dp), verticalAlignment = Alignment.CenterVertically) {
            Icon(icon, null, tint = c.accent, modifier = Modifier.size(28.dp))
            Spacer(Modifier.width(14.dp))
            Column {
                Text(title, style = Runova.type.titleS, color = c.textPrimary)
                Text(text, style = Runova.type.bodyS, color = c.textSecondary)
            }
        }
    }
}

// ================================================================================== about

@Composable
fun AboutScreen(version: String, onBack: () -> Unit) {
    val c = Runova.colors
    Box(Modifier.fillMaxSize().background(c.background)) {
        Column(Modifier.fillMaxSize().statusBarsPadding()) {
            ScreenTopBar("About RUNOVA", onBack)
            Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(horizontal = 20.dp)) {
                Column(Modifier.fillMaxWidth().padding(vertical = 18.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                    Box(Modifier.size(104.dp).circleGlow(c.lime, 22.dp, if (c.isDark) 0.2f else 0f), contentAlignment = Alignment.Center) {
                        GradientIcon(RunovaIcons.Sprinter, Brush.verticalGradient(listOf(Color(0xFFE6FF7A), c.lime, Color(0xFF9BE22E))), Modifier.size(96.dp))
                    }
                    Text("RUNOVA", style = Runova.type.titleXL.copy(fontSize = 34.sp, letterSpacing = 2.sp), color = c.textPrimary)
                    Text("Run. Burn. Level Up.", style = Runova.type.body, color = c.accent)
                    Spacer(Modifier.height(4.dp))
                    Text("Version $version", style = Runova.type.label, color = c.textSecondary)
                }
                AboutSection("How RUNOVA works", "GPS runs are recorded with your phone's location sensors in a foreground service, so tracking continues with the screen off. Distances, pace, splits and elevation are computed on your device.")
                AboutSection("Calorie estimates", "Calories are ESTIMATES calculated with the ACSM metabolic equations from your weight, speed and elevation change, plus an estimate for everyday walking from your step count. Real energy use varies from person to person.")
                AboutSection("Steps", "Steps come from the phone's hardware step counter when available. Without it (or without the Physical activity permission) steps are estimated from distance and stride length and marked “est.”.")
                AboutSection("Your data", "Runs, routes, goals and achievements are stored only on this device. Nothing is uploaded unless you share a run or, if you add an API key, send a question to the AI coach (Claude by Anthropic).")
                AboutSection("Maps", "Map data © OpenStreetMap contributors (openstreetmap.org/copyright). Map tiles © CARTO. Tiles are cached on your device.")
                AboutSection(
                    "Open-source licenses",
                    "Jetpack Compose, AndroidX and Kotlin — Apache License 2.0. Barlow typeface by Jeremy Tribby — SIL Open Font License 1.1. Material Icons — Apache License 2.0.",
                )
                AboutSection("Health notice", "RUNOVA is a fitness app, not a medical device. Consult a doctor before starting a new exercise program.")
                Spacer(Modifier.navigationBarsPadding().height(24.dp))
            }
        }
    }
}

@Composable
private fun AboutSection(title: String, text: String) {
    val c = Runova.colors
    RunovaCard(Modifier.fillMaxWidth().padding(vertical = 6.dp)) {
        Column(Modifier.padding(16.dp)) {
            Text(title, style = Runova.type.titleS, color = c.textPrimary)
            Spacer(Modifier.height(4.dp))
            Text(text, style = Runova.type.bodyS, color = c.textSecondary)
        }
    }
}

// ================================================================================== notifications

class NotificationsActions(
    val onBack: () -> Unit = {},
    val onMarkAllRead: () -> Unit = {},
    val onOpenReminders: () -> Unit = {},
    val onOpenItem: (InboxItemUi) -> Unit = {},
)

@Composable
fun NotificationsScreen(items: List<InboxItemUi>, reminderText: String, actions: NotificationsActions) {
    val c = Runova.colors
    Box(Modifier.fillMaxSize().background(c.background)) {
        Column(Modifier.fillMaxSize().statusBarsPadding()) {
            ScreenTopBar("Notifications", actions.onBack) {
                if (items.any { it.unread }) {
                    Text("Mark all read", style = Runova.type.label.copy(fontWeight = FontWeight.Bold), color = c.accent, modifier = Modifier.clip(CircleShape).clickable(onClick = actions.onMarkAllRead).padding(horizontal = 10.dp, vertical = 8.dp))
                }
            }
            Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(horizontal = 20.dp)) {
                RunovaCard(Modifier.fillMaxWidth(), onClick = actions.onOpenReminders) {
                    Row(Modifier.padding(16.dp), verticalAlignment = Alignment.CenterVertically) {
                        Box(Modifier.size(40.dp).clip(CircleShape).background(c.lime.copy(alpha = 0.14f)), contentAlignment = Alignment.Center) {
                            Icon(Icons.Rounded.Alarm, null, tint = c.accent, modifier = Modifier.size(22.dp))
                        }
                        Spacer(Modifier.width(14.dp))
                        Column(Modifier.weight(1f)) {
                            Text("Daily reminder", style = Runova.type.titleS, color = c.textPrimary)
                            Text(reminderText, style = Runova.type.bodyS, color = c.textSecondary)
                        }
                        Text("Edit", style = Runova.type.label.copy(fontWeight = FontWeight.Bold), color = c.accent)
                    }
                }
                Spacer(Modifier.height(14.dp))
                if (items.isEmpty()) {
                    EmptyNote("You're all caught up. Achievements, level-ups and goal completions will show up here.")
                }
                items.forEach { item ->
                    InboxRow(item) { actions.onOpenItem(item) }
                    Spacer(Modifier.height(10.dp))
                }
                Spacer(Modifier.navigationBarsPadding().height(20.dp))
            }
        }
    }
}

@Composable
private fun InboxRow(item: InboxItemUi, onClick: () -> Unit) {
    val c = Runova.colors
    val (icon, tint) = when (item.kind) {
        InboxKind.ACHIEVEMENT -> Icons.Rounded.Check to c.yellow
        InboxKind.LEVEL -> Icons.Rounded.SignalCellularAlt to c.lime
        InboxKind.GOAL -> Icons.Rounded.Check to c.green
        InboxKind.RUN -> RunovaIcons.Sneaker to c.accent
        InboxKind.TIP -> RunovaIcons.CoachBot to c.teal
        InboxKind.REMINDER -> Icons.Rounded.Favorite to c.red
    }
    RunovaCard(Modifier.fillMaxWidth(), onClick = onClick, border = if (item.unread) c.lime.copy(alpha = 0.35f) else c.border) {
        Row(Modifier.padding(16.dp), verticalAlignment = Alignment.Top) {
            Box(Modifier.size(40.dp).clip(CircleShape).background(tint.copy(alpha = 0.15f)), contentAlignment = Alignment.Center) {
                Icon(icon, null, tint = tint, modifier = Modifier.size(22.dp))
            }
            Spacer(Modifier.width(14.dp))
            Column(Modifier.weight(1f)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(item.title, style = Runova.type.titleS, color = c.textPrimary, modifier = Modifier.weight(1f))
                    if (item.unread) Box(Modifier.size(8.dp).clip(CircleShape).background(c.lime))
                }
                Text(item.body, style = Runova.type.bodyS, color = c.textSecondary)
                Spacer(Modifier.height(4.dp))
                Text(item.timeText, style = Runova.type.caption, color = c.textTertiary)
            }
        }
    }
}

// ================================================================================== sheets & dialogs

@Composable
fun ThemePickerSheet(visible: Boolean, current: ThemeMode, onPick: (ThemeMode) -> Unit, onDismiss: () -> Unit) {
    val c = Runova.colors
    RunovaSheet(visible, onDismiss) {
        Text("Theme", style = Runova.type.titleM, color = c.textPrimary)
        Spacer(Modifier.height(12.dp))
        for ((mode, label, desc) in listOf(
            Triple(ThemeMode.DARK, "Dark", "The signature RUNOVA look"),
            Triple(ThemeMode.LIGHT, "Light", "Bright surfaces, great in sunlight"),
            Triple(ThemeMode.SYSTEM, "System", "Follow the Android setting"),
        )) {
            Row(
                Modifier.fillMaxWidth().clip(RoundedCornerShape(16.dp)).clickable { onPick(mode) }.padding(vertical = 12.dp, horizontal = 6.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Column(Modifier.weight(1f)) {
                    Text(label, style = Runova.type.body, color = c.textPrimary)
                    Text(desc, style = Runova.type.bodyS, color = c.textSecondary)
                }
                Box(
                    Modifier.size(24.dp).clip(CircleShape).border(2.dp, if (mode == current) c.lime else c.textTertiary, CircleShape).padding(5.dp),
                ) { if (mode == current) Box(Modifier.fillMaxSize().clip(CircleShape).background(c.lime)) }
            }
        }
    }
}

/** Explains why location is needed; offers the system dialog or, when permanently denied, Settings. */
@Composable
fun LocationPermissionSheet(visible: Boolean, permanentlyDenied: Boolean, onAllow: () -> Unit, onOpenSettings: () -> Unit, onDismiss: () -> Unit) {
    val c = Runova.colors
    RunovaSheet(visible, onDismiss) {
        Box(Modifier.fillMaxWidth(), contentAlignment = Alignment.Center) {
            Box(Modifier.size(72.dp).clip(CircleShape).background(c.lime.copy(alpha = 0.14f)), contentAlignment = Alignment.Center) {
                Icon(Icons.Rounded.LocationOn, null, tint = c.accent, modifier = Modifier.size(40.dp))
            }
        }
        Spacer(Modifier.height(14.dp))
        Text("Location access needed", style = Runova.type.titleM, color = c.textPrimary, modifier = Modifier.fillMaxWidth(), textAlign = TextAlign.Center)
        Spacer(Modifier.height(6.dp))
        Text(
            if (permanentlyDenied) "Location permission was denied. To track runs, open Settings › Permissions › Location and choose “Allow only while using the app” with precise location."
            else "RUNOVA uses GPS to record your route, distance and pace while you run. Location is only used during a run.",
            style = Runova.type.bodyS,
            color = c.textSecondary,
            textAlign = TextAlign.Center,
            modifier = Modifier.fillMaxWidth(),
        )
        Spacer(Modifier.height(20.dp))
        if (permanentlyDenied) LimeButton("OPEN SETTINGS", onOpenSettings, Modifier.fillMaxWidth(), glow = false)
        else LimeButton("ALLOW LOCATION", onAllow, Modifier.fillMaxWidth(), glow = false)
        Spacer(Modifier.height(10.dp))
        GhostButton("Not now", onDismiss, Modifier.fillMaxWidth())
    }
}

/** Offered at launch when a run was interrupted (process killed / phone rebooted). */
@Composable
fun RecoveryDialog(visible: Boolean, summary: String, onResume: () -> Unit, onSave: () -> Unit, onDiscard: () -> Unit) {
    val c = Runova.colors
    PlatformBackHandler(enabled = visible) {}
    androidx.compose.animation.AnimatedVisibility(visible, enter = androidx.compose.animation.fadeIn(), exit = androidx.compose.animation.fadeOut()) {
        Box(Modifier.fillMaxSize().background(c.scrim).padding(28.dp), contentAlignment = Alignment.Center) {
            Column(
                Modifier.fillMaxWidth().clip(RoundedCornerShape(28.dp)).background(c.surface).border(1.dp, c.border, RoundedCornerShape(28.dp)).padding(24.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(10.dp),
            ) {
                Icon(RunovaIcons.Sneaker, null, tint = c.accent, modifier = Modifier.size(40.dp))
                Text("Unfinished run found", style = Runova.type.titleM, color = c.textPrimary)
                Text(summary, style = Runova.type.bodyS, color = c.textSecondary, textAlign = TextAlign.Center)
                Spacer(Modifier.height(6.dp))
                LimeButton("RESUME RUN", onResume, Modifier.fillMaxWidth(), height = 54.dp, glow = false)
                GhostButton("Finish & save", onSave, Modifier.fillMaxWidth())
                GhostButton("Discard", onDiscard, Modifier.fillMaxWidth(), color = c.red)
            }
        }
    }
}

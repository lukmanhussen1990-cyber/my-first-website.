package com.imran.jarvis.ui.settings

import android.content.Context
import androidx.compose.foundation.BorderStroke
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
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.KeyboardArrowRight
import androidx.compose.material.icons.filled.Apps
import androidx.compose.material.icons.filled.ArrowDropDown
import androidx.compose.material.icons.filled.Call
import androidx.compose.material.icons.filled.GraphicEq
import androidx.compose.material.icons.filled.Key
import androidx.compose.material.icons.filled.Notifications
import androidx.compose.material.icons.filled.Palette
import androidx.compose.material.icons.filled.PowerSettingsNew
import androidx.compose.material.icons.filled.RecordVoiceOver
import androidx.compose.material.icons.filled.Psychology
import androidx.compose.material.icons.filled.Security
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.filled.Translate
import androidx.compose.material.icons.filled.Visibility
import androidx.compose.material.icons.filled.VisibilityOff
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.RadioButton
import androidx.compose.material3.RadioButtonDefaults
import androidx.compose.material3.Surface
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.imran.jarvis.JarvisViewModel
import com.imran.jarvis.PermissionState
import com.imran.jarvis.ai.AiModels
import com.imran.jarvis.data.AiProvider
import com.imran.jarvis.data.AppLanguage
import com.imran.jarvis.data.AppSettings
import com.imran.jarvis.data.VoiceGender
import com.imran.jarvis.ui.components.BackButton
import com.imran.jarvis.ui.components.JarvisTopBar
import com.imran.jarvis.ui.components.MiniOrb
import com.imran.jarvis.ui.theme.JarvisBackground
import com.imran.jarvis.ui.theme.JarvisColors

@Composable
fun SettingsScreen(
    vm: JarvisViewModel,
    onBack: () -> Unit,
    onCallsToggle: (Boolean) -> Unit,
    onNotificationsToggle: (Boolean) -> Unit,
    onOpenNotificationAccess: () -> Unit,
    onAlwaysOnToggle: (Boolean) -> Unit,
    onOpenBatterySettings: () -> Unit,
) {
    val settings by vm.settings.collectAsStateWithLifecycle()
    val permissions by vm.permissions.collectAsStateWithLifecycle()
    SettingsContent(
        settings = settings,
        permissions = permissions,
        loadApiKey = vm::loadApiKey,
        onSaveApiKey = vm::saveApiKey,
        onProvider = vm::setProvider,
        onModel = vm::setModel,
        onLanguage = vm::setLanguage,
        onVoice = vm::setVoice,
        onCallsToggle = onCallsToggle,
        onNotificationsToggle = onNotificationsToggle,
        onOpenAppsToggle = vm::setOpenAppsEnabled,
        onOpenNotificationAccess = onOpenNotificationAccess,
        onAlwaysOnToggle = onAlwaysOnToggle,
        onOpenBatterySettings = onOpenBatterySettings,
        onMessage = vm::showMessage,
        onBack = onBack,
    )
}

/** The Settings screen without any ViewModel, so it can be drawn from plain values. */
@Composable
fun SettingsContent(
    settings: AppSettings,
    permissions: PermissionState,
    loadApiKey: suspend (AiProvider) -> String,
    onSaveApiKey: (AiProvider, String) -> Unit,
    onProvider: (AiProvider) -> Unit,
    onModel: (AiProvider, String) -> Unit,
    onLanguage: (AppLanguage) -> Unit,
    onVoice: (VoiceGender) -> Unit,
    onCallsToggle: (Boolean) -> Unit,
    onNotificationsToggle: (Boolean) -> Unit,
    onOpenAppsToggle: (Boolean) -> Unit,
    onOpenNotificationAccess: () -> Unit,
    onAlwaysOnToggle: (Boolean) -> Unit,
    onOpenBatterySettings: () -> Unit,
    onMessage: (String) -> Unit,
    onBack: () -> Unit,
) {
    JarvisBackground {
        Column(Modifier.fillMaxSize().safeDrawingPadding()) {
            JarvisTopBar(start = { BackButton(onBack) })

            Column(
                modifier = Modifier
                    .weight(1f)
                    .verticalScroll(rememberScrollState())
                    .padding(horizontal = 16.dp),
                verticalArrangement = Arrangement.spacedBy(14.dp),
            ) {
                Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(start = 4.dp)) {
                    Icon(Icons.Filled.Settings, contentDescription = null, tint = JarvisColors.Cyan, modifier = Modifier.size(24.dp))
                    Spacer(Modifier.width(10.dp))
                    Text("Settings", color = Color.White, fontSize = 22.sp, fontWeight = FontWeight.SemiBold)
                }

                ApiKeyCard(
                    provider = settings.provider,
                    onProvider = onProvider,
                    loadApiKey = loadApiKey,
                    onSave = onSaveApiKey,
                )

                ModelCard(
                    provider = settings.provider,
                    model = settings.customModels[settings.provider].orEmpty(),
                    onModel = { onModel(settings.provider, it) },
                )

                SettingsCard(Icons.Filled.Translate, "Language") {
                    RadioRow(
                        options = AppLanguage.entries,
                        label = { it.displayName },
                        selected = settings.language,
                        onSelect = onLanguage,
                    )
                }

                SettingsCard(Icons.Filled.GraphicEq, "Voice") {
                    RadioRow(
                        options = VoiceGender.entries,
                        label = { it.displayName },
                        selected = settings.voice,
                        onSelect = onVoice,
                    )
                    Spacer(Modifier.height(8.dp))
                    Text(
                        "Uses the voices installed on your phone (Google Text-to-speech). You will hear a short sample when you change this.",
                        color = JarvisColors.TextHint,
                        fontSize = 12.sp,
                        lineHeight = 16.sp,
                    )
                }

                SettingsCard(Icons.Filled.Security, "Permissions") {
                    PermissionRow(
                        icon = Icons.Filled.Call,
                        title = "Calls",
                        subtitle = "Make and manage calls",
                        checked = permissions.calls,
                        onChange = onCallsToggle,
                    )
                    PermissionRow(
                        icon = Icons.Filled.Notifications,
                        title = "Notifications",
                        subtitle = "Read and manage notifications",
                        checked = permissions.notifications,
                        onChange = onNotificationsToggle,
                    )
                    if (settings.notificationsEnabled && !permissions.notifications) {
                        Text(
                            "Notification access is still off. Tap here to open it. If the switch there is greyed out: " +
                                "open JARVIS in App info, tap the ⋮ menu and choose \"Allow restricted settings\".",
                            color = JarvisColors.Cyan,
                            fontSize = 12.sp,
                            lineHeight = 16.sp,
                            modifier = Modifier
                                .clickable(onClick = onOpenNotificationAccess)
                                .padding(start = 48.dp, bottom = 8.dp, end = 4.dp),
                        )
                    }
                    PermissionRow(
                        icon = Icons.Filled.Apps,
                        title = "Open Apps",
                        subtitle = "Open and control apps",
                        checked = permissions.openApps,
                        onChange = onOpenAppsToggle,
                    )
                }

                SettingsCard(Icons.Filled.PowerSettingsNew, "Always On") {
                    PermissionRow(
                        icon = Icons.Filled.RecordVoiceOver,
                        title = "Always on",
                        subtitle = "Keep JARVIS ready all the time",
                        checked = settings.alwaysOn,
                        onChange = onAlwaysOnToggle,
                    )
                    Text(
                        if (settings.alwaysOn) {
                            "JARVIS stays in your notifications: tap \"Talk\" from anywhere. You can also add the JARVIS " +
                                "tile to Quick Settings (swipe down, tap the pencil). After each answer JARVIS keeps " +
                                "listening; just stay quiet to stop."
                        } else {
                            "Turn on to talk to JARVIS from the notification or Quick Settings, and to keep the " +
                                "conversation going without tapping the mic each time."
                        },
                        color = JarvisColors.TextHint,
                        fontSize = 12.sp,
                        lineHeight = 16.sp,
                        modifier = Modifier.padding(start = 48.dp, end = 4.dp),
                    )
                    if (settings.alwaysOn) {
                        Text(
                            "Phone closes JARVIS by itself? Tap here and allow it to run in the background.",
                            color = JarvisColors.Cyan,
                            fontSize = 12.sp,
                            lineHeight = 16.sp,
                            modifier = Modifier
                                .clickable(onClick = onOpenBatterySettings)
                                .padding(start = 48.dp, top = 8.dp, bottom = 4.dp, end = 4.dp),
                        )
                    }
                }

                SettingsCard(Icons.Filled.Palette, "Appearance") {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(12.dp))
                            .clickable { onMessage("JARVIS is dark only for now") }
                            .padding(vertical = 4.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        MiniOrb(Modifier.size(40.dp))
                        Spacer(Modifier.width(12.dp))
                        Column(Modifier.weight(1f)) {
                            Text("Theme", color = Color.White, fontSize = 16.sp)
                            Text("Dark (Default)", color = JarvisColors.TextSecondary, fontSize = 13.sp)
                        }
                        Icon(
                            Icons.AutoMirrored.Filled.KeyboardArrowRight,
                            contentDescription = null,
                            tint = JarvisColors.TextSecondary,
                        )
                    }
                }

                Text(
                    "JARVIS by Imran  ·  v${appVersion(LocalContext.current)}",
                    color = JarvisColors.TextHint,
                    fontSize = 12.sp,
                    modifier = Modifier.align(Alignment.CenterHorizontally).padding(vertical = 8.dp),
                )
            }
        }
    }
}

// ------------------------------------------------------------------------------------------------
// Cards
// ------------------------------------------------------------------------------------------------

@Composable
private fun ModelCard(
    provider: AiProvider,
    model: String,
    onModel: (String) -> Unit,
) {
    SettingsCard(Icons.Filled.Psychology, "AI Model") {
        var menuOpen by remember { mutableStateOf(false) }
        // Show what is really used: the built-in default unless the user chose something else.
        var text by remember(provider) { mutableStateOf(model.ifBlank { AiModels.defaultFor(provider) }) }

        Text("${provider.displayName} model", color = JarvisColors.TextSecondary, fontSize = 13.sp)
        Spacer(Modifier.height(6.dp))
        Box {
            JarvisTextField(
                value = text,
                onValueChange = {
                    text = it
                    onModel(if (it.trim() == AiModels.defaultFor(provider)) "" else it)
                },
                placeholder = AiModels.defaultFor(provider),
                trailing = {
                    IconButton(onClick = { menuOpen = true }) {
                        Icon(Icons.Filled.ArrowDropDown, contentDescription = "Pick a model", tint = JarvisColors.TextSecondary)
                    }
                },
            )
            DropdownMenu(
                expanded = menuOpen,
                onDismissRequest = { menuOpen = false },
                containerColor = JarvisColors.CardHigh,
            ) {
                AiModels.presetsFor(provider).forEach { preset ->
                    DropdownMenuItem(
                        text = { Text(preset.label, fontSize = 14.sp) },
                        onClick = {
                            menuOpen = false
                            text = preset.id
                            onModel(if (preset.id == AiModels.defaultFor(provider)) "" else preset.id)
                        },
                    )
                }
            }
        }
        Spacer(Modifier.height(6.dp))
        Text(
            "Fast models answer quickly and cost very little. You can also type any model name.",
            color = JarvisColors.TextHint,
            fontSize = 12.sp,
            lineHeight = 16.sp,
        )
    }
}

@Composable
private fun ApiKeyCard(
    provider: AiProvider,
    onProvider: (AiProvider) -> Unit,
    loadApiKey: suspend (AiProvider) -> String,
    onSave: (AiProvider, String) -> Unit,
) {
    SettingsCard(Icons.Filled.Key, "API Key") {
        Text("AI provider", color = JarvisColors.TextSecondary, fontSize = 13.sp)
        Spacer(Modifier.height(2.dp))
        RadioRow(
            options = AiProvider.entries,
            label = { it.displayName },
            selected = provider,
            onSelect = onProvider,
        )
        Spacer(Modifier.height(10.dp))

        var key by remember(provider) { mutableStateOf("") }
        var visible by remember { mutableStateOf(false) }
        var saved by remember(provider) { mutableStateOf(false) }

        // Each provider has its own key; load the one that belongs to the chosen provider.
        LaunchedEffect(provider) {
            val stored = loadApiKey(provider)
            key = stored
            saved = stored.isNotBlank()
        }

        Text(
            "Your ${provider.displayName} API key",
            color = JarvisColors.TextSecondary,
            fontSize = 13.sp,
        )
        Spacer(Modifier.height(6.dp))
        JarvisTextField(
            value = key,
            onValueChange = { key = it },
            placeholder = "Enter your API key here...",
            visualTransformation = if (visible) VisualTransformation.None else PasswordVisualTransformation(),
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password, autoCorrectEnabled = false),
            trailing = {
                IconButton(onClick = { visible = !visible }) {
                    Icon(
                        imageVector = if (visible) Icons.Filled.Visibility else Icons.Filled.VisibilityOff,
                        contentDescription = if (visible) "Hide key" else "Show key",
                        tint = JarvisColors.TextSecondary,
                    )
                }
            },
        )
        Spacer(Modifier.height(12.dp))
        GradientButton(text = "Save API Key") {
            onSave(provider, key)
            saved = key.isNotBlank()
        }
        if (saved) {
            Spacer(Modifier.height(8.dp))
            Text(
                "✓ Saved on this phone, encrypted",
                color = JarvisColors.GreenCall,
                fontSize = 12.sp,
            )
        }
    }
}

// ------------------------------------------------------------------------------------------------
// Building blocks
// ------------------------------------------------------------------------------------------------

@Composable
private fun SettingsCard(icon: ImageVector, title: String, content: @Composable () -> Unit) {
    Surface(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(18.dp),
        color = JarvisColors.Card,
        border = BorderStroke(1.dp, JarvisColors.Border),
    ) {
        Column(Modifier.padding(16.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(icon, contentDescription = null, tint = JarvisColors.Cyan, modifier = Modifier.size(22.dp))
                Spacer(Modifier.width(10.dp))
                Text(title, color = Color.White, fontSize = 18.sp, fontWeight = FontWeight.SemiBold)
            }
            Spacer(Modifier.height(12.dp))
            content()
        }
    }
}

@Composable
private fun <T> RadioRow(options: List<T>, label: (T) -> String, selected: T, onSelect: (T) -> Unit) {
    Row(Modifier.fillMaxWidth()) {
        options.forEach { option ->
            Row(
                modifier = Modifier
                    .weight(1f)
                    .clip(RoundedCornerShape(10.dp))
                    .clickable { onSelect(option) }
                    .padding(vertical = 4.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                RadioButton(
                    selected = option == selected,
                    onClick = null,
                    colors = RadioButtonDefaults.colors(
                        selectedColor = JarvisColors.Cyan,
                        unselectedColor = Color(0xFF55708C),
                    ),
                    modifier = Modifier.padding(horizontal = 8.dp),
                )
                Text(label(option), color = JarvisColors.TextPrimary, fontSize = 16.sp)
            }
        }
    }
}

@Composable
private fun PermissionRow(
    icon: ImageVector,
    title: String,
    subtitle: String,
    checked: Boolean,
    onChange: (Boolean) -> Unit,
) {
    Row(
        modifier = Modifier.fillMaxWidth().padding(vertical = 6.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(
            modifier = Modifier
                .size(38.dp)
                .clip(RoundedCornerShape(10.dp))
                .background(Color(0xFF0E2542)),
            contentAlignment = Alignment.Center,
        ) {
            Icon(icon, contentDescription = null, tint = Color(0xFF4DA3FF), modifier = Modifier.size(22.dp))
        }
        Spacer(Modifier.width(12.dp))
        Column(Modifier.weight(1f)) {
            Text(title, color = Color.White, fontSize = 16.sp)
            Text(subtitle, color = JarvisColors.TextSecondary, fontSize = 13.sp)
        }
        Switch(
            checked = checked,
            onCheckedChange = onChange,
            colors = SwitchDefaults.colors(
                checkedThumbColor = Color.White,
                checkedTrackColor = JarvisColors.Blue,
                checkedBorderColor = JarvisColors.Blue,
                uncheckedThumbColor = Color(0xFF7F97B2),
                uncheckedTrackColor = Color(0xFF10223A),
                uncheckedBorderColor = JarvisColors.Border,
            ),
        )
    }
}

@Composable
private fun JarvisTextField(
    value: String,
    onValueChange: (String) -> Unit,
    placeholder: String,
    modifier: Modifier = Modifier,
    visualTransformation: VisualTransformation = VisualTransformation.None,
    keyboardOptions: KeyboardOptions = KeyboardOptions.Default,
    trailing: (@Composable () -> Unit)? = null,
) {
    val shape = RoundedCornerShape(12.dp)
    BasicTextField(
        value = value,
        onValueChange = onValueChange,
        singleLine = true,
        textStyle = TextStyle(color = JarvisColors.TextPrimary, fontSize = 15.sp),
        cursorBrush = SolidColor(JarvisColors.Cyan),
        visualTransformation = visualTransformation,
        keyboardOptions = keyboardOptions,
        modifier = modifier.fillMaxWidth(),
        decorationBox = { inner ->
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(52.dp)
                    .clip(shape)
                    .background(Color(0xFF07101E))
                    .border(1.dp, JarvisColors.Border, shape)
                    .padding(start = 14.dp, end = 4.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Box(Modifier.weight(1f)) {
                    if (value.isEmpty()) Text(placeholder, color = JarvisColors.TextHint, fontSize = 15.sp, maxLines = 1)
                    inner()
                }
                trailing?.invoke()
            }
        },
    )
}

@Composable
private fun GradientButton(text: String, onClick: () -> Unit) {
    val shape = RoundedCornerShape(14.dp)
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .height(50.dp)
            .clip(shape)
            .background(Brush.horizontalGradient(listOf(Color(0xFF0B4DA8), Color(0xFF1A7FE8))))
            .border(1.dp, Color(0x552FA8FF), shape)
            .clickable(onClick = onClick),
        contentAlignment = Alignment.Center,
    ) {
        Text(text, color = Color.White, fontSize = 16.sp, fontWeight = FontWeight.Medium)
    }
}

private fun appVersion(context: Context): String = try {
    context.packageManager.getPackageInfo(context.packageName, 0).versionName ?: "1.0"
} catch (_: Exception) {
    "1.0"
}

package com.alarmhandler.app.ui.settings

import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.asPaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBars
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBars
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.alarmhandler.app.R
import com.alarmhandler.app.data.backup.BackupManager
import com.alarmhandler.app.data.model.Alarm
import com.alarmhandler.app.data.model.AlarmSound
import com.alarmhandler.app.data.prefs.AppSettings
import com.alarmhandler.app.data.prefs.ClockFormat
import com.alarmhandler.app.data.prefs.ThemeMode
import com.alarmhandler.app.ui.NavResults
import com.alarmhandler.app.ui.components.PermissionStatusRow
import com.alarmhandler.app.ui.components.PermissionWarnings
import com.alarmhandler.app.ui.components.PixelButton
import com.alarmhandler.app.ui.components.PixelChip
import com.alarmhandler.app.ui.components.PixelOutlineButton
import com.alarmhandler.app.ui.components.PixelSectionHeader
import com.alarmhandler.app.ui.components.PixelSurface
import com.alarmhandler.app.ui.components.PixelTopBar
import com.alarmhandler.app.ui.components.rememberAlarmPermissionState
import com.alarmhandler.app.util.AlarmPermissionIssue
import com.alarmhandler.app.util.AlarmPermissions
import com.alarmhandler.app.util.TimeFormat
import java.time.DayOfWeek

@Composable
fun SettingsScreen(
    settings: AppSettings,
    savedStateHandle: SavedStateHandle,
    onBack: () -> Unit,
    onOpenAbout: () -> Unit,
    onOpenSound: (String) -> Unit,
    viewModel: SettingsViewModel = viewModel(factory = SettingsViewModel.Factory),
) {
    val context = LocalContext.current
    val message by viewModel.message.collectAsStateWithLifecycle()
    val snackbarHost = remember { SnackbarHostState() }
    val permissions = rememberAlarmPermissionState()
    var restoreSettingsToo by remember { mutableStateOf(true) }

    val soundResult by savedStateHandle.getStateFlow<String?>(NavResults.SOUND_ID, null)
        .collectAsStateWithLifecycle()
    LaunchedEffect(soundResult) {
        soundResult?.let {
            viewModel.setDefaultSound(it)
            savedStateHandle[NavResults.SOUND_ID] = null
        }
    }

    LaunchedEffect(message) {
        val text = message ?: return@LaunchedEffect
        snackbarHost.showSnackbar(text)
        viewModel.clearMessage()
    }

    val exportLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.CreateDocument("application/json")
    ) { uri -> uri?.let(viewModel::exportTo) }

    val importLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.OpenDocument()
    ) { uri -> uri?.let { viewModel.importFrom(it, restoreSettingsToo) } }

    Scaffold(
        containerColor = MaterialTheme.colorScheme.background,
        snackbarHost = { SnackbarHost(snackbarHost) },
        contentWindowInsets = WindowInsets(0, 0, 0, 0),
    ) { inner ->
        Column(
            Modifier
                .fillMaxSize()
                .padding(inner)
                .padding(top = WindowInsets.statusBars.asPaddingValues().calculateTopPadding())
                .verticalScroll(rememberScrollState())
                .padding(
                    bottom = 24.dp + WindowInsets.navigationBars.asPaddingValues()
                        .calculateBottomPadding()
                )
        ) {
            PixelTopBar(title = stringResource(R.string.settings), onBack = onBack)

            if (!permissions.allGood) {
                PermissionWarnings(
                    state = permissions,
                    dismissible = false,
                    modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp),
                )
            }

            Section(stringResource(R.string.theme)) {
                ChipRow(
                    options = ThemeMode.entries,
                    selected = settings.themeMode,
                    label = {
                        when (it) {
                            ThemeMode.LIGHT -> stringResource(R.string.theme_light)
                            ThemeMode.DARK -> stringResource(R.string.theme_dark)
                            ThemeMode.SYSTEM -> stringResource(R.string.theme_system)
                        }
                    },
                    onSelected = viewModel::setTheme,
                )
                ToggleRow(
                    label = "Pixel-art style",
                    description = "Square corners, hard shadows and chunky borders.",
                    checked = settings.pixelTheme,
                    onCheckedChange = viewModel::setPixelTheme,
                )
                ToggleRow(
                    label = stringResource(R.string.reduced_motion),
                    description = stringResource(R.string.reduced_motion_summary),
                    checked = settings.reducedMotion,
                    onCheckedChange = viewModel::setReducedMotion,
                )
            }

            Section(stringResource(R.string.clock_format)) {
                ChipRow(
                    options = ClockFormat.entries,
                    selected = settings.clockFormat,
                    label = {
                        when (it) {
                            ClockFormat.SYSTEM -> stringResource(R.string.theme_system)
                            ClockFormat.H12 -> stringResource(R.string.format_12h)
                            ClockFormat.H24 -> stringResource(R.string.format_24h)
                        }
                    },
                    onSelected = viewModel::setClockFormat,
                )
                Spacer(Modifier.height(8.dp))
                Text(
                    text = "Right now: " + TimeFormat.timeWithMeridiem(
                        hour = 19,
                        minute = 5,
                        use24Hour = TimeFormat.use24Hour(context, settings.clockFormat),
                    ) + " style",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }

            Section(stringResource(R.string.week_start)) {
                ChipRow(
                    options = listOf(DayOfWeek.MONDAY, DayOfWeek.SATURDAY, DayOfWeek.SUNDAY),
                    selected = settings.weekStart,
                    label = { TimeFormat.dayShort(it) },
                    onSelected = viewModel::setWeekStart,
                )
            }

            Section("Defaults for new alarms") {
                Text(
                    text = stringResource(R.string.snooze_duration),
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurface,
                )
                Spacer(Modifier.height(8.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    Alarm.SNOOZE_OPTIONS.forEach { minutes ->
                        PixelChip(
                            label = "$minutes",
                            selected = settings.defaultSnoozeMinutes == minutes,
                            onClick = { viewModel.setDefaultSnooze(minutes) },
                            modifier = Modifier.weight(1f),
                        )
                    }
                }
                Spacer(Modifier.height(14.dp))
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Column(Modifier.weight(1f)) {
                        Text(
                            text = stringResource(R.string.sound),
                            style = MaterialTheme.typography.bodyLarge,
                            color = MaterialTheme.colorScheme.onSurface,
                        )
                        Text(
                            text = AlarmSound.displayName(context, settings.defaultSoundId),
                            style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                    Spacer(Modifier.width(12.dp))
                    PixelOutlineButton(
                        text = "Change",
                        onClick = { onOpenSound(settings.defaultSoundId) },
                        modifier = Modifier.width(120.dp),
                    )
                }
                ToggleRow(
                    label = stringResource(R.string.vibration),
                    description = null,
                    checked = settings.defaultVibrate,
                    onCheckedChange = viewModel::setDefaultVibrate,
                )
                ToggleRow(
                    label = stringResource(R.string.gradual_volume),
                    description = null,
                    checked = settings.defaultGradualVolume,
                    onCheckedChange = viewModel::setDefaultGradual,
                )
            }

            Section("Ringing") {
                Text(
                    text = "Stop ringing after",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurface,
                )
                Spacer(Modifier.height(8.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    listOf(2, 5, 10, 20, 30).forEach { minutes ->
                        PixelChip(
                            label = "${minutes}m",
                            selected = settings.autoSilenceMinutes == minutes,
                            onClick = { viewModel.setAutoSilence(minutes) },
                            modifier = Modifier.weight(1f),
                        )
                    }
                }
                Spacer(Modifier.height(6.dp))
                Text(
                    text = "An alarm nobody answers stops after this long and is " +
                        "recorded as missed.",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                Spacer(Modifier.height(14.dp))
                PixelButton(
                    text = stringResource(R.string.test_alarm),
                    onClick = viewModel::testAlarm,
                    modifier = Modifier.fillMaxWidth(),
                    minHeight = 56,
                )
            }

            Section("Permissions") {
                PermissionStatusRow(
                    label = "Notifications",
                    granted = permissions.notificationsGranted,
                    onFix = {
                        openSystemScreen(context, AlarmPermissionIssue.NOTIFICATIONS)
                    },
                )
                PermissionStatusRow(
                    label = "Exact alarms",
                    granted = permissions.exactAlarmsGranted,
                    onFix = { openSystemScreen(context, AlarmPermissionIssue.EXACT_ALARMS) },
                )
                PermissionStatusRow(
                    label = "Full-screen alarms",
                    granted = permissions.fullScreenIntentGranted,
                    onFix = { openSystemScreen(context, AlarmPermissionIssue.FULL_SCREEN) },
                )
                PermissionStatusRow(
                    label = "Ignoring battery optimisation",
                    granted = permissions.ignoringBatteryOptimisations,
                    onFix = { openSystemScreen(context, AlarmPermissionIssue.BATTERY) },
                )
            }

            Section("Backup") {
                PixelButton(
                    text = stringResource(R.string.backup),
                    onClick = {
                        runCatching {
                            exportLauncher.launch(BackupManager.suggestedFileName())
                        }
                    },
                    modifier = Modifier.fillMaxWidth(),
                    minHeight = 56,
                )
                Spacer(Modifier.height(10.dp))
                ToggleRow(
                    label = "Also restore settings",
                    description = "When off, a restore replaces only your alarms.",
                    checked = restoreSettingsToo,
                    onCheckedChange = { restoreSettingsToo = it },
                )
                PixelOutlineButton(
                    text = stringResource(R.string.restore),
                    onClick = {
                        runCatching {
                            importLauncher.launch(arrayOf("application/json", "text/plain", "*/*"))
                        }
                    },
                    modifier = Modifier.fillMaxWidth(),
                )
                Spacer(Modifier.height(6.dp))
                Text(
                    text = "Restoring replaces every alarm currently on this phone.",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }

            Section("About") {
                PixelOutlineButton(
                    text = stringResource(R.string.about),
                    onClick = onOpenAbout,
                    modifier = Modifier.fillMaxWidth(),
                )
                Spacer(Modifier.height(10.dp))
                PixelOutlineButton(
                    text = stringResource(R.string.reset_settings),
                    onClick = viewModel::resetSettings,
                    modifier = Modifier.fillMaxWidth(),
                )
            }
        }
    }
}

private fun openSystemScreen(
    context: android.content.Context,
    issue: AlarmPermissionIssue,
) {
    AlarmPermissions.intentFor(context, issue)?.let { intent ->
        runCatching { context.startActivity(intent) }
    }
}

@Composable
private fun Section(title: String, content: @Composable () -> Unit) {
    Column(Modifier.padding(horizontal = 16.dp, vertical = 8.dp)) {
        PixelSectionHeader(title)
        PixelSurface(contentPadding = PaddingValues(16.dp)) { content() }
    }
}

@Composable
private fun <T> ChipRow(
    options: List<T>,
    selected: T,
    label: @Composable (T) -> String,
    onSelected: (T) -> Unit,
) {
    Row(
        Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        options.forEach { option ->
            PixelChip(
                label = label(option),
                selected = option == selected,
                onClick = { onSelected(option) },
                modifier = Modifier.weight(1f),
            )
        }
    }
}

@Composable
private fun ToggleRow(
    label: String,
    description: String?,
    checked: Boolean,
    onCheckedChange: (Boolean) -> Unit,
) {
    Row(
        Modifier
            .fillMaxWidth()
            .padding(vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Column(Modifier.weight(1f)) {
            Text(
                text = label,
                style = MaterialTheme.typography.bodyLarge,
                color = MaterialTheme.colorScheme.onSurface,
            )
            if (description != null) {
                Text(
                    text = description,
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }
        Spacer(Modifier.width(12.dp))
        Text(
            text = if (checked) "On" else "Off",
            style = MaterialTheme.typography.labelMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        Spacer(Modifier.width(8.dp))
        Switch(checked = checked, onCheckedChange = onCheckedChange)
    }
}

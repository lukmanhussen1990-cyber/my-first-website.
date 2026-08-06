package com.alarmhandler.app.ui.home

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.tween
import androidx.compose.animation.expandVertically
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.shrinkVertically
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.asPaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.navigationBars
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBars
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.DateRange
import androidx.compose.material.icons.filled.Info
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.SnackbarResult
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.alarmhandler.app.R
import com.alarmhandler.app.alarm.AlarmSchedule
import com.alarmhandler.app.data.prefs.AppSettings
import com.alarmhandler.app.ui.components.CityHeaderImage
import com.alarmhandler.app.ui.components.Mascot
import com.alarmhandler.app.ui.components.MascotMood
import com.alarmhandler.app.ui.components.PermissionWarnings
import com.alarmhandler.app.ui.components.PixelButton
import com.alarmhandler.app.ui.components.PixelSurface
import com.alarmhandler.app.ui.components.rememberAlarmPermissionState
import com.alarmhandler.app.util.AlarmPermissionIssue
import com.alarmhandler.app.util.TimeFormat

@Composable
fun HomeScreen(
    settings: AppSettings,
    onAddAlarm: () -> Unit,
    onEditAlarm: (Long) -> Unit,
    onOpenSettings: () -> Unit,
    onOpenHistory: () -> Unit,
    onOpenAbout: () -> Unit,
    viewModel: HomeViewModel = viewModel(factory = HomeViewModel.Factory),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val undo by viewModel.undo.collectAsStateWithLifecycle()
    val message by viewModel.message.collectAsStateWithLifecycle()
    val snackbarHost = remember { SnackbarHostState() }
    val context = LocalContext.current
    val permissions = rememberAlarmPermissionState()
    var dismissedIssues by remember { mutableStateOf(emptySet<AlarmPermissionIssue>()) }

    val use24Hour = TimeFormat.use24Hour(context, settings.clockFormat)
    val landscape = LocalConfiguration.current.screenWidthDp > LocalConfiguration.current.screenHeightDp

    LaunchedEffect(undo) {
        val pending = undo ?: return@LaunchedEffect
        val label = pending.alarm.label.ifBlank { "Alarm" }
        val result = snackbarHost.showSnackbar(
            message = "$label deleted",
            actionLabel = context.getString(R.string.undo),
        )
        if (result == SnackbarResult.ActionPerformed) {
            viewModel.restoreDeleted()
        } else {
            viewModel.clearUndo()
        }
    }

    LaunchedEffect(message) {
        val text = message ?: return@LaunchedEffect
        snackbarHost.showSnackbar(text)
        viewModel.clearMessage()
    }

    Scaffold(
        containerColor = MaterialTheme.colorScheme.background,
        snackbarHost = { SnackbarHost(snackbarHost) },
        contentWindowInsets = WindowInsets(0, 0, 0, 0),
    ) { inner ->
        Box(Modifier.fillMaxSize().padding(inner)) {
            LazyColumn(
                modifier = Modifier.fillMaxSize(),
                contentPadding = PaddingValues(
                    bottom = 120.dp + WindowInsets.navigationBars.asPaddingValues()
                        .calculateBottomPadding(),
                ),
            ) {
                item(key = "header") {
                    HomeHeader(
                        state = state,
                        onOpenSettings = onOpenSettings,
                        onOpenHistory = onOpenHistory,
                        onOpenAbout = onOpenAbout,
                        compact = landscape,
                    )
                }

                if (permissions.blockingIssues.any { it !in dismissedIssues }) {
                    item(key = "permissions") {
                        PermissionWarnings(
                            state = permissions,
                            hidden = dismissedIssues,
                            onDismissed = { dismissedIssues = dismissedIssues + it },
                            modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp),
                        )
                    }
                }

                item(key = "next") {
                    NextAlarmCard(
                        state = state,
                        use24Hour = use24Hour,
                        settings = settings,
                        modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp),
                    )
                }

                if (state.hasAlarms) {
                    item(key = "list_header") {
                        Text(
                            text = "YOUR ALARMS (${state.rows.size})",
                            style = MaterialTheme.typography.labelMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            modifier = Modifier.padding(start = 20.dp, top = 12.dp, bottom = 6.dp),
                        )
                    }
                }

                items(state.rows, key = { it.alarm.id }) { row ->
                    AlarmCard(
                        row = row,
                        use24Hour = use24Hour,
                        weekStart = settings.weekStart,
                        onToggle = { enabled -> viewModel.setEnabled(row.alarm, enabled) },
                        onClick = { onEditAlarm(row.alarm.id) },
                        onDelete = { viewModel.delete(row.alarm) },
                        onDuplicate = { viewModel.duplicate(row.alarm) },
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 16.dp, vertical = 6.dp)
                            .animateItem(),
                    )
                }

                if (state.loaded && !state.hasAlarms) {
                    item(key = "empty") { EmptyState(Modifier.padding(24.dp)) }
                }
            }

            PixelButton(
                text = stringResource(R.string.add_alarm),
                onClick = onAddAlarm,
                icon = Icons.Default.Add,
                minHeight = 64,
                modifier = Modifier
                    .align(Alignment.BottomCenter)
                    .padding(
                        start = 20.dp,
                        end = 20.dp,
                        bottom = 20.dp + WindowInsets.navigationBars.asPaddingValues()
                            .calculateBottomPadding(),
                    ),
            )
        }
    }
}

/** The wide city artwork, the mascot, and its line of dialogue. */
@Composable
private fun HomeHeader(
    state: HomeUiState,
    onOpenSettings: () -> Unit,
    onOpenHistory: () -> Unit,
    onOpenAbout: () -> Unit,
    compact: Boolean,
) {
    val mood = when {
        !state.loaded -> MascotMood.IDLE
        !state.hasAlarms -> MascotMood.SITTING
        !state.anyEnabled -> MascotMood.IDLE
        else -> MascotMood.SLEEPING
    }
    val greeting = when {
        !state.hasAlarms -> stringResource(R.string.mascot_greeting_none)
        !state.anyEnabled -> stringResource(R.string.alarms_off)
        state.nextAlarm != null -> stringResource(R.string.mascot_greeting_ready)
        else -> stringResource(R.string.mascot_greeting_set)
    }

    Column {
        Box(Modifier.fillMaxWidth()) {
            CityHeaderImage(
                modifier = Modifier
                    .fillMaxWidth()
                    .heightIn(min = if (compact) 90.dp else 130.dp)
            )
            Row(
                modifier = Modifier
                    .align(Alignment.TopEnd)
                    .padding(
                        top = WindowInsets.statusBars.asPaddingValues().calculateTopPadding() + 4.dp,
                        end = 4.dp,
                    ),
            ) {
                IconButton(onClick = onOpenHistory) {
                    Icon(
                        Icons.Default.DateRange,
                        contentDescription = stringResource(R.string.history),
                        tint = MaterialTheme.colorScheme.onBackground,
                    )
                }
                IconButton(onClick = onOpenAbout) {
                    Icon(
                        Icons.Default.Info,
                        contentDescription = stringResource(R.string.about),
                        tint = MaterialTheme.colorScheme.onBackground,
                    )
                }
                IconButton(onClick = onOpenSettings) {
                    Icon(
                        Icons.Default.Settings,
                        contentDescription = stringResource(R.string.settings),
                        tint = MaterialTheme.colorScheme.onBackground,
                    )
                }
            }
        }

        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(start = 16.dp, end = 16.dp, top = 12.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Mascot(
                mood = mood,
                contentDescription = stringResource(R.string.cd_mascot),
                modifier = Modifier.size(72.dp, 48.dp),
            )
            Spacer(Modifier.width(14.dp))
            Column(Modifier.weight(1f)) {
                Text(
                    text = stringResource(R.string.app_name),
                    style = MaterialTheme.typography.headlineMedium,
                    color = MaterialTheme.colorScheme.onBackground,
                )
                Text(
                    text = greeting,
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }
    }
}

@Composable
private fun NextAlarmCard(
    state: HomeUiState,
    use24Hour: Boolean,
    settings: AppSettings,
    modifier: Modifier = Modifier,
) {
    val next = state.nextAlarm
    PixelSurface(
        modifier = modifier,
        color = if (next != null) {
            MaterialTheme.colorScheme.primary
        } else {
            MaterialTheme.colorScheme.surfaceVariant
        },
        contentPadding = PaddingValues(20.dp),
    ) {
        val onColor = if (next != null) {
            MaterialTheme.colorScheme.onPrimary
        } else {
            MaterialTheme.colorScheme.onSurfaceVariant
        }
        Text(
            text = stringResource(R.string.next_alarm).uppercase(),
            style = MaterialTheme.typography.labelMedium,
            color = onColor,
        )
        Spacer(Modifier.height(8.dp))
        if (next?.nextTriggerMillis == null) {
            Text(
                text = if (state.hasAlarms) {
                    stringResource(R.string.alarms_off)
                } else {
                    stringResource(R.string.no_alarms_title)
                },
                style = MaterialTheme.typography.titleLarge,
                color = onColor,
            )
        } else {
            val trigger = next.nextTriggerMillis
            Row(verticalAlignment = Alignment.Bottom) {
                Text(
                    text = TimeFormat.time(next.alarm.hour, next.alarm.minute, use24Hour),
                    style = MaterialTheme.typography.displayMedium,
                    color = onColor,
                )
                val suffix = TimeFormat.meridiem(next.alarm.hour, use24Hour)
                if (suffix.isNotEmpty()) {
                    Spacer(Modifier.width(8.dp))
                    Text(
                        text = suffix,
                        style = MaterialTheme.typography.titleLarge,
                        color = onColor,
                        modifier = Modifier.padding(bottom = 6.dp),
                    )
                }
            }
            Spacer(Modifier.height(4.dp))
            Text(
                text = buildString {
                    append(TimeFormat.relativeDay(trigger))
                    append(" · in ")
                    append(AlarmSchedule.formatCountdown(trigger - state.now))
                },
                style = MaterialTheme.typography.titleMedium,
                color = onColor,
            )
            if (next.alarm.label.isNotBlank()) {
                Spacer(Modifier.height(6.dp))
                Text(
                    text = next.alarm.label,
                    style = MaterialTheme.typography.bodyLarge,
                    color = onColor,
                )
            }
            Spacer(Modifier.height(4.dp))
            Text(
                text = TimeFormat.repeatSummary(next.alarm, settings.weekStart),
                style = MaterialTheme.typography.bodyMedium,
                color = onColor,
            )
        }
    }
}

@Composable
private fun EmptyState(modifier: Modifier = Modifier) {
    Column(
        modifier = modifier.fillMaxWidth(),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        Mascot(
            mood = MascotMood.SITTING,
            contentDescription = stringResource(R.string.cd_mascot),
            modifier = Modifier.size(168.dp, 112.dp),
        )
        Spacer(Modifier.height(16.dp))
        Text(
            text = stringResource(R.string.no_alarms_title),
            style = MaterialTheme.typography.titleLarge,
            color = MaterialTheme.colorScheme.onBackground,
        )
        Spacer(Modifier.height(8.dp))
        Text(
            text = stringResource(R.string.no_alarms_body),
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
    }
}

/** Kept separate so the list item animation reads clearly at the call site. */
@Composable
fun AnimatedRow(visible: Boolean, content: @Composable () -> Unit) {
    AnimatedVisibility(
        visible = visible,
        enter = expandVertically(tween(180)) + fadeIn(tween(180)),
        exit = shrinkVertically(tween(160)) + fadeOut(tween(160)),
    ) { content() }
}

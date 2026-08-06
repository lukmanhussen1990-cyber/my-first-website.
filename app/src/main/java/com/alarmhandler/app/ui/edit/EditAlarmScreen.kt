package com.alarmhandler.app.ui.edit

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
import androidx.compose.foundation.layout.navigationBars
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBars
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Slider
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.alarmhandler.app.R
import com.alarmhandler.app.data.model.Alarm
import com.alarmhandler.app.data.model.AlarmSound
import com.alarmhandler.app.data.model.DismissChallenge
import com.alarmhandler.app.data.prefs.AppSettings
import com.alarmhandler.app.ui.NavResults
import com.alarmhandler.app.ui.components.Mascot
import com.alarmhandler.app.ui.components.MascotMood
import com.alarmhandler.app.ui.components.PixelButton
import com.alarmhandler.app.ui.components.PixelChip
import com.alarmhandler.app.ui.components.PixelOutlineButton
import com.alarmhandler.app.ui.components.PixelSectionHeader
import com.alarmhandler.app.ui.components.PixelSurface
import com.alarmhandler.app.ui.components.PixelTopBar
import com.alarmhandler.app.util.TimeFormat

@Composable
fun EditAlarmScreen(
    alarmId: Long,
    settings: AppSettings,
    savedStateHandle: SavedStateHandle,
    onBack: () -> Unit,
    onPickSound: (String) -> Unit,
    onPickChallenge: (DismissChallenge, Int) -> Unit,
    viewModel: EditAlarmViewModel = viewModel(factory = EditAlarmViewModel.factory(alarmId)),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val context = LocalContext.current
    val use24Hour = TimeFormat.use24Hour(context, settings.clockFormat)

    // Results handed back by the sound and challenge pickers.
    val soundResult by savedStateHandle.getStateFlow<String?>(NavResults.SOUND_ID, null)
        .collectAsStateWithLifecycle()
    val challengeResult by savedStateHandle.getStateFlow<String?>(NavResults.CHALLENGE_ID, null)
        .collectAsStateWithLifecycle()
    val strengthResult by savedStateHandle.getStateFlow(NavResults.CHALLENGE_STRENGTH, 3)
        .collectAsStateWithLifecycle()

    LaunchedEffect(soundResult) {
        soundResult?.let {
            viewModel.setSound(it)
            savedStateHandle[NavResults.SOUND_ID] = null
        }
    }
    LaunchedEffect(challengeResult, strengthResult) {
        challengeResult?.let {
            viewModel.setChallenge(DismissChallenge.fromId(it), strengthResult)
            savedStateHandle[NavResults.CHALLENGE_ID] = null
        }
    }

    LaunchedEffect(state.saved) {
        if (state.saved) onBack()
    }

    val draft = state.draft
    val bottomInset = WindowInsets.navigationBars.asPaddingValues().calculateBottomPadding()

    Box(Modifier.fillMaxSize()) {
        Column(
            Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(
                    top = WindowInsets.statusBars.asPaddingValues().calculateTopPadding(),
                    bottom = 108.dp + bottomInset,
                )
        ) {
            PixelTopBar(
                title = if (state.isNew) {
                    stringResource(R.string.new_alarm)
                } else {
                    stringResource(R.string.edit_alarm)
                },
                onBack = onBack,
            )

            TimePickerBlock(
                hour = draft.hour,
                minute = draft.minute,
                use24Hour = use24Hour,
                onNudgeHour = viewModel::nudgeHour,
                onNudgeMinute = viewModel::nudgeMinute,
                onToggleMeridiem = viewModel::toggleMeridiem,
                onSetTime = viewModel::setTime,
                modifier = Modifier.padding(horizontal = 16.dp),
            )

            state.previewTriggerMillis?.let { trigger ->
                Text(
                    text = "Rings ${TimeFormat.relativeDay(trigger).lowercase()} at " +
                        TimeFormat.instant(trigger, use24Hour),
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.padding(horizontal = 20.dp, vertical = 8.dp),
                )
            }

            state.error?.let { error ->
                PixelSurface(
                    modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp),
                    color = MaterialTheme.colorScheme.error,
                ) {
                    Text(
                        text = error,
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onError,
                    )
                }
            }

            Section(stringResource(R.string.alarm_name)) {
                OutlinedTextField(
                    value = draft.label,
                    onValueChange = viewModel::setLabel,
                    placeholder = { Text(stringResource(R.string.alarm_name_hint)) },
                    singleLine = true,
                    shape = MaterialTheme.shapes.small,
                    keyboardOptions = KeyboardOptions(imeAction = ImeAction.Done),
                    supportingText = {
                        Text("${draft.label.length} / ${Alarm.MAX_LABEL_LENGTH}")
                    },
                    modifier = Modifier.fillMaxWidth(),
                )
            }

            Section(stringResource(R.string.repeat)) {
                Row(
                    horizontalArrangement = Arrangement.spacedBy(6.dp),
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    settings.orderedWeek.forEach { day ->
                        PixelChip(
                            label = TimeFormat.dayInitial(day),
                            selected = draft.isRepeatingOn(day),
                            onClick = { viewModel.toggleDay(day) },
                            modifier = Modifier
                                .weight(1f)
                                .semantics {
                                    contentDescription = TimeFormat.dayFull(day) +
                                        if (draft.isRepeatingOn(day)) ", repeating" else ", off"
                                },
                        )
                    }
                }
                Spacer(Modifier.height(10.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    PixelChip(
                        label = stringResource(R.string.repeat_once),
                        selected = draft.repeatMask == 0,
                        onClick = { viewModel.setRepeatMask(0) },
                    )
                    PixelChip(
                        label = stringResource(R.string.repeat_weekdays),
                        selected = draft.repeatMask == Alarm.WEEKDAY_MASK,
                        onClick = { viewModel.setRepeatMask(Alarm.WEEKDAY_MASK) },
                    )
                    PixelChip(
                        label = stringResource(R.string.repeat_every_day),
                        selected = draft.repeatMask == Alarm.ALL_DAYS_MASK,
                        onClick = { viewModel.setRepeatMask(Alarm.ALL_DAYS_MASK) },
                    )
                }
            }

            Section(stringResource(R.string.sound)) {
                RowAction(
                    title = AlarmSound.displayName(context, draft.soundId),
                    subtitle = "Tap to choose a different sound",
                    onClick = { onPickSound(draft.soundId) },
                )
                Spacer(Modifier.height(14.dp))
                Text(
                    text = "${stringResource(R.string.volume)}: ${draft.volumePercent}%",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurface,
                )
                Slider(
                    value = draft.volumePercent.toFloat(),
                    onValueChange = { viewModel.setVolume(it.toInt()) },
                    valueRange = Alarm.MIN_VOLUME.toFloat()..100f,
                    modifier = Modifier
                        .fillMaxWidth()
                        .semantics {
                            contentDescription = "Alarm volume, ${draft.volumePercent} percent"
                        },
                )
                ToggleRow(
                    label = stringResource(R.string.vibration),
                    checked = draft.vibrate,
                    onCheckedChange = viewModel::setVibrate,
                )
                ToggleRow(
                    label = stringResource(R.string.gradual_volume),
                    checked = draft.gradualVolume,
                    onCheckedChange = viewModel::setGradualVolume,
                )
            }

            Section(stringResource(R.string.snooze)) {
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
                            selected = draft.snoozeMinutes == minutes,
                            onClick = { viewModel.setSnoozeMinutes(minutes) },
                            modifier = Modifier.weight(1f),
                        )
                    }
                }
                Spacer(Modifier.height(14.dp))
                Text(
                    text = stringResource(R.string.snooze_limit),
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurface,
                )
                Spacer(Modifier.height(8.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    listOf(0, 1, 2, 3, 5).forEach { count ->
                        PixelChip(
                            label = if (count == 0) "∞" else "$count",
                            selected = draft.maxSnoozeCount == count,
                            onClick = { viewModel.setMaxSnoozes(count) },
                            modifier = Modifier.weight(1f),
                        )
                    }
                }
                Spacer(Modifier.height(6.dp))
                Text(
                    text = if (draft.maxSnoozeCount == 0) {
                        stringResource(R.string.snooze_unlimited)
                    } else {
                        "Up to ${draft.maxSnoozeCount} snoozes per alarm"
                    },
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }

            Section(stringResource(R.string.dismiss_challenge)) {
                RowAction(
                    title = challengeName(draft.challenge),
                    subtitle = challengeSummary(draft),
                    onClick = { onPickChallenge(draft.challenge, draft.challengeStrength) },
                )
                Spacer(Modifier.height(14.dp))
                Text(
                    text = stringResource(R.string.safety_dismiss),
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurface,
                )
                Spacer(Modifier.height(8.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    listOf(0, 30, 60, 120, 300).forEach { seconds ->
                        PixelChip(
                            label = if (seconds == 0) "Off" else "${seconds / 60}m".takeIf {
                                seconds >= 60
                            } ?: "${seconds}s",
                            selected = draft.safetyDismissSeconds == seconds,
                            onClick = { viewModel.setSafetyDismissSeconds(seconds) },
                            modifier = Modifier.weight(1f),
                        )
                    }
                }
                Spacer(Modifier.height(6.dp))
                Text(
                    text = if (draft.safetyDismissSeconds == 0) {
                        stringResource(R.string.safety_dismiss_off)
                    } else {
                        "After ${draft.safetyDismissSeconds} seconds a plain Dismiss button " +
                            "always appears."
                    },
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }

            if (!state.isNew) {
                Spacer(Modifier.height(12.dp))
                PixelOutlineButton(
                    text = stringResource(R.string.delete),
                    onClick = { viewModel.delete(onBack) },
                    icon = Icons.Default.Delete,
                    modifier = Modifier.padding(horizontal = 16.dp),
                )
            }
        }

        // The save bar floats so it is reachable no matter how long the form is.
        Row(
            Modifier
                .align(Alignment.BottomCenter)
                .fillMaxWidth()
                .padding(start = 16.dp, end = 16.dp, bottom = 16.dp + bottomInset),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Mascot(
                mood = MascotMood.WAVING,
                contentDescription = null,
                modifier = Modifier.size(60.dp, 40.dp),
            )
            Spacer(Modifier.width(12.dp))
            PixelButton(
                text = stringResource(R.string.save),
                onClick = viewModel::save,
                modifier = Modifier.weight(1f),
                minHeight = 60,
            )
        }
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
private fun RowAction(title: String, subtitle: String, onClick: () -> Unit) {
    Row(
        Modifier.fillMaxWidth(),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Column(Modifier.weight(1f)) {
            Text(
                text = title,
                style = MaterialTheme.typography.titleMedium,
                color = MaterialTheme.colorScheme.onSurface,
            )
            Text(
                text = subtitle,
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
        Spacer(Modifier.width(12.dp))
        PixelOutlineButton(
            text = "Change",
            onClick = onClick,
            modifier = Modifier.width(120.dp),
        )
    }
}

@Composable
private fun ToggleRow(label: String, checked: Boolean, onCheckedChange: (Boolean) -> Unit) {
    Row(
        Modifier
            .fillMaxWidth()
            .padding(vertical = 6.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            text = label,
            style = MaterialTheme.typography.bodyLarge,
            color = MaterialTheme.colorScheme.onSurface,
            modifier = Modifier.weight(1f),
        )
        Text(
            text = if (checked) "On" else "Off",
            style = MaterialTheme.typography.labelMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        Spacer(Modifier.width(10.dp))
        Switch(checked = checked, onCheckedChange = onCheckedChange)
    }
}

@Composable
internal fun challengeName(challenge: DismissChallenge): String = stringResource(
    when (challenge) {
        DismissChallenge.TAP -> R.string.challenge_tap
        DismissChallenge.HOLD -> R.string.challenge_hold
        DismissChallenge.MATH -> R.string.challenge_math
        DismissChallenge.TAP_MASCOT -> R.string.challenge_mascot
        DismissChallenge.MEMORY -> R.string.challenge_memory
        DismissChallenge.SHAKE -> R.string.challenge_shake
    }
)

private fun challengeSummary(alarm: Alarm): String = when (alarm.challenge) {
    DismissChallenge.TAP -> "One tap stops the alarm"
    DismissChallenge.HOLD -> "Press and hold for three seconds"
    DismissChallenge.MATH -> "Answer one arithmetic question"
    DismissChallenge.TAP_MASCOT -> "Tap the mascot ${alarm.challengeStrength} times"
    DismissChallenge.MEMORY -> "Repeat a ${alarm.challengeStrength}-step pattern"
    DismissChallenge.SHAKE -> "Shake the phone ${alarm.challengeStrength} times"
}

package com.alarmhandler.app.ui.edit

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.CreationExtras
import com.alarmhandler.app.alarm.AlarmSchedule
import com.alarmhandler.app.data.ServiceLocator
import com.alarmhandler.app.data.model.Alarm
import com.alarmhandler.app.data.model.DismissChallenge
import com.alarmhandler.app.data.prefs.SettingsRepository
import com.alarmhandler.app.data.repo.AlarmRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.time.DayOfWeek
import java.time.ZonedDateTime

data class EditUiState(
    val draft: Alarm = Alarm(),
    val isNew: Boolean = true,
    val loaded: Boolean = false,
    val saved: Boolean = false,
    val error: String? = null,
) {
    /** Preview of when this draft would ring, shown live under the clock. */
    val previewTriggerMillis: Long?
        get() = AlarmSchedule.nextTriggerMillis(
            draft.copy(enabled = true, snoozeUntil = 0L),
            ZonedDateTime.now(),
            honorSnooze = false,
        )
}

class EditAlarmViewModel(
    private val alarmId: Long,
    private val alarms: AlarmRepository,
    private val settings: SettingsRepository,
) : ViewModel() {

    private val _state = MutableStateFlow(EditUiState())
    val state: StateFlow<EditUiState> = _state.asStateFlow()

    init {
        viewModelScope.launch {
            if (alarmId > 0L) {
                val existing = alarms.getById(alarmId)
                if (existing == null) {
                    _state.value = EditUiState(
                        loaded = true,
                        error = "That alarm no longer exists.",
                    )
                } else {
                    _state.value = EditUiState(draft = existing, isNew = false, loaded = true)
                }
            } else {
                // A new alarm inherits the user's defaults, and starts at the
                // next round hour so the common case needs no editing at all.
                val prefs = settings.current()
                val now = ZonedDateTime.now().plusHours(1)
                _state.value = EditUiState(
                    draft = Alarm(
                        hour = now.hour,
                        minute = 0,
                        snoozeMinutes = prefs.defaultSnoozeMinutes,
                        soundId = prefs.defaultSoundId,
                        vibrate = prefs.defaultVibrate,
                        gradualVolume = prefs.defaultGradualVolume,
                        volumePercent = prefs.defaultVolumePercent,
                        createdAt = System.currentTimeMillis(),
                    ),
                    isNew = true,
                    loaded = true,
                )
            }
        }
    }

    private fun edit(block: (Alarm) -> Alarm) {
        _state.value = _state.value.copy(draft = block(_state.value.draft), error = null)
    }

    fun setTime(hour: Int, minute: Int) = edit {
        it.copy(hour = hour.coerceIn(0, 23), minute = minute.coerceIn(0, 59))
    }

    fun nudgeHour(delta: Int) = edit {
        it.copy(hour = ((it.hour + delta) % 24 + 24) % 24)
    }

    fun nudgeMinute(delta: Int) = edit {
        val total = it.hour * 60 + it.minute + delta
        val wrapped = ((total % 1440) + 1440) % 1440
        it.copy(hour = wrapped / 60, minute = wrapped % 60)
    }

    /** Flips between the morning and afternoon halves of the same clock face. */
    fun toggleMeridiem() = edit {
        it.copy(hour = if (it.hour < 12) it.hour + 12 else it.hour - 12)
    }

    fun setLabel(label: String) = edit { it.copy(label = label.take(Alarm.MAX_LABEL_LENGTH)) }

    fun toggleDay(day: DayOfWeek) = edit { it.withDayToggled(day) }

    fun setRepeatMask(mask: Int) = edit { it.copy(repeatMask = mask and Alarm.ALL_DAYS_MASK) }

    fun setSound(soundId: String) = edit { it.copy(soundId = soundId) }

    fun setVolume(percent: Int) = edit {
        it.copy(volumePercent = percent.coerceIn(Alarm.MIN_VOLUME, 100))
    }

    fun setVibrate(enabled: Boolean) = edit { it.copy(vibrate = enabled) }

    fun setGradualVolume(enabled: Boolean) = edit { it.copy(gradualVolume = enabled) }

    fun setSnoozeMinutes(minutes: Int) = edit { it.copy(snoozeMinutes = minutes) }

    fun setMaxSnoozes(count: Int) = edit { it.copy(maxSnoozeCount = count.coerceIn(0, 20)) }

    fun setChallenge(challenge: DismissChallenge, strength: Int) = edit {
        it.copy(challenge = challenge, challengeStrength = strength.coerceIn(1, 20))
    }

    fun setSafetyDismissSeconds(seconds: Int) = edit { it.copy(safetyDismissSeconds = seconds) }

    fun save() {
        val draft = _state.value.draft
        val problem = validate(draft)
        if (problem != null) {
            _state.value = _state.value.copy(error = problem)
            return
        }
        viewModelScope.launch {
            runCatching { alarms.save(draft.copy(enabled = true)) }
                .onSuccess { _state.value = _state.value.copy(saved = true, error = null) }
                .onFailure {
                    _state.value = _state.value.copy(
                        error = "The alarm could not be saved. Please try again."
                    )
                }
        }
    }

    fun delete(onDone: () -> Unit) {
        val draft = _state.value.draft
        if (draft.id == 0L) {
            onDone()
            return
        }
        viewModelScope.launch {
            runCatching { alarms.delete(draft) }
            onDone()
        }
    }

    fun clearError() {
        _state.value = _state.value.copy(error = null)
    }

    /** Human-readable reasons a draft cannot be saved. */
    private fun validate(alarm: Alarm): String? = when {
        alarm.hour !in 0..23 || alarm.minute !in 0..59 ->
            "Pick a time between 00:00 and 23:59."

        alarm.repeatMask != 0 && alarm.repeatMask and Alarm.ALL_DAYS_MASK == 0 ->
            "Choose at least one day to repeat on, or switch repeat off."

        alarm.volumePercent < Alarm.MIN_VOLUME ->
            "Volume is too low to wake you. Raise it above ${Alarm.MIN_VOLUME}%."

        alarm.snoozeMinutes !in Alarm.SNOOZE_OPTIONS ->
            "Choose a snooze length of 5, 10, 15, 20 or 30 minutes."

        else -> null
    }

    companion object {
        val ALARM_ID_KEY = object : CreationExtras.Key<Long> {}

        fun factory(alarmId: Long): ViewModelProvider.Factory =
            object : ViewModelProvider.Factory {
                @Suppress("UNCHECKED_CAST")
                override fun <T : ViewModel> create(modelClass: Class<T>): T =
                    EditAlarmViewModel(
                        alarmId = alarmId,
                        alarms = ServiceLocator.alarms,
                        settings = ServiceLocator.settings,
                    ) as T
            }
    }
}

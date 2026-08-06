package com.alarmhandler.app.ui.settings

import android.net.Uri
import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.initializer
import androidx.lifecycle.viewmodel.viewModelFactory
import com.alarmhandler.app.alarm.AlarmScheduler
import com.alarmhandler.app.data.ServiceLocator
import com.alarmhandler.app.data.backup.BackupManager
import com.alarmhandler.app.data.backup.RestoreResult
import com.alarmhandler.app.data.model.Alarm
import com.alarmhandler.app.data.model.DismissChallenge
import com.alarmhandler.app.data.prefs.AppSettings
import com.alarmhandler.app.data.prefs.ClockFormat
import com.alarmhandler.app.data.prefs.SettingsRepository
import com.alarmhandler.app.data.prefs.ThemeMode
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.time.DayOfWeek

class SettingsViewModel(
    private val settings: SettingsRepository,
    private val backup: BackupManager,
    private val scheduler: AlarmScheduler,
) : ViewModel() {

    private val _message = MutableStateFlow<String?>(null)
    val message: StateFlow<String?> = _message.asStateFlow()

    fun setTheme(mode: ThemeMode) = launch { settings.setThemeMode(mode) }

    fun setPixelTheme(enabled: Boolean) = launch { settings.setPixelTheme(enabled) }

    fun setClockFormat(format: ClockFormat) = launch { settings.setClockFormat(format) }

    fun setDefaultSnooze(minutes: Int) = launch { settings.setDefaultSnooze(minutes) }

    fun setDefaultSound(id: String) = launch { settings.setDefaultSound(id) }

    fun setDefaultVibrate(enabled: Boolean) = launch { settings.setDefaultVibrate(enabled) }

    fun setDefaultGradual(enabled: Boolean) = launch { settings.setDefaultGradualVolume(enabled) }

    fun setWeekStart(day: DayOfWeek) = launch { settings.setWeekStart(day) }

    fun setReducedMotion(enabled: Boolean) = launch { settings.setReducedMotion(enabled) }

    fun setAutoSilence(minutes: Int) = launch { settings.setAutoSilenceMinutes(minutes) }

    /**
     * Rings a throwaway alarm in five seconds using the current defaults, so
     * the user can check sound, vibration and the lock-screen behaviour
     * without creating a real alarm.
     */
    fun testAlarm() {
        viewModelScope.launch {
            val prefs = settings.current()
            val test = Alarm(
                hour = 0,
                minute = 0,
                label = "Test alarm",
                soundId = prefs.defaultSoundId,
                volumePercent = prefs.defaultVolumePercent,
                vibrate = prefs.defaultVibrate,
                // A ramp would leave a five second test almost silent.
                gradualVolume = false,
                snoozeMinutes = prefs.defaultSnoozeMinutes,
                challenge = DismissChallenge.TAP,
                safetyDismissSeconds = 15,
            )
            scheduler.scheduleTest(test)
            _message.value = if (scheduler.canScheduleExactAlarms()) {
                "The test alarm will ring in five seconds. Lock your phone to see " +
                    "how it behaves."
            } else {
                "Exact alarms are switched off, so the test may ring late. " +
                    "Fix the warning above for an accurate test."
            }
        }
    }

    fun exportTo(uri: Uri) {
        viewModelScope.launch {
            backup.export(uri)
                .onSuccess { count ->
                    _message.value = "Saved $count " +
                        if (count == 1) "alarm to the file." else "alarms to the file."
                }
                .onFailure {
                    _message.value = "The backup could not be written: " +
                        (it.message ?: "unknown error")
                }
        }
    }

    fun importFrom(uri: Uri, restoreSettings: Boolean) {
        viewModelScope.launch {
            when (val result = backup.import(uri, restoreSettings)) {
                is RestoreResult.Success -> {
                    _message.value = "Restored ${result.alarmCount} alarms" +
                        if (result.settingsRestored) " and your settings." else "."
                }

                is RestoreResult.Failure -> _message.value = result.message
            }
        }
    }

    fun resetSettings() {
        viewModelScope.launch {
            settings.resetAll()
            _message.value = "Settings restored to their defaults. Your alarms are untouched."
        }
    }

    fun clearMessage() {
        _message.value = null
    }

    private fun launch(block: suspend () -> Unit) {
        viewModelScope.launch { block() }
    }

    companion object {
        val Factory: ViewModelProvider.Factory = viewModelFactory {
            initializer {
                SettingsViewModel(
                    settings = ServiceLocator.settings,
                    backup = ServiceLocator.backup,
                    scheduler = ServiceLocator.scheduler,
                )
            }
        }
    }
}

/** Convenience for the screen: every setting the UI can change. */
typealias SettingsSnapshot = AppSettings

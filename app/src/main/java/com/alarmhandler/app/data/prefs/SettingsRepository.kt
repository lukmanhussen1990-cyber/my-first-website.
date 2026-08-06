package com.alarmhandler.app.data.prefs

import android.content.Context
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.booleanPreferencesKey
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.emptyPreferences
import androidx.datastore.preferences.core.intPreferencesKey
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import com.alarmhandler.app.data.model.Alarm
import com.alarmhandler.app.data.model.AlarmSound
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map
import java.io.IOException
import java.time.DayOfWeek

private val Context.dataStore: DataStore<Preferences> by preferencesDataStore(name = "settings")

/** Reads and writes [AppSettings]. */
class SettingsRepository(private val context: Context) {

    private object Keys {
        val THEME = stringPreferencesKey("theme_mode")
        val PIXEL = booleanPreferencesKey("pixel_theme")
        val CLOCK = stringPreferencesKey("clock_format")
        val SNOOZE = intPreferencesKey("default_snooze")
        val SOUND = stringPreferencesKey("default_sound")
        val VIBRATE = booleanPreferencesKey("default_vibrate")
        val GRADUAL = booleanPreferencesKey("default_gradual")
        val VOLUME = intPreferencesKey("default_volume")
        val WEEK_START = intPreferencesKey("week_start")
        val REDUCED_MOTION = booleanPreferencesKey("reduced_motion")
        val AUTO_SILENCE = intPreferencesKey("auto_silence_minutes")
        val ONBOARDED = booleanPreferencesKey("onboarding_complete")
    }

    val settings: Flow<AppSettings> = context.dataStore.data
        // A corrupt preferences file must never stop the alarms from working.
        .catch { e -> if (e is IOException) emit(emptyPreferences()) else throw e }
        .map { it.toSettings() }

    suspend fun current(): AppSettings = settings.first()

    private fun Preferences.toSettings() = AppSettings(
        themeMode = ThemeMode.fromId(this[Keys.THEME]),
        pixelTheme = this[Keys.PIXEL] ?: true,
        clockFormat = ClockFormat.fromId(this[Keys.CLOCK]),
        defaultSnoozeMinutes = (this[Keys.SNOOZE] ?: Alarm.DEFAULT_SNOOZE)
            .takeIf { it in Alarm.SNOOZE_OPTIONS } ?: Alarm.DEFAULT_SNOOZE,
        defaultSoundId = this[Keys.SOUND] ?: AlarmSound.DEFAULT_ID,
        defaultVibrate = this[Keys.VIBRATE] ?: true,
        defaultGradualVolume = this[Keys.GRADUAL] ?: true,
        defaultVolumePercent = (this[Keys.VOLUME] ?: 80).coerceIn(Alarm.MIN_VOLUME, 100),
        weekStart = runCatching { DayOfWeek.of(this[Keys.WEEK_START] ?: 1) }
            .getOrDefault(DayOfWeek.MONDAY),
        reducedMotion = this[Keys.REDUCED_MOTION] ?: false,
        autoSilenceMinutes = (this[Keys.AUTO_SILENCE] ?: 10).coerceIn(1, 60),
        onboardingComplete = this[Keys.ONBOARDED] ?: false,
    )

    suspend fun setThemeMode(mode: ThemeMode) = edit { it[Keys.THEME] = mode.id }

    suspend fun setPixelTheme(enabled: Boolean) = edit { it[Keys.PIXEL] = enabled }

    suspend fun setClockFormat(format: ClockFormat) = edit { it[Keys.CLOCK] = format.id }

    suspend fun setDefaultSnooze(minutes: Int) = edit {
        it[Keys.SNOOZE] = if (minutes in Alarm.SNOOZE_OPTIONS) minutes else Alarm.DEFAULT_SNOOZE
    }

    suspend fun setDefaultSound(id: String) = edit { it[Keys.SOUND] = id }

    suspend fun setDefaultVibrate(enabled: Boolean) = edit { it[Keys.VIBRATE] = enabled }

    suspend fun setDefaultGradualVolume(enabled: Boolean) = edit { it[Keys.GRADUAL] = enabled }

    suspend fun setDefaultVolume(percent: Int) = edit {
        it[Keys.VOLUME] = percent.coerceIn(Alarm.MIN_VOLUME, 100)
    }

    suspend fun setWeekStart(day: DayOfWeek) = edit { it[Keys.WEEK_START] = day.value }

    suspend fun setReducedMotion(enabled: Boolean) = edit { it[Keys.REDUCED_MOTION] = enabled }

    suspend fun setAutoSilenceMinutes(minutes: Int) = edit {
        it[Keys.AUTO_SILENCE] = minutes.coerceIn(1, 60)
    }

    suspend fun setOnboardingComplete(complete: Boolean) = edit { it[Keys.ONBOARDED] = complete }

    /** Restores every setting to its shipped default. Alarms are untouched. */
    suspend fun resetAll() {
        context.dataStore.edit { it.clear() }
    }

    private suspend fun edit(block: (androidx.datastore.preferences.core.MutablePreferences) -> Unit) {
        context.dataStore.edit(block)
    }
}

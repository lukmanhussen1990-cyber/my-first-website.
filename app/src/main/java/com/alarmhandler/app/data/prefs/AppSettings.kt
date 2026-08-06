package com.alarmhandler.app.data.prefs

import com.alarmhandler.app.data.model.Alarm
import com.alarmhandler.app.data.model.AlarmSound
import java.time.DayOfWeek

enum class ThemeMode(val id: String) {
    LIGHT("light"),
    DARK("dark"),
    SYSTEM("system"),
    ;

    companion object {
        fun fromId(id: String?) = entries.firstOrNull { it.id == id } ?: SYSTEM
    }
}

enum class ClockFormat(val id: String) {
    SYSTEM("system"),
    H12("h12"),
    H24("h24"),
    ;

    companion object {
        fun fromId(id: String?) = entries.firstOrNull { it.id == id } ?: SYSTEM
    }
}

/**
 * Everything on the Settings screen, as one immutable snapshot.
 *
 * The defaults here are also the values a brand new alarm inherits, so
 * changing a default changes the next alarm the user creates without touching
 * the alarms they already have.
 */
data class AppSettings(
    val themeMode: ThemeMode = ThemeMode.SYSTEM,
    val pixelTheme: Boolean = true,
    val clockFormat: ClockFormat = ClockFormat.SYSTEM,
    val defaultSnoozeMinutes: Int = Alarm.DEFAULT_SNOOZE,
    val defaultSoundId: String = AlarmSound.DEFAULT_ID,
    val defaultVibrate: Boolean = true,
    val defaultGradualVolume: Boolean = true,
    val defaultVolumePercent: Int = 80,
    val weekStart: DayOfWeek = DayOfWeek.MONDAY,
    val reducedMotion: Boolean = false,
    /** Ring for this long before giving up and logging a missed alarm. */
    val autoSilenceMinutes: Int = 10,
    /** Set once the user has been shown the permission checklist. */
    val onboardingComplete: Boolean = false,
) {
    /** Day headers, rotated so the user's chosen first day comes first. */
    val orderedWeek: List<DayOfWeek>
        get() = List(7) { DayOfWeek.of((weekStart.value - 1 + it) % 7 + 1) }
}

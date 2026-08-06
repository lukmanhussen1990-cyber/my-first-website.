package com.alarmhandler.app.data.backup

import kotlinx.serialization.Serializable

/**
 * On-disk shape of a backup file. Field names are part of the file format, so
 * they are spelled out explicitly and never renamed.
 */
@Serializable
data class BackupFile(
    val format: String = FORMAT,
    val version: Int = VERSION,
    val exportedAt: Long = 0L,
    val alarms: List<BackupAlarm> = emptyList(),
    val settings: BackupSettings? = null,
) {
    companion object {
        const val FORMAT = "alarm-handler-backup"
        const val VERSION = 1
    }
}

@Serializable
data class BackupAlarm(
    val hour: Int,
    val minute: Int,
    val label: String = "",
    val enabled: Boolean = true,
    val repeatMask: Int = 0,
    val soundId: String,
    val volumePercent: Int = 80,
    val vibrate: Boolean = true,
    val gradualVolume: Boolean = true,
    val gradualVolumeSeconds: Int = 30,
    val snoozeMinutes: Int = 10,
    val maxSnoozeCount: Int = 0,
    val challenge: String = "tap",
    val challengeStrength: Int = 3,
    val safetyDismissSeconds: Int = 60,
    val createdAt: Long = 0L,
)

@Serializable
data class BackupSettings(
    val themeMode: String = "system",
    val pixelTheme: Boolean = true,
    val clockFormat: String = "system",
    val defaultSnoozeMinutes: Int = 10,
    val defaultSoundId: String = "builtin:tone_pixel_chime",
    val defaultVibrate: Boolean = true,
    val defaultGradualVolume: Boolean = true,
    val defaultVolumePercent: Int = 80,
    val weekStart: Int = 1,
    val reducedMotion: Boolean = false,
    val autoSilenceMinutes: Int = 10,
)

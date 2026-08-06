package com.alarmhandler.app.data.backup

import android.content.Context
import android.net.Uri
import com.alarmhandler.app.data.model.Alarm
import com.alarmhandler.app.data.model.DismissChallenge
import com.alarmhandler.app.data.prefs.AppSettings
import com.alarmhandler.app.data.prefs.ClockFormat
import com.alarmhandler.app.data.prefs.SettingsRepository
import com.alarmhandler.app.data.prefs.ThemeMode
import com.alarmhandler.app.data.repo.AlarmRepository
import kotlinx.serialization.json.Json
import java.time.DayOfWeek

/** Result of a restore, so the UI can report exactly what happened. */
sealed interface RestoreResult {
    data class Success(val alarmCount: Int, val settingsRestored: Boolean) : RestoreResult
    data class Failure(val message: String) : RestoreResult
}

/**
 * Exports and imports the whole alarm list as a plain JSON file the user owns.
 *
 * Everything goes through the Storage Access Framework, so no storage
 * permission is needed and the file lands wherever the user chose.
 */
class BackupManager(
    private val context: Context,
    private val alarms: AlarmRepository,
    private val settings: SettingsRepository,
) {

    private val json = Json {
        prettyPrint = true
        ignoreUnknownKeys = true
        encodeDefaults = true
    }

    suspend fun export(target: Uri): Result<Int> = runCatching {
        val list = alarms.getAll()
        val payload = BackupFile(
            exportedAt = System.currentTimeMillis(),
            alarms = list.map { it.toBackup() },
            settings = settings.current().toBackup(),
        )
        val text = json.encodeToString(BackupFile.serializer(), payload)
        context.contentResolver.openOutputStream(target, "wt")
            ?.use { it.write(text.toByteArray()) }
            ?: error("Could not open the selected file for writing.")
        list.size
    }

    suspend fun import(source: Uri, restoreSettings: Boolean): RestoreResult {
        val text = runCatching {
            context.contentResolver.openInputStream(source)
                ?.bufferedReader()
                ?.use { it.readText() }
                ?: error("Could not open the selected file.")
        }.getOrElse { return RestoreResult.Failure(it.message ?: "The file could not be read.") }

        val parsed = runCatching { json.decodeFromString(BackupFile.serializer(), text) }
            .getOrElse {
                return RestoreResult.Failure(
                    "This is not an Alarm Handler backup file, or it is damaged."
                )
            }

        if (parsed.format != BackupFile.FORMAT) {
            return RestoreResult.Failure("This file was not written by Alarm Handler.")
        }
        if (parsed.version > BackupFile.VERSION) {
            return RestoreResult.Failure(
                "This backup was written by a newer version of Alarm Handler."
            )
        }

        return runCatching {
            alarms.replaceAll(parsed.alarms.map { it.toAlarm() })
            var settingsRestored = false
            if (restoreSettings) {
                parsed.settings?.let {
                    applySettings(it)
                    settingsRestored = true
                }
            }
            RestoreResult.Success(parsed.alarms.size, settingsRestored)
        }.getOrElse {
            RestoreResult.Failure(it.message ?: "The alarms could not be restored.")
        }
    }

    private suspend fun applySettings(backup: BackupSettings) {
        settings.setThemeMode(ThemeMode.fromId(backup.themeMode))
        settings.setPixelTheme(backup.pixelTheme)
        settings.setClockFormat(ClockFormat.fromId(backup.clockFormat))
        settings.setDefaultSnooze(backup.defaultSnoozeMinutes)
        settings.setDefaultSound(backup.defaultSoundId)
        settings.setDefaultVibrate(backup.defaultVibrate)
        settings.setDefaultGradualVolume(backup.defaultGradualVolume)
        settings.setDefaultVolume(backup.defaultVolumePercent)
        settings.setWeekStart(
            runCatching { DayOfWeek.of(backup.weekStart) }.getOrDefault(DayOfWeek.MONDAY)
        )
        settings.setReducedMotion(backup.reducedMotion)
        settings.setAutoSilenceMinutes(backup.autoSilenceMinutes)
    }

    companion object {
        fun suggestedFileName(): String {
            val stamp = java.time.LocalDateTime.now()
                .format(java.time.format.DateTimeFormatter.ofPattern("yyyy-MM-dd-HHmm"))
            return "alarm-handler-backup-$stamp.json"
        }
    }
}

private fun Alarm.toBackup() = BackupAlarm(
    hour = hour,
    minute = minute,
    label = label,
    enabled = enabled,
    repeatMask = repeatMask,
    soundId = soundId,
    volumePercent = volumePercent,
    vibrate = vibrate,
    gradualVolume = gradualVolume,
    gradualVolumeSeconds = gradualVolumeSeconds,
    snoozeMinutes = snoozeMinutes,
    maxSnoozeCount = maxSnoozeCount,
    challenge = challenge.id,
    challengeStrength = challengeStrength,
    safetyDismissSeconds = safetyDismissSeconds,
    createdAt = createdAt,
)

// `sanitized()` runs on the way back in, so a hand-edited backup file can never
// put an out-of-range value in front of the scheduler.
private fun BackupAlarm.toAlarm() = Alarm(
    hour = hour,
    minute = minute,
    label = label,
    enabled = enabled,
    repeatMask = repeatMask,
    soundId = soundId,
    volumePercent = volumePercent,
    vibrate = vibrate,
    gradualVolume = gradualVolume,
    gradualVolumeSeconds = gradualVolumeSeconds,
    snoozeMinutes = snoozeMinutes,
    maxSnoozeCount = maxSnoozeCount,
    challenge = DismissChallenge.fromId(challenge),
    challengeStrength = challengeStrength,
    safetyDismissSeconds = safetyDismissSeconds,
    createdAt = createdAt,
).sanitized()

private fun AppSettings.toBackup() = BackupSettings(
    themeMode = themeMode.id,
    pixelTheme = pixelTheme,
    clockFormat = clockFormat.id,
    defaultSnoozeMinutes = defaultSnoozeMinutes,
    defaultSoundId = defaultSoundId,
    defaultVibrate = defaultVibrate,
    defaultGradualVolume = defaultGradualVolume,
    defaultVolumePercent = defaultVolumePercent,
    weekStart = weekStart.value,
    reducedMotion = reducedMotion,
    autoSilenceMinutes = autoSilenceMinutes,
)

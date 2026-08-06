package com.alarmhandler.app.data.model

import androidx.room.ColumnInfo
import androidx.room.Entity
import androidx.room.PrimaryKey
import kotlinx.serialization.Serializable
import java.time.DayOfWeek

/**
 * A single alarm.
 *
 * Repeat days are held as a bit mask so the row stays a single integer and the
 * scheduling maths can stay allocation free. Bit 0 is Monday through bit 6 for
 * Sunday, matching [DayOfWeek.getValue] minus one.
 */
@Entity(tableName = "alarms")
@Serializable
data class Alarm(
    @PrimaryKey(autoGenerate = true)
    val id: Long = 0L,

    @ColumnInfo(name = "hour")
    val hour: Int = 7,

    @ColumnInfo(name = "minute")
    val minute: Int = 0,

    @ColumnInfo(name = "label")
    val label: String = "",

    @ColumnInfo(name = "enabled")
    val enabled: Boolean = true,

    @ColumnInfo(name = "repeat_mask")
    val repeatMask: Int = 0,

    @ColumnInfo(name = "sound_id")
    val soundId: String = AlarmSound.DEFAULT_ID,

    @ColumnInfo(name = "volume_percent")
    val volumePercent: Int = 80,

    @ColumnInfo(name = "vibrate")
    val vibrate: Boolean = true,

    @ColumnInfo(name = "gradual_volume")
    val gradualVolume: Boolean = true,

    @ColumnInfo(name = "gradual_volume_seconds")
    val gradualVolumeSeconds: Int = 30,

    @ColumnInfo(name = "snooze_minutes")
    val snoozeMinutes: Int = 10,

    /** 0 means the user may snooze forever. */
    @ColumnInfo(name = "max_snooze_count")
    val maxSnoozeCount: Int = 0,

    @ColumnInfo(name = "challenge")
    val challenge: DismissChallenge = DismissChallenge.TAP,

    @ColumnInfo(name = "challenge_strength")
    val challengeStrength: Int = 3,

    /**
     * After this many seconds of ringing a plain dismiss button always appears,
     * no matter which challenge is configured. 0 disables the escape hatch.
     */
    @ColumnInfo(name = "safety_dismiss_seconds")
    val safetyDismissSeconds: Int = 60,

    /** How many times the current ringing session has been snoozed. */
    @ColumnInfo(name = "snooze_count")
    val snoozeCount: Int = 0,

    /**
     * Set while a snooze is pending so the scheduler fires at the snooze time
     * instead of the alarm's own time. 0 means no snooze is outstanding.
     */
    @ColumnInfo(name = "snooze_until")
    val snoozeUntil: Long = 0L,

    @ColumnInfo(name = "created_at")
    val createdAt: Long = 0L,
) {

    val repeatDays: Set<DayOfWeek>
        get() = DayOfWeek.entries.filter { isRepeatingOn(it) }.toSet()

    val isRepeating: Boolean get() = repeatMask != 0

    fun isRepeatingOn(day: DayOfWeek): Boolean =
        repeatMask and (1 shl (day.value - 1)) != 0

    fun withDayToggled(day: DayOfWeek): Alarm =
        copy(repeatMask = repeatMask xor (1 shl (day.value - 1)))

    val snoozesRemaining: Int?
        get() = if (maxSnoozeCount <= 0) null else (maxSnoozeCount - snoozeCount).coerceAtLeast(0)

    val canSnooze: Boolean
        get() = snoozesRemaining?.let { it > 0 } ?: true

    /**
     * Clamps every field into a valid range. Called before any write so a bad
     * value can never reach the scheduler, whatever produced it -- the editor,
     * a restored backup, or a database migrated from an older build.
     */
    fun sanitized(): Alarm = copy(
        hour = hour.coerceIn(0, 23),
        minute = minute.coerceIn(0, 59),
        label = label.trim().take(MAX_LABEL_LENGTH),
        repeatMask = repeatMask and ALL_DAYS_MASK,
        volumePercent = volumePercent.coerceIn(MIN_VOLUME, 100),
        gradualVolumeSeconds = gradualVolumeSeconds.coerceIn(5, 300),
        snoozeMinutes = if (snoozeMinutes in SNOOZE_OPTIONS) snoozeMinutes else DEFAULT_SNOOZE,
        maxSnoozeCount = maxSnoozeCount.coerceIn(0, 20),
        challengeStrength = challengeStrength.coerceIn(1, 20),
        safetyDismissSeconds = if (safetyDismissSeconds <= 0) 0
        else safetyDismissSeconds.coerceIn(15, 600),
        snoozeCount = snoozeCount.coerceAtLeast(0),
        createdAt = if (createdAt <= 0L) System.currentTimeMillis() else createdAt,
    )

    companion object {
        const val MAX_LABEL_LENGTH = 60
        const val MIN_VOLUME = 5
        const val DEFAULT_SNOOZE = 10
        const val ALL_DAYS_MASK = 0b111_1111

        val SNOOZE_OPTIONS = listOf(5, 10, 15, 20, 30)

        val WEEKDAY_MASK: Int = DayOfWeek.entries
            .filter { it.value <= 5 }
            .fold(0) { acc, d -> acc or (1 shl (d.value - 1)) }

        val WEEKEND_MASK: Int = ALL_DAYS_MASK and WEEKDAY_MASK.inv()
    }
}

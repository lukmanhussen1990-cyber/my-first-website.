package com.alarmhandler.app.alarm

import com.alarmhandler.app.data.model.Alarm
import java.time.Instant
import java.time.LocalDate
import java.time.LocalTime
import java.time.ZoneId
import java.time.ZonedDateTime

/**
 * Pure next-fire-time maths, deliberately free of Android types so it can be
 * unit tested and so time zone / DST behaviour is decided in one place.
 */
object AlarmSchedule {

    /**
     * The instant [alarm] should next ring, or null when it never will.
     *
     * When [honorSnooze] is true an outstanding snooze wins over the alarm's
     * own time -- that is what the UI shows the user. The scheduler passes
     * false because a snooze is armed through its own pending intent, so the
     * alarm's regular occurrence must stay independently scheduled.
     */
    fun nextTrigger(
        alarm: Alarm,
        now: ZonedDateTime = ZonedDateTime.now(),
        honorSnooze: Boolean = true,
    ): ZonedDateTime? {
        if (!alarm.enabled) return null

        if (honorSnooze && alarm.snoozeUntil > 0L) {
            val snooze = Instant.ofEpochMilli(alarm.snoozeUntil).atZone(now.zone)
            if (snooze.isAfter(now)) return snooze
        }

        val time = LocalTime.of(alarm.hour.coerceIn(0, 23), alarm.minute.coerceIn(0, 59))

        if (!alarm.isRepeating) {
            val today = at(now.toLocalDate(), time, now.zone)
            return if (today.isAfter(now)) today else at(now.toLocalDate().plusDays(1), time, now.zone)
        }

        // Repeating: walk forward up to a full week. Eight steps rather than
        // seven so an alarm that repeats only on today's weekday and has
        // already passed still resolves to next week.
        for (offset in 0..7) {
            val date = now.toLocalDate().plusDays(offset.toLong())
            if (!alarm.isRepeatingOn(date.dayOfWeek)) continue
            val candidate = at(date, time, now.zone)
            if (candidate.isAfter(now)) return candidate
        }
        return null
    }

    fun nextTriggerMillis(
        alarm: Alarm,
        now: ZonedDateTime = ZonedDateTime.now(),
        honorSnooze: Boolean = true,
    ): Long? = nextTrigger(alarm, now, honorSnooze)?.toInstant()?.toEpochMilli()

    /**
     * The alarm that will ring first, ignoring any that never will.
     * Ties are broken by id so the order is stable across recompositions.
     */
    fun soonest(
        alarms: List<Alarm>,
        now: ZonedDateTime = ZonedDateTime.now(),
    ): Pair<Alarm, Long>? =
        alarms.mapNotNull { alarm -> nextTriggerMillis(alarm, now)?.let { alarm to it } }
            .minWithOrNull(compareBy({ it.second }, { it.first.id }))

    /**
     * Sorts alarms by when they will next ring. Alarms that will never ring
     * (disabled ones) sink to the bottom, ordered by their clock time so the
     * list still reads sensibly.
     */
    fun sortedByNextTrigger(
        alarms: List<Alarm>,
        now: ZonedDateTime = ZonedDateTime.now(),
    ): List<Alarm> {
        val withTrigger = alarms.map { it to nextTriggerMillis(it, now) }
        return withTrigger.sortedWith(
            compareBy(
                { it.second == null },
                { it.second ?: Long.MAX_VALUE },
                { it.first.hour },
                { it.first.minute },
                { it.first.id },
            )
        ).map { it.first }
    }

    /**
     * Builds a zoned time, stepping over a DST gap rather than throwing.
     * `ZonedDateTime.of` already shifts forward for gaps; this wrapper exists
     * so the intent is explicit at the call sites.
     */
    private fun at(date: LocalDate, time: LocalTime, zone: ZoneId): ZonedDateTime =
        ZonedDateTime.of(date, time, zone)

    /**
     * "in 7h 20m" style countdown text for the header card.
     */
    fun formatCountdown(millisUntil: Long): String {
        if (millisUntil <= 0) return "now"
        val totalMinutes = (millisUntil + 59_999) / 60_000
        val days = totalMinutes / (24 * 60)
        val hours = (totalMinutes % (24 * 60)) / 60
        val minutes = totalMinutes % 60
        return buildString {
            if (days > 0) append("${days}d ")
            if (days > 0 || hours > 0) append("${hours}h ")
            append("${minutes}m")
        }.trim()
    }
}

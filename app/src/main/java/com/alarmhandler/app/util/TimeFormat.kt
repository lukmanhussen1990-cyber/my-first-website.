package com.alarmhandler.app.util

import android.content.Context
import android.text.format.DateFormat
import com.alarmhandler.app.data.model.Alarm
import com.alarmhandler.app.data.prefs.ClockFormat
import java.time.DayOfWeek
import java.time.Instant
import java.time.LocalTime
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.time.format.TextStyle
import java.util.Locale

/** Formatting shared by every screen, so a clock never disagrees with itself. */
object TimeFormat {

    fun use24Hour(context: Context, format: ClockFormat): Boolean = when (format) {
        ClockFormat.H12 -> false
        ClockFormat.H24 -> true
        ClockFormat.SYSTEM -> DateFormat.is24HourFormat(context)
    }

    /** "07:30" or "7:30" -- the AM/PM marker is returned separately so the UI
     *  can render it smaller next to a very large clock. */
    fun time(hour: Int, minute: Int, use24Hour: Boolean): String {
        val h = hour.coerceIn(0, 23)
        val m = minute.coerceIn(0, 59)
        return if (use24Hour) {
            "%02d:%02d".format(h, m)
        } else {
            val display = when {
                h % 12 == 0 -> 12
                else -> h % 12
            }
            "%d:%02d".format(display, m)
        }
    }

    /** "AM"/"PM", or an empty string in 24-hour mode. */
    fun meridiem(hour: Int, use24Hour: Boolean): String = when {
        use24Hour -> ""
        hour.coerceIn(0, 23) < 12 -> "AM"
        else -> "PM"
    }

    fun timeWithMeridiem(hour: Int, minute: Int, use24Hour: Boolean): String {
        val base = time(hour, minute, use24Hour)
        val suffix = meridiem(hour, use24Hour)
        return if (suffix.isEmpty()) base else "$base $suffix"
    }

    fun instant(millis: Long, use24Hour: Boolean): String {
        val local = Instant.ofEpochMilli(millis).atZone(ZoneId.systemDefault())
        return timeWithMeridiem(local.hour, local.minute, use24Hour)
    }

    fun dateTime(millis: Long, use24Hour: Boolean): String {
        val local = Instant.ofEpochMilli(millis).atZone(ZoneId.systemDefault())
        val date = local.format(DateTimeFormatter.ofPattern("EEE d MMM", Locale.getDefault()))
        return "$date, ${timeWithMeridiem(local.hour, local.minute, use24Hour)}"
    }

    /** Short day initial for the repeat chips, e.g. "M". */
    fun dayInitial(day: DayOfWeek): String =
        day.getDisplayName(TextStyle.NARROW, Locale.getDefault())

    /** Three-letter day name for the repeat summary, e.g. "Mon". */
    fun dayShort(day: DayOfWeek): String =
        day.getDisplayName(TextStyle.SHORT, Locale.getDefault())

    fun dayFull(day: DayOfWeek): String =
        day.getDisplayName(TextStyle.FULL, Locale.getDefault())

    /**
     * Human summary of an alarm's repeat pattern, ordered by the user's chosen
     * first day of the week.
     */
    fun repeatSummary(alarm: Alarm, weekStart: DayOfWeek): String = when (alarm.repeatMask) {
        0 -> "One time"
        Alarm.ALL_DAYS_MASK -> "Every day"
        Alarm.WEEKDAY_MASK -> "Weekdays"
        Alarm.WEEKEND_MASK -> "Weekends"
        else -> orderedWeek(weekStart)
            .filter { alarm.isRepeatingOn(it) }
            .joinToString(" ") { dayShort(it) }
    }

    fun orderedWeek(weekStart: DayOfWeek): List<DayOfWeek> =
        List(7) { DayOfWeek.of((weekStart.value - 1 + it) % 7 + 1) }

    /** Which day the next trigger lands on, phrased relative to today. */
    fun relativeDay(millis: Long): String {
        val zone = ZoneId.systemDefault()
        val target = Instant.ofEpochMilli(millis).atZone(zone).toLocalDate()
        val today = LocalTime.now().let { java.time.LocalDate.now(zone) }
        return when (java.time.temporal.ChronoUnit.DAYS.between(today, target)) {
            0L -> "Today"
            1L -> "Tomorrow"
            else -> target.format(DateTimeFormatter.ofPattern("EEE d MMM", Locale.getDefault()))
        }
    }
}

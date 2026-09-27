package com.imran.examcountdown.core

import java.time.Instant
import java.time.LocalDate
import java.time.LocalTime
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale

/** Date and time text. Times are always India time unless stated otherwise. */
object Formats {
    private val TIME = DateTimeFormatter.ofPattern("h:mm a", Locale.ENGLISH)
    private val DATE_FULL = DateTimeFormatter.ofPattern("EEE, d MMM yyyy", Locale.ENGLISH)
    private val DATE_SHORT = DateTimeFormatter.ofPattern("EEE, d MMM", Locale.ENGLISH)
    private val DATE_LONG = DateTimeFormatter.ofPattern("EEEE, d MMMM", Locale.ENGLISH)
    private val WEEKDAY = DateTimeFormatter.ofPattern("EEE", Locale.ENGLISH)
    private val MONTH = DateTimeFormatter.ofPattern("MMM", Locale.ENGLISH)

    fun time(t: LocalTime): String = TIME.format(t)
    fun time(millis: Long, zone: ZoneId = Timetable.ZONE): String =
        TIME.format(Instant.ofEpochMilli(millis).atZone(zone))

    fun dateFull(d: LocalDate): String = DATE_FULL.format(d)
    fun dateShort(d: LocalDate): String = DATE_SHORT.format(d)
    fun dateLong(d: LocalDate): String = DATE_LONG.format(d)
    fun weekday(d: LocalDate): String = WEEKDAY.format(d)
    fun month(d: LocalDate): String = MONTH.format(d).uppercase(Locale.ENGLISH)

    /**
     * The exam's start in [zone] when that differs from India time, e.g. "9:00 AM" —
     * or null when the device is already on India time.
     */
    fun startInZone(exam: Exam, zone: ZoneId): String? {
        val instant = Instant.ofEpochMilli(exam.startMillis)
        val local = instant.atZone(zone)
        val india = instant.atZone(Timetable.ZONE)
        if (local.offset == india.offset) return null
        val dayShift = local.toLocalDate().compareTo(india.toLocalDate())
        val suffix = when {
            dayShift < 0 -> " (the day before)"
            dayShift > 0 -> " (the next day)"
            else -> ""
        }
        return TIME.format(local) + suffix
    }

    /** "in 3 days", "tomorrow", "today" relative to today's date in India. */
    fun relativeDay(date: LocalDate, now: Long): String {
        val today = SeasonCalculator.todayInIndia(now)
        val days = date.toEpochDay() - today.toEpochDay()
        return when {
            days == 0L -> "Today"
            days == 1L -> "Tomorrow"
            days > 1L -> "In $days days"
            days == -1L -> "Yesterday"
            else -> "${-days} days ago"
        }
    }
}

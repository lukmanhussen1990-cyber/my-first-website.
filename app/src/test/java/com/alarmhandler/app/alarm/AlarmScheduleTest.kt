package com.alarmhandler.app.alarm

import com.alarmhandler.app.data.model.Alarm
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.time.LocalDateTime
import java.time.ZoneId
import java.time.ZonedDateTime

/**
 * Scheduling is the one part of the app that must never be wrong, so the
 * next-fire-time maths is covered directly rather than through the UI.
 */
class AlarmScheduleTest {

    private val zone: ZoneId = ZoneId.of("Europe/London")

    private fun at(text: String): ZonedDateTime =
        LocalDateTime.parse(text).atZone(zone)

    private fun alarm(
        hour: Int,
        minute: Int = 0,
        repeatMask: Int = 0,
        enabled: Boolean = true,
        snoozeUntil: Long = 0L,
    ) = Alarm(
        id = 1L,
        hour = hour,
        minute = minute,
        repeatMask = repeatMask,
        enabled = enabled,
        snoozeUntil = snoozeUntil,
    )

    @Test
    fun `one-time alarm later today fires today`() {
        // Wednesday 2024-05-01, 06:00.
        val now = at("2024-05-01T06:00")
        val next = AlarmSchedule.nextTrigger(alarm(hour = 7, minute = 30), now)
        assertEquals(at("2024-05-01T07:30"), next)
    }

    @Test
    fun `one-time alarm already past rolls to tomorrow`() {
        val now = at("2024-05-01T08:00")
        val next = AlarmSchedule.nextTrigger(alarm(hour = 7, minute = 30), now)
        assertEquals(at("2024-05-02T07:30"), next)
    }

    @Test
    fun `alarm at exactly now rolls forward rather than firing twice`() {
        val now = at("2024-05-01T07:30")
        val next = AlarmSchedule.nextTrigger(alarm(hour = 7, minute = 30), now)
        assertEquals(at("2024-05-02T07:30"), next)
    }

    @Test
    fun `disabled alarm never fires`() {
        val now = at("2024-05-01T06:00")
        assertNull(AlarmSchedule.nextTrigger(alarm(hour = 7, enabled = false), now))
    }

    @Test
    fun `repeating alarm picks the next matching weekday`() {
        // Wednesday. Alarm repeats Mon-Fri at 07:00, and 07:00 has passed.
        val now = at("2024-05-01T09:00")
        val next = AlarmSchedule.nextTrigger(
            alarm(hour = 7, repeatMask = Alarm.WEEKDAY_MASK),
            now,
        )
        assertEquals(at("2024-05-02T07:00"), next)
    }

    @Test
    fun `repeating alarm skips the weekend`() {
        // Friday 2024-05-03 after the alarm time; next weekday is Monday.
        val now = at("2024-05-03T09:00")
        val next = AlarmSchedule.nextTrigger(
            alarm(hour = 7, repeatMask = Alarm.WEEKDAY_MASK),
            now,
        )
        assertEquals(at("2024-05-06T07:00"), next)
    }

    @Test
    fun `weekly alarm on todays weekday that has passed waits a full week`() {
        // Wednesday, repeating only on Wednesday, already past.
        val wednesdayOnly = 1 shl 2
        val now = at("2024-05-01T09:00")
        val next = AlarmSchedule.nextTrigger(alarm(hour = 7, repeatMask = wednesdayOnly), now)
        assertEquals(at("2024-05-08T07:00"), next)
    }

    @Test
    fun `pending snooze wins over the alarms own time`() {
        val now = at("2024-05-01T07:05")
        val snoozeUntil = at("2024-05-01T07:15").toInstant().toEpochMilli()
        val next = AlarmSchedule.nextTrigger(
            alarm(hour = 7, snoozeUntil = snoozeUntil),
            now,
        )
        assertEquals(at("2024-05-01T07:15"), next)
    }

    @Test
    fun `scheduler ignores the snooze so the regular occurrence stays armed`() {
        val now = at("2024-05-01T07:05")
        val snoozeUntil = at("2024-05-01T07:15").toInstant().toEpochMilli()
        val next = AlarmSchedule.nextTrigger(
            alarm(hour = 7, snoozeUntil = snoozeUntil),
            now,
            honorSnooze = false,
        )
        assertEquals(at("2024-05-02T07:00"), next)
    }

    @Test
    fun `an expired snooze is ignored`() {
        val now = at("2024-05-01T08:00")
        val stale = at("2024-05-01T07:15").toInstant().toEpochMilli()
        val next = AlarmSchedule.nextTrigger(alarm(hour = 7, snoozeUntil = stale), now)
        assertEquals(at("2024-05-02T07:00"), next)
    }

    @Test
    fun `soonest picks the earliest enabled alarm`() {
        val now = at("2024-05-01T06:00")
        val early = alarm(hour = 7).copy(id = 1L)
        val late = alarm(hour = 9).copy(id = 2L)
        val off = alarm(hour = 6, minute = 30, enabled = false).copy(id = 3L)
        val soonest = AlarmSchedule.soonest(listOf(late, off, early), now)
        assertEquals(1L, soonest?.first?.id)
    }

    @Test
    fun `sorting puts disabled alarms last`() {
        val now = at("2024-05-01T06:00")
        val off = alarm(hour = 6, minute = 30, enabled = false).copy(id = 3L)
        val on = alarm(hour = 9).copy(id = 2L)
        val sorted = AlarmSchedule.sortedByNextTrigger(listOf(off, on), now)
        assertEquals(listOf(2L, 3L), sorted.map { it.id })
    }

    @Test
    fun `spring forward gap resolves to a real instant`() {
        // 2024-03-31 01:00 UTC is when London jumps from 01:00 to 02:00, so
        // 01:30 does not exist that morning.
        val now = at("2024-03-30T12:00")
        val next = AlarmSchedule.nextTrigger(alarm(hour = 1, minute = 30), now)
        assertTrue("A DST gap must still produce a trigger", next != null)
        assertEquals(2, next!!.hour)
    }

    @Test
    fun `countdown formatting is human readable`() {
        assertEquals("now", AlarmSchedule.formatCountdown(0))
        assertEquals("1m", AlarmSchedule.formatCountdown(60_000))
        assertEquals("1h 0m", AlarmSchedule.formatCountdown(60 * 60_000))
        assertEquals("1d 0h 0m", AlarmSchedule.formatCountdown(24 * 60 * 60_000L))
    }

    @Test
    fun `sanitize clamps every out of range field`() {
        val wild = Alarm(
            hour = 99,
            minute = -4,
            volumePercent = 500,
            snoozeMinutes = 7,
            maxSnoozeCount = 99,
            challengeStrength = 0,
            safetyDismissSeconds = 3,
            repeatMask = 0xFFFF,
            label = "x".repeat(200),
        ).sanitized()

        assertEquals(23, wild.hour)
        assertEquals(0, wild.minute)
        assertEquals(100, wild.volumePercent)
        assertEquals(Alarm.DEFAULT_SNOOZE, wild.snoozeMinutes)
        assertEquals(20, wild.maxSnoozeCount)
        assertEquals(1, wild.challengeStrength)
        assertEquals(15, wild.safetyDismissSeconds)
        assertEquals(Alarm.ALL_DAYS_MASK, wild.repeatMask)
        assertEquals(Alarm.MAX_LABEL_LENGTH, wild.label.length)
        assertTrue(wild.createdAt > 0)
    }
}

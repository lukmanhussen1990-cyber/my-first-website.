package com.imran.examcountdown.core

import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.time.LocalDateTime
import java.util.TimeZone

class CountdownTest {

    private val originalZone: TimeZone = TimeZone.getDefault()

    @After
    fun restoreZone() = TimeZone.setDefault(originalZone)

    private fun ist(y: Int, m: Int, d: Int, h: Int, min: Int, s: Int = 0) =
        LocalDateTime.of(y, m, d, h, min, s).atZone(Timetable.ZONE).toInstant().toEpochMilli()

    private val mil = Timetable.DEFAULT[0].startMillis

    @Test
    fun breaksDownRemainingTime() {
        assertEquals(Countdown(0, 18, 30, 0), Countdown.until(mil, ist(2026, 9, 27, 18, 0)))
        assertEquals(Countdown(1, 0, 0, 0), Countdown.until(mil, ist(2026, 9, 27, 12, 30)))
        assertEquals(Countdown(15, 4, 5, 6), Countdown.until(Timetable.DEFAULT[7].startMillis, ist(2026, 9, 27, 8, 24, 54)))
    }

    @Test
    fun roundsSecondsUpSoZeroMeansStarted() {
        assertEquals(Countdown(0, 0, 0, 1), Countdown.until(mil, mil - 1))
        assertEquals(Countdown(0, 0, 0, 1), Countdown.until(mil, mil - 1000))
        assertEquals(Countdown(0, 0, 0, 2), Countdown.until(mil, mil - 1001))
        assertTrue(Countdown.until(mil, mil).isZero)
        assertTrue("never negative", Countdown.until(mil, mil + 5_000).isZero)
    }

    @Test
    fun handlesLongCountdowns() {
        assertEquals(123L, Countdown.until(mil, mil - 123 * DAY).days)
    }

    @Test
    fun nextTickIsAlignedToTheDisplayedSecond() {
        assertEquals(300L, Countdown.delayToNextTick(mil, mil - 5_300))
        assertEquals(1_000L, Countdown.delayToNextTick(mil, mil - 5_000))
        assertEquals(1L, Countdown.delayToNextTick(mil, mil - 1))
        assertEquals(1_000L, Countdown.delayToNextTick(mil, mil + 10))
        // After waiting the returned delay the display has changed.
        val now = mil - 5_300
        val before = Countdown.until(mil, now)
        val after = Countdown.until(mil, now + Countdown.delayToNextTick(mil, now))
        assertEquals(before.seconds - 1, after.seconds)
    }

    @Test
    fun deviceTimeZoneDoesNotChangeTheCountdown() {
        val now = ist(2026, 9, 27, 18, 0)
        val results = listOf("Asia/Kolkata", "UTC", "America/New_York", "Asia/Tokyo", "Pacific/Kiritimati").map {
            TimeZone.setDefault(TimeZone.getTimeZone(it))
            Timetable.DEFAULT.map { exam -> exam.startMillis } to Countdown.until(Timetable.DEFAULT[0].startMillis, now)
        }
        assertTrue(results.all { it == results[0] })
        assertEquals(Countdown(0, 18, 30, 0), results[0].second)
    }

    @Test
    fun spokenForm() {
        assertEquals("18 hours and 30 minutes", Countdown(0, 18, 30, 0).spoken())
        assertEquals("1 day, 1 hour and 1 minute", Countdown(1, 1, 1, 0).spoken())
        assertEquals("0 minutes", Countdown(0, 0, 0, 20).spoken())
        assertEquals("2 days", Countdown(2, 0, 0, 0).spoken())
    }
}

package com.imran.examcountdown.core

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class FocusTimerTest {

    private val day = 20_000L
    private fun at(wall: Long, elapsed: Long = wall, boot: Int = 3) = Moment(wall, elapsed, boot)

    @Test
    fun startsReadyAtTwentyFiveMinutes() {
        val s = FocusState()
        assertEquals(FocusPhase.READY, FocusTimer.phase(s, at(0)))
        assertEquals(25 * MINUTE, FocusTimer.remaining(s, at(0)))
        assertEquals(5 * MINUTE, FocusMode.BREAK.durationMs)
    }

    @Test
    fun countsDownFromTimestampsEvenWhileInTheBackground() {
        val started = FocusTimer.start(FocusState(), at(1_000_000))
        assertTrue(started.running)
        // Ten minutes later (app was closed in between): computed, not ticked.
        assertEquals(15 * MINUTE, FocusTimer.remaining(started, at(1_000_000 + 10 * MINUTE)))
        assertEquals(FocusPhase.RUNNING, FocusTimer.phase(started, at(1_000_000 + 10 * MINUTE)))
        assertEquals(1_000_000 + 25 * MINUTE, FocusTimer.endsAt(started, at(1_000_000)))
    }

    @Test
    fun pauseFreezesAndResumeContinues() {
        var s = FocusTimer.start(FocusState(), at(0))
        s = FocusTimer.pause(s, at(4 * MINUTE))
        assertFalse(s.running)
        assertEquals(FocusPhase.PAUSED, FocusTimer.phase(s, at(4 * MINUTE)))
        // Time passes while paused: nothing changes.
        assertEquals(21 * MINUTE, FocusTimer.remaining(s, at(60 * MINUTE)))
        s = FocusTimer.start(s, at(60 * MINUTE))
        assertEquals(20 * MINUTE, FocusTimer.remaining(s, at(61 * MINUTE)))
    }

    @Test
    fun finishingCountsTheSessionAndOffersABreak() {
        var s = FocusTimer.start(FocusState(), at(0))
        s = FocusTimer.settle(s, at(25 * MINUTE), day)
        assertFalse(s.running)
        assertEquals(FocusMode.FOCUS, s.finished)
        assertEquals(1, s.sessionsToday)
        assertEquals(FocusPhase.FINISHED, FocusTimer.phase(s, at(25 * MINUTE)))

        s = FocusTimer.startBreak(s, at(26 * MINUTE))
        assertEquals(FocusMode.BREAK, s.mode)
        assertEquals(5 * MINUTE, FocusTimer.remaining(s, at(26 * MINUTE)))
        s = FocusTimer.settle(s, at(31 * MINUTE), day)
        assertEquals(FocusMode.BREAK, s.finished)
        assertEquals("breaks don't count as focus sessions", 1, s.sessionsToday)
    }

    @Test
    fun resetAndModeSwitch() {
        var s = FocusTimer.start(FocusState(), at(0))
        s = FocusTimer.reset(s)
        assertEquals(FocusPhase.READY, FocusTimer.phase(s, at(MINUTE)))
        assertNull(s.finished)
        s = FocusTimer.select(s, FocusMode.BREAK)
        assertEquals(5 * MINUTE, FocusTimer.remaining(s, at(MINUTE)))
    }

    @Test
    fun changingThePhoneClockDoesNotAffectARunningTimer() {
        val s = FocusTimer.start(FocusState(), at(wall = 1_000_000, elapsed = 50_000))
        // Wall clock jumps back an hour, but only 5 minutes have really passed on this boot.
        val later = at(wall = 1_000_000 - HOUR, elapsed = 50_000 + 5 * MINUTE)
        assertEquals(20 * MINUTE, FocusTimer.remaining(s, later))
    }

    @Test
    fun afterARebootTheWallClockIsUsed() {
        val s = FocusTimer.start(FocusState(), at(wall = 1_000_000, elapsed = 50_000, boot = 3))
        val rebooted = at(wall = 1_000_000 + 7 * MINUTE, elapsed = 20_000, boot = 4)
        assertEquals(18 * MINUTE, FocusTimer.remaining(s, rebooted))
    }

    @Test
    fun remainingIsAlwaysWithinTheSession() {
        val s = FocusTimer.start(FocusState(), at(wall = 1_000_000, elapsed = 50_000, boot = 3))
        assertEquals(25 * MINUTE, FocusTimer.remaining(s, at(wall = 1_000_000 - 5 * HOUR, elapsed = 1, boot = 9)))
        assertEquals(0L, FocusTimer.remaining(s, at(wall = 1_000_000 + 5 * HOUR, elapsed = 1, boot = 9)))
    }

    @Test
    fun sessionCountResetsOnANewDay() {
        var s = FocusState(sessionsToday = 3, sessionsDay = day)
        s = FocusTimer.settle(s, at(0), day + 1)
        assertEquals(0, s.sessionsToday)
    }
}

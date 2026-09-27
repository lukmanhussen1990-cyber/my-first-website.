package com.imran.examcountdown.core

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.time.LocalDateTime

class MessagesTest {

    private fun ist(y: Int, m: Int, d: Int, h: Int, min: Int) =
        LocalDateTime.of(y, m, d, h, min).atZone(Timetable.ZONE).toInstant().toEpochMilli()

    private val choices = Choices(MilLanguage.BENGALI, Elective.COMPUTER_SCIENCE)
    private fun season(now: Long) = SeasonCalculator.compute(Timetable.DEFAULT, now)

    @Test
    fun situationalMessages() {
        assertEquals("Bengali is tomorrow. Revise lightly and get a good night’s sleep.", Messages.pick(season(ist(2026, 9, 27, 18, 0)), choices))
        assertTrue(Messages.pick(season(ist(2026, 9, 28, 9, 0)), choices).startsWith("Exam day!"))
        assertEquals("Read each question calmly. You’ve got this!", Messages.pick(season(ist(2026, 9, 28, 13, 0)), choices))
        assertTrue(Messages.pick(season(ist(2026, 10, 12, 13, 0)), choices).startsWith("Last paper!"))
        assertEquals("Time to relax — you’ve earned it.", Messages.pick(season(ist(2026, 10, 13, 9, 0)), choices))
    }

    @Test
    fun tappingCyclesThroughFriendlyLines() {
        val s = season(ist(2026, 9, 27, 18, 0))
        val seen = (1..Messages.GENERAL.size).map { Messages.pick(s, choices, it) }.toSet()
        assertEquals(Messages.GENERAL.toSet(), seen)
        assertTrue("One chapter at a time. You’ve got this." in Messages.GENERAL)
    }
}

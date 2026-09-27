package com.imran.examcountdown.core

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.time.LocalDateTime

class ReminderPlannerTest {

    private fun ist(y: Int, m: Int, d: Int, h: Int, min: Int) =
        LocalDateTime.of(y, m, d, h, min).atZone(Timetable.ZONE).toInstant().toEpochMilli()

    private val on = ReminderSettings(enabled = true, dayBefore = true, hourBefore = true, armedAt = 0L)

    @Test
    fun oneDayAndOneHourBeforeEveryExam() {
        val plan = ReminderPlanner.plan(Timetable.DEFAULT, on)
        assertEquals(16, plan.size)
        assertEquals(plan.map { it.fireAt }.sorted(), plan.map { it.fireAt })
        val milDay = plan.first { it.exam.subject == Subject.MIL && it.kind == ReminderKind.DAY_BEFORE }
        assertEquals(ist(2026, 9, 27, 12, 30), milDay.fireAt)
        assertEquals("a late 'tomorrow' reminder is still useful for 6 hours", ist(2026, 9, 27, 18, 30), milDay.expiresAt)
        val milHour = plan.first { it.exam.subject == Subject.MIL && it.kind == ReminderKind.HOUR_BEFORE }
        assertEquals(ist(2026, 9, 28, 11, 30), milHour.fireAt)
        assertEquals(Timetable.DEFAULT[0].startMillis, milHour.expiresAt)
    }

    @Test
    fun disabledMeansNothing() {
        assertTrue(ReminderPlanner.plan(Timetable.DEFAULT, on.copy(enabled = false)).isEmpty())
        assertEquals(8, ReminderPlanner.plan(Timetable.DEFAULT, on.copy(dayBefore = false)).size)
    }

    @Test
    fun remindersDueBeforeSwitchingOnAreSkipped() {
        // Switched on at 8 PM the day before MIL: the 12:30 "tomorrow" reminder is not sent late.
        val armed = ist(2026, 9, 27, 20, 0)
        val plan = ReminderPlanner.plan(Timetable.DEFAULT, on.copy(armedAt = armed))
        assertTrue(ReminderPlanner.due(plan, armed + 1, emptySet(), armed).isEmpty())
        assertEquals(ist(2026, 9, 28, 11, 30), ReminderPlanner.nextFireAt(plan, armed + 1, emptySet(), armed))
    }

    @Test
    fun dueOnceAndOnlyWhileUseful() {
        val plan = ReminderPlanner.plan(Timetable.DEFAULT, on)
        val now = ist(2026, 9, 28, 11, 31)
        val due = ReminderPlanner.due(plan, now, emptySet(), 0L)
        assertEquals(listOf(ReminderKind.HOUR_BEFORE), due.map { it.kind })
        assertTrue("delivered reminders aren't repeated", ReminderPlanner.due(plan, now, due.map { it.key }.toSet(), 0L).isEmpty())
        assertTrue("stale once the exam starts", ReminderPlanner.due(plan, ist(2026, 9, 28, 12, 31), emptySet(), 0L).none { it.exam.subject == Subject.MIL })
    }

    @Test
    fun editingAnExamMakesNewReminders() {
        val moved = Timetable.DEFAULT.map { if (it.subject == Subject.MIL) it.copy(start = java.time.LocalTime.of(10, 0)) else it }
        val before = ReminderPlanner.plan(Timetable.DEFAULT, on).map { it.key }.toSet()
        val after = ReminderPlanner.plan(moved, on).map { it.key }.toSet()
        assertTrue(before != after)
    }

    @Test
    fun inexactWakeUpsConvergeWithoutOvershooting() {
        val target = ist(2026, 10, 5, 11, 30)
        var now = ist(2026, 9, 27, 18, 0)
        var steps = 0
        while (true) {
            val wake = ReminderPlanner.wakeAt(target, now, exact = false)
            assertTrue(wake <= target)
            steps++
            if (wake == target) break
            // Worst case for an inexact alarm: 75% of its lead time late (but still before the target here).
            now = wake + (wake - now) * 3 / 4
            assertTrue(now < target)
        }
        assertTrue("about a dozen wake-ups over a week", steps in 5..20)
        assertEquals(target, ReminderPlanner.wakeAt(target, target - MINUTE, exact = false))
        assertEquals(target, ReminderPlanner.wakeAt(target, target - 3 * DAY, exact = true))
    }
}

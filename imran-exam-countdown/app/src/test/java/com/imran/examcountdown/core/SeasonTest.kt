package com.imran.examcountdown.core

import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.LocalTime
import java.util.TimeZone

class SeasonTest {

    private val originalZone: TimeZone = TimeZone.getDefault()

    @After
    fun restoreZone() = TimeZone.setDefault(originalZone)

    private fun ist(y: Int, m: Int, d: Int, h: Int, min: Int, s: Int = 0) =
        LocalDateTime.of(y, m, d, h, min, s).atZone(Timetable.ZONE).toInstant().toEpochMilli()

    private fun season(now: Long, exams: List<Exam> = Timetable.DEFAULT, done: Set<String> = emptySet()) =
        SeasonCalculator.compute(exams, now, done)

    private fun withDuration(subject: Subject, minutes: Int?) =
        Timetable.DEFAULT.map { if (it.subject == subject) it.copy(durationMinutes = minutes) else it }

    @Test
    fun beforeTheFirstExam() {
        val s = season(ist(2026, 9, 27, 18, 0))
        assertEquals(Subject.MIL, s.next?.exam?.subject)
        assertNull(s.live)
        assertEquals(0, s.completed)
        assertEquals(0f, s.progress)
        assertFalse(s.isOver)
        assertTrue(s.exams.all { it.phase == Phase.UPCOMING })
        assertTrue(s.ringFraction() in 0.8f..0.95f)
        assertEquals("MIL is tomorrow", false, s.exams[0].isToday)
    }

    @Test
    fun examDayMorningIsTodayButUpcoming() {
        val s = season(ist(2026, 9, 28, 9, 0))
        assertEquals(Phase.UPCOMING, s.exams[0].phase)
        assertTrue(s.exams[0].isToday)
        assertEquals(Subject.MIL, s.next?.exam?.subject)
    }

    @Test
    fun whenAnExamStartsItIsLiveAndTheFollowingExamIsNext() {
        val s = season(ist(2026, 9, 28, 12, 30))
        assertEquals(Subject.MIL, s.live?.exam?.subject)
        assertEquals(Phase.LIVE, s.exams[0].phase)
        assertEquals(Subject.ENGLISH_1, s.next?.exam?.subject)
        assertEquals(0, s.completed)
    }

    @Test
    fun withoutAConfirmedDurationTheExamIsNeverClaimedEndedThatDay() {
        // Even after the 3:30 PM session window, nothing says this paper has ended.
        for (time in listOf(ist(2026, 9, 28, 14, 1), ist(2026, 9, 28, 15, 31), ist(2026, 9, 28, 23, 59, 59))) {
            val s = season(time)
            assertEquals(Phase.LIVE, s.exams[0].phase)
            assertEquals(0, s.completed)
        }
    }

    @Test
    fun completedOnceTheDateHasPassed() {
        val s = season(ist(2026, 9, 29, 0, 0))
        assertEquals(Phase.DONE, s.exams[0].phase)
        assertEquals(DoneReason.DATE_PASSED, s.exams[0].doneReason)
        assertNull(s.live)
        assertEquals(1, s.completed)
        assertEquals(1f / 8, s.progress)
    }

    @Test
    fun confirmedDurationEndsTheExam() {
        val exams = withDuration(Subject.MIL, Timetable.CORE_MINUTES)
        assertEquals(Phase.LIVE, season(ist(2026, 9, 28, 15, 29, 59), exams).exams[0].phase)
        val after = season(ist(2026, 9, 28, 15, 30), exams)
        assertEquals(Phase.DONE, after.exams[0].phase)
        assertEquals(DoneReason.DURATION_ENDED, after.exams[0].doneReason)
        assertTrue(after.exams[0].isToday)
        assertEquals(Subject.MIL, after.finishedToday?.exam?.subject)

        val short = withDuration(Subject.MIL, Timetable.NON_CORE_MINUTES)
        assertEquals(Phase.DONE, season(ist(2026, 9, 28, 14, 0), short).exams[0].phase)
    }

    @Test
    fun markingFinishedEndsTheExam() {
        val key = Timetable.DEFAULT[0].key
        val s = season(ist(2026, 9, 28, 13, 45), done = setOf(key))
        assertEquals(Phase.DONE, s.exams[0].phase)
        assertEquals(DoneReason.MARKED_DONE, s.exams[0].doneReason)
        assertNull(s.live)
        // A mark made before the exam doesn't count.
        assertEquals(Phase.UPCOMING, season(ist(2026, 9, 28, 11, 0), done = setOf(key)).exams[0].phase)
    }

    @Test
    fun editingAnExamInvalidatesItsFinishedMark() {
        val key = Timetable.DEFAULT[0].key
        val moved = Timetable.DEFAULT.map { if (it.subject == Subject.MIL) it.copy(start = LocalTime.of(13, 0)) else it }
        assertEquals(Phase.LIVE, season(ist(2026, 9, 28, 13, 45), moved, setOf(key)).exams[0].phase)
    }

    @Test
    fun midSeasonProgress() {
        val s = season(ist(2026, 10, 6, 10, 0))
        assertEquals(4, s.completed)
        assertEquals(0.5f, s.progress)
        assertEquals(Subject.GENERAL_MATHEMATICS, s.next?.exam?.subject)
        val fraction = s.ringFraction()
        val expected = (ist(2026, 10, 6, 10, 0) - Timetable.DEFAULT[3].startMillis).toFloat() /
            (Timetable.DEFAULT[4].startMillis - Timetable.DEFAULT[3].startMillis)
        assertEquals(expected, fraction, 0.0001f)
    }

    @Test
    fun finalExamThenCelebration() {
        val live = season(ist(2026, 10, 12, 13, 0))
        assertEquals(Subject.ELECTIVE, live.live?.exam?.subject)
        assertNull(live.next)
        assertTrue(live.isFinalLive)
        assertFalse(live.isOver)
        assertEquals(7, live.completed)

        val over = season(ist(2026, 10, 13, 0, 0))
        assertTrue(over.isOver)
        assertEquals(8, over.completed)
        assertEquals(1f, over.progress)
        assertNull(over.next)
        assertNull(over.live)

        // With a confirmed duration the celebration starts as soon as the paper ends.
        val timed = withDuration(Subject.ELECTIVE, Timetable.NON_CORE_MINUTES)
        assertFalse(season(ist(2026, 10, 12, 13, 59), timed).isOver)
        assertTrue(season(ist(2026, 10, 12, 14, 0), timed).isOver)
        // Or when Imran marks it finished.
        assertTrue(season(ist(2026, 10, 12, 15, 0), done = setOf(Timetable.DEFAULT[7].key)).isOver)
    }

    @Test
    fun aLaterExamStartingEndsAnEarlierUnconfirmedOne() {
        val sameDay = Timetable.DEFAULT.map {
            when (it.subject) {
                Subject.ENGLISH_1 -> it.copy(date = LocalDate.of(2026, 9, 28), start = LocalTime.of(9, 0))
                else -> it
            }
        }
        val s = season(ist(2026, 9, 28, 12, 45), sameDay)
        assertEquals(Subject.MIL, s.live?.exam?.subject)
        val english = s.exams.first { it.exam.subject == Subject.ENGLISH_1 }
        assertEquals(Phase.DONE, english.phase)
        assertEquals(DoneReason.NEXT_STARTED, english.doneReason)
    }

    @Test
    fun todayIsJudgedInIndiaWhateverTheDeviceZone() {
        // 00:30 IST on 28 Sep is still 27 Sep in UTC and in New York.
        val now = ist(2026, 9, 28, 0, 30)
        for (zone in listOf("UTC", "America/New_York", "Asia/Kolkata")) {
            TimeZone.setDefault(TimeZone.getTimeZone(zone))
            assertTrue(zone, season(now).exams[0].isToday)
        }
    }

    @Test
    fun nextChangeFindsTheNextBoundary() {
        val now = ist(2026, 9, 28, 10, 0)
        assertEquals(Timetable.DEFAULT[0].startMillis, SeasonCalculator.nextChange(Timetable.DEFAULT, now))
        val afterStart = ist(2026, 9, 28, 13, 0)
        assertEquals(ist(2026, 9, 29, 0, 0), SeasonCalculator.nextChange(Timetable.DEFAULT, afterStart))
        val timed = withDuration(Subject.MIL, 90)
        assertEquals(ist(2026, 9, 28, 14, 0), SeasonCalculator.nextChange(timed, afterStart))
    }
}

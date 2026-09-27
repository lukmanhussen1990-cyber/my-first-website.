package com.imran.examcountdown.core

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import java.time.Instant
import java.time.LocalDate
import java.time.LocalTime

class TimetableTest {

    private val expected = listOf(
        "2026-09-28" to Subject.MIL,
        "2026-09-30" to Subject.ENGLISH_1,
        "2026-10-03" to Subject.SOCIAL_SCIENCE,
        "2026-10-05" to Subject.GENERAL_SCIENCE,
        "2026-10-07" to Subject.GENERAL_MATHEMATICS,
        "2026-10-08" to Subject.ENGLISH_2,
        "2026-10-10" to Subject.MORAL_SCIENCE,
        "2026-10-12" to Subject.ELECTIVE,
    )

    @Test
    fun matchesTheClassEightTimetableExactly() {
        assertEquals(8, Timetable.DEFAULT.size)
        Timetable.DEFAULT.zip(expected).forEach { (exam, want) ->
            assertEquals(LocalDate.parse(want.first), exam.date)
            assertEquals(want.second, exam.subject)
            assertEquals(LocalTime.of(12, 30), exam.start)
            assertEquals("no invented durations", null, exam.durationMinutes)
        }
    }

    @Test
    fun officialNames() {
        assertEquals(
            listOf(
                "MIL (Bengali / Hindi)", "English-I", "Social Science", "General Science",
                "General Mathematics", "English-II", "Moral Science",
                "Elective (Advanced Mathematics / Computer Science / Arabic)",
            ),
            Timetable.DEFAULT.map { it.title(Choices()) },
        )
    }

    @Test
    fun blankClassEightDatesHaveNoExam() {
        val dates = Timetable.DEFAULT.map { it.date }.toSet()
        listOf("2026-09-29", "2026-10-01", "2026-10-02", "2026-10-04", "2026-10-06", "2026-10-09", "2026-10-11")
            .forEach { assertFalse("$it must be empty", LocalDate.parse(it) in dates) }
    }

    @Test
    fun startsAreHalfPastTwelveIndiaTime() {
        // 12:30 IST is 07:00 UTC; India has no daylight saving.
        assertEquals(Instant.parse("2026-09-28T07:00:00Z").toEpochMilli(), Timetable.DEFAULT[0].startMillis)
        assertEquals(Instant.parse("2026-10-12T07:00:00Z").toEpochMilli(), Timetable.DEFAULT[7].startMillis)
        Timetable.DEFAULT.forEach {
            val utc = Instant.ofEpochMilli(it.startMillis).atZone(java.time.ZoneOffset.UTC)
            assertEquals(7, utc.hour)
            assertEquals(0, utc.minute)
        }
    }

    @Test
    fun defaultIsChronological() {
        val starts = Timetable.DEFAULT.map { it.startMillis }
        assertEquals(starts.sorted(), starts)
        assertTrue(starts.zipWithNext().all { (a, b) -> a < b })
    }

    @Test
    fun sortingFollowsEditedDates() {
        val edited = Timetable.DEFAULT.map {
            if (it.subject == Subject.MORAL_SCIENCE) it.copy(date = LocalDate.of(2026, 9, 29)) else it
        }
        assertEquals(
            listOf(Subject.MIL, Subject.MORAL_SCIENCE, Subject.ENGLISH_1),
            Timetable.sorted(edited).take(3).map { it.subject },
        )
        // Same day: earlier start first.
        val sameDay = listOf(
            Exam(Subject.ENGLISH_2, LocalDate.of(2026, 10, 8), LocalTime.of(14, 0)),
            Exam(Subject.ENGLISH_1, LocalDate.of(2026, 10, 8), LocalTime.of(9, 0)),
        )
        assertEquals(listOf(Subject.ENGLISH_1, Subject.ENGLISH_2), Timetable.sorted(sameDay).map { it.subject })
    }

    @Test
    fun titlesFollowChoices() {
        val c = Choices(MilLanguage.HINDI, Elective.COMPUTER_SCIENCE)
        assertEquals("MIL (Hindi)", Timetable.DEFAULT[0].title(c))
        assertEquals("Elective (Computer Science)", Timetable.DEFAULT[7].title(c))
        assertEquals("Hindi", Timetable.DEFAULT[0].headline(c))
        assertEquals("Computer Science", Timetable.DEFAULT[7].headline(c))
        assertEquals("Elective", Timetable.DEFAULT[7].kicker(c))
        assertEquals("MIL (Bengali)", Timetable.DEFAULT[0].title(Choices(mil = MilLanguage.BENGALI)))
        assertEquals("Elective (Advanced Mathematics)", Timetable.DEFAULT[7].title(Choices(elective = Elective.ADVANCED_MATHEMATICS)))
        assertEquals("Elective (Arabic)", Timetable.DEFAULT[7].title(Choices(elective = Elective.ARABIC)))
    }

    @Test
    fun durationLabels() {
        assertEquals("Not confirmed", Timetable.durationLabel(null))
        assertEquals("1½ hours (non-core)", Timetable.durationLabel(90))
        assertEquals("3 hours (core)", Timetable.durationLabel(180))
        assertEquals("1 hour", Timetable.durationLabel(60))
        assertEquals("2 hours", Timetable.durationLabel(120))
        assertEquals("2½ hours", Timetable.durationLabel(150))
    }

    @Test
    fun profileDefaults() {
        val p = Profile()
        assertEquals("Imran Hussain", p.name)
        assertEquals("Al-Ameen Academy, Badarpur", p.school)
        assertEquals("VIII Blue", p.className)
        assertEquals("47", p.roll)
        assertEquals("24", p.hall)
        assertEquals("Half-Yearly 2026–2027", p.examination)
        assertEquals("Imran", p.firstName)
        assertEquals("IH", p.initials)
        assertEquals("", Profile(name = "  ").firstName)
    }
}

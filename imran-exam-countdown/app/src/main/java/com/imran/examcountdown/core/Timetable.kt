package com.imran.examcountdown.core

import java.time.LocalDate
import java.time.LocalTime
import java.time.ZoneId

/** The official Class VIII timetable for the Half-Yearly Examination 2026–2027. */
object Timetable {
    val ZONE: ZoneId = ZoneId.of("Asia/Kolkata")

    /** Every Class VIII paper starts at 12:30 PM India time. */
    val START_TIME: LocalTime = LocalTime.of(12, 30)

    /** End of the Class VIII session window printed on the timetable. */
    val SESSION_END: LocalTime = LocalTime.of(15, 30)

    const val CORE_MINUTES = 180
    const val NON_CORE_MINUTES = 90

    /**
     * Only dates with an entry in the Class VIII column. Dates left blank for Class VIII
     * (29 Sep, 1–2 Oct, 4 Oct, 6 Oct, 9 Oct, 11 Oct) have no exam.
     */
    val DEFAULT: List<Exam> = listOf(
        exam(Subject.MIL, 2026, 9, 28),
        exam(Subject.ENGLISH_1, 2026, 9, 30),
        exam(Subject.SOCIAL_SCIENCE, 2026, 10, 3),
        exam(Subject.GENERAL_SCIENCE, 2026, 10, 5),
        exam(Subject.GENERAL_MATHEMATICS, 2026, 10, 7),
        exam(Subject.ENGLISH_2, 2026, 10, 8),
        exam(Subject.MORAL_SCIENCE, 2026, 10, 10),
        exam(Subject.ELECTIVE, 2026, 10, 12),
    )

    /** Duration choices offered in Settings; null means "not confirmed". */
    val DURATION_CHOICES: List<Int?> = listOf(null, 60, NON_CORE_MINUTES, 120, 150, CORE_MINUTES)

    const val SESSION_NOTE = "Class VIII session: 12:30 PM – 3:30 PM (India time)."
    const val DURATION_NOTE = "The timetable gives 3 hours for core subjects and 1½ hours for " +
        "non-core subjects, but doesn't say which subjects are core. The app never guesses an " +
        "end time: set a duration in Settings once it's confirmed."

    fun sorted(exams: List<Exam>): List<Exam> =
        exams.sortedWith(compareBy<Exam>({ it.startMillis }, { it.subject.ordinal }))

    fun default(subject: Subject): Exam = DEFAULT.first { it.subject == subject }

    fun durationLabel(minutes: Int?): String = when (minutes) {
        null -> "Not confirmed"
        NON_CORE_MINUTES -> "1½ hours (non-core)"
        CORE_MINUTES -> "3 hours (core)"
        else -> {
            val h = minutes / 60
            val m = minutes % 60
            when {
                h == 0 -> "$m min"
                m == 0 -> if (h == 1) "1 hour" else "$h hours"
                m == 30 -> "$h½ hours"
                else -> "$h h $m min"
            }
        }
    }

    private fun exam(subject: Subject, year: Int, month: Int, day: Int) =
        Exam(subject, LocalDate.of(year, month, day), START_TIME)
}

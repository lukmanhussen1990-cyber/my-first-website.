package com.imran.examcountdown.core

import java.time.LocalDate
import java.time.LocalTime
import java.time.ZonedDateTime

const val SECOND = 1_000L
const val MINUTE = 60 * SECOND
const val HOUR = 60 * MINUTE
const val DAY = 24 * HOUR

/** Language for the MIL (Modern Indian Language) paper. */
enum class MilLanguage(val label: String, val nativeLabel: String) {
    BENGALI("Bengali", "বাংলা"),
    HINDI("Hindi", "हिन्दी"),
}

enum class Elective(val label: String, val shortLabel: String) {
    ADVANCED_MATHEMATICS("Advanced Mathematics", "Adv. Maths"),
    COMPUTER_SCIENCE("Computer Science", "Comp. Sci."),
    ARABIC("Arabic", "Arabic"),
}

/** The eight Class VIII papers, named as on the timetable. */
enum class Subject(val officialName: String) {
    MIL("MIL (Bengali / Hindi)"),
    ENGLISH_1("English-I"),
    SOCIAL_SCIENCE("Social Science"),
    GENERAL_SCIENCE("General Science"),
    GENERAL_MATHEMATICS("General Mathematics"),
    ENGLISH_2("English-II"),
    MORAL_SCIENCE("Moral Science"),
    ELECTIVE("Elective (Advanced Mathematics / Computer Science / Arabic)"),
}

/** How much animation to show. SYSTEM follows Android's "Remove animations" setting. */
enum class MotionPref(val label: String) { SYSTEM("System"), REDUCED("Reduced"), FULL("Full") }

/** Light or dark appearance. SYSTEM follows the phone's dark theme setting. */
enum class ThemeMode(val label: String) { SYSTEM("System"), LIGHT("Light"), DARK("Dark") }

data class Choices(val mil: MilLanguage? = null, val elective: Elective? = null) {
    val complete: Boolean get() = mil != null && elective != null
}

data class Profile(
    val name: String = "Imran Hussain",
    val school: String = "Al-Ameen Academy, Badarpur",
    val className: String = "VIII Blue",
    val roll: String = "47",
    val hall: String = "24",
    val examination: String = "Half-Yearly 2026–2027",
) {
    private val words: List<String> get() = name.trim().split(Regex("\\s+")).filter { it.isNotEmpty() }

    val firstName: String get() = words.firstOrNull().orEmpty()

    val initials: String
        get() = words.take(2).joinToString("") { it.first().uppercaseChar().toString() }.ifEmpty { "?" }
}

/**
 * One sitting of the timetable. [date] and [start] are wall-clock values in India
 * ([Timetable.ZONE]); every instant is derived from them so the device's own time
 * zone never shifts an exam.
 */
data class Exam(
    val subject: Subject,
    val date: LocalDate,
    val start: LocalTime,
    /** Confirmed length in minutes, or null while it is unconfirmed. */
    val durationMinutes: Int? = null,
) {
    val startMillis: Long
        get() = ZonedDateTime.of(date, start, Timetable.ZONE).toInstant().toEpochMilli()

    val confirmedEndMillis: Long?
        get() = durationMinutes?.let { startMillis + it * MINUTE }

    /** Midnight in India at the end of the exam's date. */
    val dayEndMillis: Long
        get() = date.plusDays(1).atStartOfDay(Timetable.ZONE).toInstant().toEpochMilli()

    /** Identifies this sitting; it changes whenever the date or start time is edited. */
    val key: String get() = "${subject.name}@$startMillis"

    /** Full name, e.g. "MIL (Bengali)" or "Elective (Computer Science)". */
    fun title(choices: Choices): String = when (subject) {
        Subject.MIL -> choices.mil?.let { "MIL (${it.label})" } ?: subject.officialName
        Subject.ELECTIVE -> choices.elective?.let { "Elective (${it.label})" } ?: subject.officialName
        else -> subject.officialName
    }

    /** Large display name, e.g. "Computer Science" (paired with [kicker]). */
    fun headline(choices: Choices): String = when (subject) {
        Subject.MIL -> choices.mil?.label ?: "MIL"
        Subject.ELECTIVE -> choices.elective?.label ?: "Elective"
        else -> subject.officialName
    }

    /** Small label shown above [headline], if any. */
    fun kicker(choices: Choices): String? = when (subject) {
        Subject.MIL -> if (choices.mil != null) "MIL" else "Bengali / Hindi"
        Subject.ELECTIVE -> if (choices.elective != null) "Elective" else "Adv. Maths / Comp. Sci. / Arabic"
        else -> null
    }
}

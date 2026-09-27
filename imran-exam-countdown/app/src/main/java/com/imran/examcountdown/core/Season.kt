package com.imran.examcountdown.core

import java.time.Instant
import java.time.LocalDate

enum class Phase { UPCOMING, LIVE, DONE }

/** Why an exam counts as done. Without one of these the app never claims an exam has ended. */
enum class DoneReason {
    /** A duration was confirmed in Settings and it has elapsed. */
    DURATION_ENDED,

    /** Imran tapped "Mark as finished". */
    MARKED_DONE,

    /** A later exam has already started. */
    NEXT_STARTED,

    /** The exam's date is over (India time). */
    DATE_PASSED,
}

data class ExamStatus(
    val exam: Exam,
    val phase: Phase,
    /** The exam's date is today in India. */
    val isToday: Boolean,
    val doneReason: DoneReason? = null,
) {
    val startMillis: Long get() = exam.startMillis
}

/** Snapshot of the whole exam season at [now]. */
data class Season(
    val now: Long,
    /** Chronological order. */
    val exams: List<ExamStatus>,
    /** The exam in progress (started, end not confirmed), if any. */
    val live: ExamStatus?,
    /** The next exam that hasn't started yet, if any. */
    val next: ExamStatus?,
) {
    val total: Int get() = exams.size
    val completed: Int get() = exams.count { it.phase == Phase.DONE }
    val progress: Float get() = if (total == 0) 0f else completed.toFloat() / total

    /** True once every exam is done: time to celebrate. */
    val isOver: Boolean get() = total > 0 && completed == total

    /** The final exam is in progress. */
    val isFinalLive: Boolean get() = live != null && next == null

    /** [next] is the last exam of the season. */
    val nextIsFinal: Boolean get() = next != null && next == exams.last()

    /** An exam that finished earlier today, for "one down" messages. */
    val finishedToday: ExamStatus?
        get() = exams.lastOrNull { it.phase == Phase.DONE && it.isToday && live == null }

    /**
     * Fraction of the countdown ring to fill for [next]: time elapsed since the previous
     * exam started (or since a week before the first exam) out of the whole gap.
     */
    fun ringFraction(): Float {
        val target = next ?: return if (isOver || live != null) 1f else 0f
        val index = exams.indexOf(target)
        val from = exams.getOrNull(index - 1)?.startMillis ?: (target.startMillis - 7 * DAY)
        val span = (target.startMillis - from).coerceAtLeast(1L)
        return ((now - from).toFloat() / span).coerceIn(0f, 1f)
    }
}

object SeasonCalculator {

    fun compute(exams: List<Exam>, now: Long, markedDone: Set<String> = emptySet()): Season {
        val today = todayInIndia(now)
        val raw = Timetable.sorted(exams).map { status(it, now, today, markedDone) }
        // Someone can't sit two papers at once: once a later exam has started, an earlier
        // exam still waiting for confirmation is over.
        val statuses = raw.mapIndexed { i, s ->
            val laterStarted = raw.drop(i + 1).any { it.phase != Phase.UPCOMING }
            if (s.phase == Phase.LIVE && laterStarted) s.copy(phase = Phase.DONE, doneReason = DoneReason.NEXT_STARTED) else s
        }
        return Season(
            now = now,
            exams = statuses,
            live = statuses.lastOrNull { it.phase == Phase.LIVE },
            next = statuses.firstOrNull { it.phase == Phase.UPCOMING },
        )
    }

    fun status(exam: Exam, now: Long, today: LocalDate, markedDone: Set<String>): ExamStatus {
        val isToday = exam.date == today
        if (now < exam.startMillis) return ExamStatus(exam, Phase.UPCOMING, isToday)
        if (exam.key in markedDone) return ExamStatus(exam, Phase.DONE, isToday, DoneReason.MARKED_DONE)
        val end = exam.confirmedEndMillis
        return when {
            end != null && now >= end -> ExamStatus(exam, Phase.DONE, isToday, DoneReason.DURATION_ENDED)
            end != null -> ExamStatus(exam, Phase.LIVE, isToday)
            now >= exam.dayEndMillis -> ExamStatus(exam, Phase.DONE, isToday, DoneReason.DATE_PASSED)
            else -> ExamStatus(exam, Phase.LIVE, isToday)
        }
    }

    /** The next instant after [now] at which [compute] could return a different state. */
    fun nextChange(exams: List<Exam>, now: Long): Long? {
        val candidates = mutableListOf(nextMidnightInIndia(now))
        for (exam in exams) {
            candidates += exam.startMillis
            candidates += exam.dayEndMillis
            exam.confirmedEndMillis?.let { candidates += it }
        }
        return candidates.filter { it > now }.minOrNull()
    }

    fun todayInIndia(now: Long): LocalDate = Instant.ofEpochMilli(now).atZone(Timetable.ZONE).toLocalDate()

    fun nextMidnightInIndia(now: Long): Long =
        todayInIndia(now).plusDays(1).atStartOfDay(Timetable.ZONE).toInstant().toEpochMilli()
}

/** Days, hours, minutes and seconds until a target. Seconds are rounded up. */
data class Countdown(val days: Long, val hours: Int, val minutes: Int, val seconds: Int) {

    val isZero: Boolean get() = days == 0L && hours == 0 && minutes == 0 && seconds == 0

    /** Screen-reader friendly, e.g. "1 day, 4 hours and 3 minutes". */
    fun spoken(): String {
        val parts = mutableListOf<String>()
        if (days > 0) parts += plural(days, "day")
        if (hours > 0) parts += plural(hours.toLong(), "hour")
        if (minutes > 0 || parts.isEmpty()) parts += plural(minutes.toLong(), "minute")
        return if (parts.size == 1) parts[0] else parts.dropLast(1).joinToString(", ") + " and " + parts.last()
    }

    companion object {
        /**
         * Rounding up means the display only reads 00:00:00:00 at the exact moment the exam
         * starts, which is also when the app switches to "It's exam time!".
         */
        fun until(target: Long, now: Long): Countdown {
            val ms = (target - now).coerceAtLeast(0L)
            val total = (ms + 999) / 1000
            return Countdown(
                days = total / 86_400,
                hours = ((total % 86_400) / 3_600).toInt(),
                minutes = ((total % 3_600) / 60).toInt(),
                seconds = (total % 60).toInt(),
            )
        }

        /** Milliseconds until the displayed countdown to [target] changes. */
        fun delayToNextTick(target: Long, now: Long): Long {
            val ms = target - now
            if (ms <= 0) return 1000
            val rest = ms % 1000
            return if (rest == 0L) 1000 else rest
        }

        private fun plural(n: Long, word: String) = if (n == 1L) "1 $word" else "$n ${word}s"
    }
}

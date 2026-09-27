package com.imran.examcountdown.core

enum class ReminderKind { DAY_BEFORE, HOUR_BEFORE }

data class ReminderSettings(
    /** Exam reminders switched on. */
    val enabled: Boolean = false,
    val dayBefore: Boolean = true,
    val hourBefore: Boolean = true,
    /** Notify when a focus session or break ends while the app is in the background. */
    val focusAlerts: Boolean = false,
    /** When exam reminders were last switched on; anything due before that is skipped. */
    val armedAt: Long = 0L,
)

data class Reminder(
    val exam: Exam,
    val kind: ReminderKind,
    val fireAt: Long,
    /** A reminder delivered late (phone off, Doze) is still shown until this time. */
    val expiresAt: Long,
) {
    val key: String get() = "${kind.name}:${exam.key}"
}

object ReminderPlanner {
    /** A late "tomorrow" reminder is still useful for a few hours. */
    const val DAY_BEFORE_GRACE = 6 * HOUR

    /** Inside this window the alarm is set for the exact target time. */
    const val FINAL_APPROACH = 4 * MINUTE

    fun plan(exams: List<Exam>, settings: ReminderSettings): List<Reminder> {
        if (!settings.enabled) return emptyList()
        val out = ArrayList<Reminder>()
        for (exam in exams) {
            val start = exam.startMillis
            if (settings.dayBefore) {
                val fireAt = start - DAY
                val handOver = if (settings.hourBefore) start - HOUR else start
                out += Reminder(exam, ReminderKind.DAY_BEFORE, fireAt, minOf(fireAt + DAY_BEFORE_GRACE, handOver))
            }
            if (settings.hourBefore) {
                out += Reminder(exam, ReminderKind.HOUR_BEFORE, start - HOUR, start)
            }
        }
        return out.sortedBy { it.fireAt }
    }

    /** Reminders to show now. */
    fun due(plan: List<Reminder>, now: Long, delivered: Set<String>, armedAt: Long): List<Reminder> =
        plan.filter { it.fireAt in armedAt..now && now < it.expiresAt && it.key !in delivered }

    /** When the next reminder should appear, or null if none is left. */
    fun nextFireAt(plan: List<Reminder>, now: Long, delivered: Set<String>, armedAt: Long): Long? =
        plan.filter { it.fireAt > now && it.fireAt >= armedAt && it.key !in delivered }.minOfOrNull { it.fireAt }

    /**
     * When to wake up for [target]. Exact alarms go straight to the target. Inexact alarms
     * may arrive late by a fraction of their lead time, so the app wakes at halfway points
     * and re-arms, keeping the final alarm within a few minutes of the target.
     */
    fun wakeAt(target: Long, now: Long, exact: Boolean): Long = when {
        exact || target - now <= FINAL_APPROACH -> target
        else -> now + (target - now) / 2
    }
}

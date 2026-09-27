package com.imran.examcountdown.core

object Messages {

    val GENERAL = listOf(
        "One chapter at a time. You’ve got this.",
        "Small steps every day add up to big results.",
        "Revise, rest, repeat. A steady rhythm beats cramming.",
        "Progress, not perfection.",
        "You’ve prepared more than you think.",
        "Focus on today’s topic. Tomorrow can wait.",
        "Short breaks help revision stick.",
        "Every page you revise is a step forward.",
        "A good night’s sleep helps you remember what you learned.",
        "Stay calm, stay curious, keep going.",
    )

    /**
     * A friendly line for the moment. With [offset] 0 a situation-specific message wins;
     * tapping the card increases [offset] to cycle through the general ones.
     */
    fun pick(season: Season, choices: Choices, offset: Int = 0): String {
        if (offset == 0) special(season, choices)?.let { return it }
        val base = (season.now / (3 * HOUR)).mod(GENERAL.size.toLong()).toInt()
        return GENERAL[(base + offset).mod(GENERAL.size)]
    }

    private fun special(season: Season, choices: Choices): String? {
        val next = season.next
        val tomorrow = SeasonCalculator.todayInIndia(season.now).plusDays(1)
        val finished = season.finishedToday
        return when {
            season.isOver -> "Time to relax — you’ve earned it."
            season.isFinalLive -> "Last paper! Read every question carefully and finish strong."
            season.live != null -> "Read each question calmly. You’ve got this!"
            next == null -> null
            next.isToday -> "Exam day! Eat well, reach early and read every question carefully."
            finished != null ->
                "${season.completed} done, ${season.total - season.completed} to go. " +
                    "Rest a little, then look over ${next.exam.headline(choices)}."
            next.exam.date == tomorrow ->
                "${next.exam.headline(choices)} is tomorrow. Revise lightly and get a good night’s sleep."
            season.nextIsFinal -> "Just one to go. Finish strong!"
            else -> null
        }
    }
}

package com.imran.jarvis.actions

import kotlin.math.roundToInt

data class AlarmSpec(val hour: Int, val minute: Int, val label: String)

/** Understands the alarm times and timer lengths the AI writes in its "target". */
object TimeParsing {

    private val CLOCK = Regex("""(\d{1,2})\s*[:.]\s*(\d{2})\s*(a\.?m\.?|p\.?m\.?)?""")
    private val HOUR_AMPM = Regex("""(\d{1,2})\s*(a\.?m\.?|p\.?m\.?)""")
    private val HOUR_ONLY = Regex("""^\s*(\d{1,2})\s*(?:baje|बजे|o'?clock)?\s*$""")

    /**
     * Accepts "06:30", "6:30 pm", "7 am", "19.45", or just "7". An optional label may follow a pipe:
     * "06:30 | gym". Returns null when no valid time can be found.
     */
    fun parseAlarm(target: String): AlarmSpec? {
        val label = target.substringAfter('|', "").trim()
        val text = target.substringBefore('|').trim().lowercase()

        CLOCK.find(text)?.let { m ->
            return build(m.groupValues[1].toInt(), m.groupValues[2].toInt(), m.groupValues[3], label)
        }
        HOUR_AMPM.find(text)?.let { m ->
            return build(m.groupValues[1].toInt(), 0, m.groupValues[2], label)
        }
        HOUR_ONLY.find(text)?.let { m ->
            return build(m.groupValues[1].toInt(), 0, "", label)
        }
        return null
    }

    private fun build(hour: Int, minute: Int, meridiem: String, label: String): AlarmSpec? {
        if (minute !in 0..59) return null
        val hour24 = when {
            meridiem.isEmpty() -> hour.takeIf { it in 0..23 }
            hour !in 1..12 -> null
            meridiem.startsWith("a") -> if (hour == 12) 0 else hour
            else -> if (hour == 12) 12 else hour + 12
        } ?: return null
        return AlarmSpec(hour24, minute, label)
    }

    private const val MAX_TIMER_SECONDS = 24 * 60 * 60

    private val UNIT = Regex(
        """(\d+(?:[.,]\d+)?)\s*(hours?|hrs?|h|घंटे|घण्टे|घंटा|minutes?|mins?|m|मिनट|seconds?|secs?|s|सेकंड|सेकण्ड|सेकेंड)(?![a-z])""",
    )

    /**
     * Accepts a plain number of seconds ("300") or words with units ("5 minutes", "1 hour 30 min",
     * "90 sec", "2 घंटे"). Returns the length in seconds (1 to 24 hours), or null if not understood.
     */
    fun parseTimerSeconds(target: String): Int? {
        val text = target.trim().lowercase().replace(',', '.')
        if (text.isEmpty()) return null

        text.toDoubleOrNull()?.let { return clamp(it) }

        var total = 0.0
        var found = false
        for (m in UNIT.findAll(text)) {
            val amount = m.groupValues[1].toDoubleOrNull() ?: continue
            val unit = m.groupValues[2]
            total += amount * when {
                unit.startsWith("h") || unit.startsWith("घ") -> 3600
                unit.startsWith("m") || unit.startsWith("मि") -> 60
                else -> 1
            }
            found = true
        }
        return if (found) clamp(total) else null
    }

    private fun clamp(seconds: Double): Int? {
        val rounded = seconds.roundToInt()
        return if (rounded < 1) null else rounded.coerceAtMost(MAX_TIMER_SECONDS)
    }
}

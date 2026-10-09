package com.loe.chat.ai

data class SseEvent(val event: String?, val data: String)

/**
 * Minimal Server-Sent Events parser. Feed it one line at a time (without the newline);
 * it returns an event whenever a blank line completes one.
 */
class SseParser {
    private var eventName: String? = null
    private val data = StringBuilder()
    private var hasData = false

    fun feed(line: String): SseEvent? {
        val clean = line.removeSuffix("\r")
        return when {
            clean.isEmpty() -> dispatch()
            clean.startsWith(":") -> null // comment / keep-alive
            clean.startsWith("data:") -> {
                if (hasData) data.append('\n')
                data.append(clean.removePrefix("data:").removePrefix(" "))
                hasData = true
                null
            }
            clean.startsWith("event:") -> {
                eventName = clean.removePrefix("event:").trim()
                null
            }
            else -> null // id:, retry:, or unknown fields
        }
    }

    /** Call at end of stream to get a final event that wasn't followed by a blank line. */
    fun flush(): SseEvent? = dispatch()

    private fun dispatch(): SseEvent? {
        if (!hasData) {
            eventName = null
            return null
        }
        val event = SseEvent(eventName, data.toString())
        data.clear()
        hasData = false
        eventName = null
        return event
    }
}

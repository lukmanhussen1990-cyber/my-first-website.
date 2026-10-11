package com.imran.jarvis.ai

import org.json.JSONException
import org.json.JSONObject

/** Everything JARVIS can ask the phone to do. [id] is the exact word the AI writes in its JSON. */
enum class JarvisAction(val id: String) {
    NONE("none"),
    OPEN_APP("open_app"),
    CALL("call"),
    WHATSAPP("whatsapp"),
    YOUTUBE_SEARCH("youtube_search"),
    GOOGLE_SEARCH("google_search"),
    FLASHLIGHT_ON("flashlight_on"),
    FLASHLIGHT_OFF("flashlight_off"),
    SET_ALARM("set_alarm"),
    SET_TIMER("set_timer"),
    VOLUME_UP("volume_up"),
    VOLUME_DOWN("volume_down"),
    OPEN_WIFI("open_wifi"),
    OPEN_BLUETOOTH("open_bluetooth"),
    TIME("time"),
    BATTERY("battery"),

    /** Extra action (not in the original list) so "read my notifications" works. */
    READ_NOTIFICATIONS("read_notifications");

    companion object {
        private val aliases = mapOf(
            "torch_on" to FLASHLIGHT_ON,
            "torch_off" to FLASHLIGHT_OFF,
            "flashlight" to FLASHLIGHT_ON,
            "alarm" to SET_ALARM,
            "timer" to SET_TIMER,
            "search" to GOOGLE_SEARCH,
            "web_search" to GOOGLE_SEARCH,
            "phone_call" to CALL,
            "send_whatsapp" to WHATSAPP,
            "whatsapp_message" to WHATSAPP,
            "notifications" to READ_NOTIFICATIONS,
            "read_notification" to READ_NOTIFICATIONS,
            "current_time" to TIME,
            "battery_status" to BATTERY,
        )

        /** Turns whatever the AI wrote into an action. Anything unknown becomes [NONE] (safe default). */
        fun fromId(raw: String?): JarvisAction {
            val key = raw.orEmpty().trim().lowercase().replace(' ', '_').replace('-', '_')
            return entries.firstOrNull { it.id == key } ?: aliases[key] ?: NONE
        }
    }
}

/** The AI's answer: what to say, plus an optional action for the phone to perform. */
data class JarvisReply(
    val reply: String,
    val action: JarvisAction = JarvisAction.NONE,
    val target: String = "",
) {
    /** The JSON stored as JARVIS's own entry in the chat history. */
    fun toHistoryJson(): String = JSONObject()
        .put("reply", reply)
        .put("action", action.id)
        .put("target", target)
        .toString()

    companion object {
        private const val MAX_FALLBACK_LENGTH = 600

        /**
         * Reads the AI's text into a [JarvisReply]. AI models sometimes wrap the JSON in code fences,
         * add a sentence before it, or break it slightly, so this never throws: in the worst case the
         * whole text becomes the reply and no action is taken.
         */
        fun parse(raw: String): JarvisReply {
            val cleaned = stripCodeFences(raw.trim())

            val obj = parseObject(cleaned) ?: parseObject(firstJsonObject(cleaned))
            if (obj != null) {
                return JarvisReply(
                    reply = obj.stringOrEmpty("reply"),
                    action = JarvisAction.fromId(obj.stringOrEmpty("action")),
                    target = obj.stringOrEmpty("target"),
                )
            }

            // Broken JSON: try to rescue at least the spoken text.
            val rescued = REPLY_REGEX.find(cleaned)?.groupValues?.get(1)?.let { unescape(it) }
            if (!rescued.isNullOrBlank()) return JarvisReply(rescued.trim())

            return JarvisReply(cleaned.take(MAX_FALLBACK_LENGTH))
        }

        private val FENCE_REGEX = Regex("^```[a-zA-Z]*\\s*|\\s*```$")
        private val REPLY_REGEX = Regex("\"reply\"\\s*:\\s*\"((?:[^\"\\\\]|\\\\.)*)")

        private fun stripCodeFences(text: String): String = text.replace(FENCE_REGEX, "").trim()

        /** Returns the first balanced {...} block in [text], ignoring braces inside strings. */
        private fun firstJsonObject(text: String): String {
            val start = text.indexOf('{')
            if (start < 0) return ""
            var depth = 0
            var inString = false
            var escaped = false
            for (i in start until text.length) {
                val c = text[i]
                if (inString) {
                    when {
                        escaped -> escaped = false
                        c == '\\' -> escaped = true
                        c == '"' -> inString = false
                    }
                } else {
                    when (c) {
                        '"' -> inString = true
                        '{' -> depth++
                        '}' -> {
                            depth--
                            if (depth == 0) return text.substring(start, i + 1)
                        }
                    }
                }
            }
            return ""
        }

        private fun parseObject(text: String): JSONObject? {
            if (text.isBlank()) return null
            return try {
                JSONObject(text)
            } catch (_: JSONException) {
                null
            }
        }

        /** Reads a JSON value as text. A missing key or an explicit null gives "" (never the word "null"). */
        private fun JSONObject.stringOrEmpty(name: String): String =
            if (!has(name) || isNull(name)) "" else get(name).toString().trim()

        private fun unescape(text: String): String = try {
            JSONObject("{\"v\":\"$text\"}").getString("v")
        } catch (_: JSONException) {
            text
        }
    }
}

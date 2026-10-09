package com.loe.chat.util

import com.loe.chat.data.Attachment
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale

object Text {
    private val timeFormat = DateTimeFormatter.ofPattern("hh:mm a", Locale.ENGLISH)
    private val shortTimeFormat = DateTimeFormatter.ofPattern("h:mm a", Locale.ENGLISH)
    private val dayMonthFormat = DateTimeFormatter.ofPattern("d MMM", Locale.UK)
    private val fullDateFormat = DateTimeFormatter.ofPattern("d MMM yyyy", Locale.UK)

    /** "05:42 pm" — message timestamps. */
    fun messageTime(millis: Long, zone: ZoneId = ZoneId.systemDefault()): String =
        timeFormat.format(Instant.ofEpochMilli(millis).atZone(zone)).lowercase(Locale.ENGLISH)

    /** "5:42 pm" today, "5 Sept" this year, "5 Sept 2025" before — chat list dates. */
    fun listDate(millis: Long, today: LocalDate = LocalDate.now(), zone: ZoneId = ZoneId.systemDefault()): String {
        val time = Instant.ofEpochMilli(millis).atZone(zone)
        return when {
            time.toLocalDate() == today -> shortTimeFormat.format(time).lowercase(Locale.ENGLISH)
            time.year == today.year -> dayMonthFormat.format(time)
            else -> fullDateFormat.format(time)
        }
    }

    /** One-line, Markdown-free summary for chat lists and notifications. */
    fun preview(text: String, attachments: List<Attachment> = emptyList()): String {
        val plain = stripMarkdown(text)
        return when {
            plain.isNotBlank() -> plain.take(200)
            attachments.any { it.isImage } -> "📷 Image"
            attachments.isNotEmpty() -> "📎 ${attachments.first().name}"
            else -> ""
        }
    }

    fun stripMarkdown(text: String): String =
        text.replace(Regex("```[a-zA-Z0-9_+-]*"), " ")
            .replace(Regex("!\\[([^]]*)]\\([^)]*\\)"), "$1")
            .replace(Regex("\\[([^]]+)]\\([^)]*\\)"), "$1")
            .replace(Regex("(?m)^\\s{0,3}(#{1,6}|>|[-*+]\\s|\\d+\\.\\s)"), "")
            .replace(Regex("[*_`~]"), "")
            .replace(Regex("\\s+"), " ")
            .trim()

    /** Local title when no model is available: short messages become "Gi Conversation". */
    fun fallbackTitle(text: String, attachments: List<Attachment> = emptyList()): String {
        val clean = stripMarkdown(text)
        if (clean.isEmpty()) return if (attachments.any { it.isImage }) "Image chat" else "New chat"
        val words = clean.split(' ').filter { it.isNotBlank() }
        val title = if (words.size <= 2 && clean.length <= 20) "$clean Conversation" else words.take(6).joinToString(" ")
        return title.take(48).trim().replaceFirstChar { it.uppercase() }
    }

    /** Cleans a model-written title; null if nothing usable came back. */
    fun cleanTitle(raw: String?): String? {
        val line = raw?.lineSequence()?.map { it.trim() }?.firstOrNull { it.isNotEmpty() } ?: return null
        val clean = line
            .removePrefix("Title:").removePrefix("title:")
            .trim().trim('"', '\'', '*', '#', '“', '”', '`')
            .trimEnd('.', '!', '?', ':', ';', ',')
            .trim()
        return clean.take(60).takeIf { it.isNotBlank() && it.length >= 2 }
    }

    fun points(value: Int): String = String.format(Locale.US, "%,d", value)

    /** "11:53:06" until local midnight. */
    fun countdownToMidnight(now: java.time.LocalDateTime = java.time.LocalDateTime.now()): String {
        val midnight = now.toLocalDate().plusDays(1).atStartOfDay()
        val seconds = java.time.Duration.between(now, midnight).seconds.coerceAtLeast(0)
        return String.format(Locale.US, "%02d:%02d:%02d", seconds / 3600, (seconds % 3600) / 60, seconds % 60)
    }
}

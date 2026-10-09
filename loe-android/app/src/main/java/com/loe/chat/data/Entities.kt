package com.loe.chat.data

import org.json.JSONArray
import org.json.JSONObject

enum class Role { USER, BOT, DIVIDER, GREETING }

enum class MessageStatus { SENDING, SENT, STREAMING, DONE, ERROR, STOPPED, REFUSED }

/** Why a bot reply failed, so the UI can offer the right fix. */
object ErrorCodes {
    const val NO_KEY = "no_key"
    const val AUTH = "auth"
    const val BUDGET = "budget"
    const val POINTS = "points"
    const val NETWORK = "network"
    const val OTHER = "other"
}

data class Attachment(
    val type: String, // "image" or "file"
    val path: String, // absolute path inside the app's files dir
    val mime: String,
    val name: String,
) {
    val isImage: Boolean get() = type == "image"

    companion object {
        fun listToJson(list: List<Attachment>): String? {
            if (list.isEmpty()) return null
            val arr = JSONArray()
            list.forEach {
                arr.put(
                    JSONObject().put("type", it.type).put("path", it.path)
                        .put("mime", it.mime).put("name", it.name),
                )
            }
            return arr.toString()
        }

        fun listFromJson(json: String?): List<Attachment> {
            if (json.isNullOrBlank()) return emptyList()
            return runCatching {
                val arr = JSONArray(json)
                (0 until arr.length()).map { i ->
                    val o = arr.getJSONObject(i)
                    Attachment(o.getString("type"), o.getString("path"), o.optString("mime"), o.optString("name"))
                }
            }.getOrDefault(emptyList())
        }
    }
}

data class ChatMessage(
    val id: Long,
    val conversationId: Long,
    val role: Role,
    val botId: String?,
    val content: String,
    val attachments: List<Attachment>,
    val status: MessageStatus,
    val error: String?,
    val errorCode: String?,
    val createdAt: Long,
)

data class Conversation(
    val id: Long,
    val botId: String,
    val title: String,
    val createdAt: Long,
    val updatedAt: Long,
    val lastPreview: String,
    /** Name shown before the preview, e.g. "Assistant" or "You". */
    val lastSender: String?,
    val unread: Int,
    val titleGenerated: Boolean,
    val instructions: String?,
    val style: String?,
)

/** How long or short the bot should answer, picked in the chat options sheet. */
enum class ResponseStyle(val id: String, val label: String, val hint: String?) {
    DEFAULT("default", "Default", null),
    CONCISE("concise", "Concise", "Keep your answers brief and to the point."),
    DETAILED("detailed", "Detailed", "Give thorough, detailed answers with explanations and examples.");

    companion object {
        fun fromId(id: String?): ResponseStyle = entries.firstOrNull { it.id == id } ?: DEFAULT
    }
}

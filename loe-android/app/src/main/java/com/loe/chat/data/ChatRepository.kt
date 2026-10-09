package com.loe.chat.data

import android.content.ContentValues
import android.database.Cursor
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.flow.flowOn
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.withContext
import java.io.File

/**
 * Stores conversations, messages and user-created bots in SQLite.
 * Every write bumps [version]; the read flows re-query when it changes.
 */
class ChatRepository(private val helper: LoeDatabase, private val filesDir: File) {

    private val version = MutableStateFlow(0L)

    private fun bump() = version.update { it + 1 }

    private val db get() = helper.writableDatabase

    // ---- Read flows -------------------------------------------------------------------------

    fun conversations(): Flow<List<Conversation>> =
        version.map { queryConversations() }.flowOn(Dispatchers.IO).distinctUntilChanged()

    fun conversation(id: Long): Flow<Conversation?> =
        version.map { conversationNow(id) }.flowOn(Dispatchers.IO).distinctUntilChanged()

    fun messages(conversationId: Long): Flow<List<ChatMessage>> =
        version.map { messagesNow(conversationId) }.flowOn(Dispatchers.IO).distinctUntilChanged()

    fun totalUnread(): Flow<Int> =
        version.map {
            db.rawQuery("SELECT COALESCE(SUM(unread), 0) FROM conversations", null).use { c ->
                if (c.moveToFirst()) c.getInt(0) else 0
            }
        }.flowOn(Dispatchers.IO).distinctUntilChanged()

    fun customBots(): Flow<List<Bot>> =
        version.map { customBotsNow() }.flowOn(Dispatchers.IO).distinctUntilChanged()

    // ---- Queries ------------------------------------------------------------------------------

    fun queryConversations(): List<Conversation> =
        db.rawQuery("SELECT * FROM conversations ORDER BY updated_at DESC, id DESC", null).use { c ->
            buildList { while (c.moveToNext()) add(c.toConversation()) }
        }

    fun conversationNow(id: Long): Conversation? =
        db.rawQuery("SELECT * FROM conversations WHERE id = ?", arrayOf(id.toString())).use { c ->
            if (c.moveToFirst()) c.toConversation() else null
        }

    fun messagesNow(conversationId: Long): List<ChatMessage> =
        db.rawQuery(
            "SELECT * FROM messages WHERE conversation_id = ? ORDER BY id ASC",
            arrayOf(conversationId.toString()),
        ).use { c -> buildList { while (c.moveToNext()) add(c.toMessage()) } }

    fun messageNow(id: Long): ChatMessage? =
        db.rawQuery("SELECT * FROM messages WHERE id = ?", arrayOf(id.toString())).use { c ->
            if (c.moveToFirst()) c.toMessage() else null
        }

    fun customBotsNow(): List<Bot> =
        db.rawQuery("SELECT * FROM custom_bots ORDER BY created_at DESC", null).use { c ->
            buildList { while (c.moveToNext()) add(c.toBot()) }
        }

    suspend fun lastConversationWithBot(botId: String, excludeId: Long = -1): Conversation? = io {
        db.rawQuery(
            "SELECT * FROM conversations WHERE bot_id = ? AND id != ? ORDER BY updated_at DESC LIMIT 1",
            arrayOf(botId, excludeId.toString()),
        ).use { c -> if (c.moveToFirst()) c.toConversation() else null }
    }

    /** Most recently used bot ids, newest first. */
    suspend fun recentBotIds(limit: Int): List<String> = io {
        db.rawQuery(
            "SELECT bot_id, MAX(updated_at) AS t FROM conversations GROUP BY bot_id ORDER BY t DESC LIMIT ?",
            arrayOf(limit.toString()),
        ).use { c -> buildList { while (c.moveToNext()) add(c.getString(0)) } }
    }

    // ---- Writes -------------------------------------------------------------------------------

    suspend fun createConversation(botId: String, title: String = "New chat"): Long = io {
        val now = System.currentTimeMillis()
        val id = db.insertOrThrow(
            "conversations", null,
            ContentValues().apply {
                put("bot_id", botId)
                put("title", title)
                put("created_at", now)
                put("updated_at", now)
            },
        )
        bump()
        id
    }

    suspend fun insertMessage(
        conversationId: Long,
        role: Role,
        botId: String?,
        content: String,
        attachments: List<Attachment> = emptyList(),
        status: MessageStatus,
        error: String? = null,
        errorCode: String? = null,
    ): Long = io {
        val id = db.insertOrThrow(
            "messages", null,
            ContentValues().apply {
                put("conversation_id", conversationId)
                put("role", role.name)
                put("bot_id", botId)
                put("content", content)
                put("attachments", Attachment.listToJson(attachments))
                put("status", status.name)
                put("error", error)
                put("error_code", errorCode)
                put("created_at", System.currentTimeMillis())
            },
        )
        bump()
        id
    }

    suspend fun updateMessage(
        id: Long,
        content: String? = null,
        status: MessageStatus? = null,
        error: String? = null,
        errorCode: String? = null,
        attachments: List<Attachment>? = null,
        clearError: Boolean = false,
    ) = io {
        val values = ContentValues().apply {
            content?.let { put("content", it) }
            status?.let { put("status", it.name) }
            if (clearError) {
                putNull("error"); putNull("error_code")
            } else {
                error?.let { put("error", it) }
                errorCode?.let { put("error_code", it) }
            }
            attachments?.let { put("attachments", Attachment.listToJson(it)) }
        }
        if (values.size() > 0) {
            db.update("messages", values, "id = ?", arrayOf(id.toString()))
            bump()
        }
    }

    /** Replies cut short by the app closing are marked as stopped on the next launch. */
    suspend fun markInterrupted() = io {
        db.execSQL("UPDATE messages SET status = 'STOPPED' WHERE status = 'STREAMING'")
        db.execSQL("UPDATE messages SET status = 'SENT' WHERE status = 'SENDING'")
        bump()
    }

    suspend fun deleteMessage(id: Long) = io {
        messageNow(id)?.attachments?.forEach { deleteOwnedFile(it.path) }
        db.delete("messages", "id = ?", arrayOf(id.toString()))
        bump()
    }

    /** Updates the list preview after a message lands. */
    suspend fun touchConversation(id: Long, preview: String, sender: String?, incrementUnread: Boolean) = io {
        db.execSQL(
            "UPDATE conversations SET updated_at = ?, last_preview = ?, last_sender = ?, unread = unread + ? WHERE id = ?",
            arrayOf<Any?>(System.currentTimeMillis(), preview.take(300), sender, if (incrementUnread) 1 else 0, id),
        )
        bump()
    }

    suspend fun setTitle(id: Long, title: String, generated: Boolean = true) = io {
        db.update(
            "conversations",
            ContentValues().apply {
                put("title", title)
                put("title_generated", if (generated) 1 else 0)
            },
            "id = ?", arrayOf(id.toString()),
        )
        bump()
    }

    suspend fun setOptions(id: Long, style: ResponseStyle, instructions: String?) = io {
        db.update(
            "conversations",
            ContentValues().apply {
                put("style", style.id)
                put("instructions", instructions?.takeIf { it.isNotBlank() })
            },
            "id = ?", arrayOf(id.toString()),
        )
        bump()
    }

    suspend fun markRead(id: Long) = io {
        val changed = db.update(
            "conversations", ContentValues().apply { put("unread", 0) },
            "id = ? AND unread != 0", arrayOf(id.toString()),
        )
        if (changed > 0) bump()
    }

    suspend fun deleteConversation(id: Long) = io {
        messagesNow(id).forEach { m -> m.attachments.forEach { deleteOwnedFile(it.path) } }
        db.delete("messages", "conversation_id = ?", arrayOf(id.toString()))
        db.delete("conversations", "id = ?", arrayOf(id.toString()))
        bump()
    }

    suspend fun deleteAllChats() = io {
        db.delete("messages", null, null)
        db.delete("conversations", null, null)
        File(filesDir, "attachments").deleteRecursively()
        File(filesDir, "generated").deleteRecursively()
        bump()
    }

    suspend fun deleteEverything() = io {
        db.delete("messages", null, null)
        db.delete("conversations", null, null)
        db.delete("custom_bots", null, null)
        File(filesDir, "attachments").deleteRecursively()
        File(filesDir, "generated").deleteRecursively()
        File(filesDir, "profile").deleteRecursively()
        bump()
    }

    suspend fun saveCustomBot(bot: Bot) = io {
        db.insertWithOnConflict(
            "custom_bots", null,
            ContentValues().apply {
                put("id", bot.id)
                put("name", bot.name)
                put("description", bot.description)
                put("base_bot_id", bot.baseBotId)
                put("prompt", bot.systemPrompt.orEmpty())
                put("greeting", bot.greeting)
                put("color", bot.color)
                put("emoji", bot.emoji)
                put("created_at", bot.createdAt)
            },
            android.database.sqlite.SQLiteDatabase.CONFLICT_REPLACE,
        )
        bump()
    }

    suspend fun deleteCustomBot(id: String) = io {
        db.delete("custom_bots", "id = ?", arrayOf(id))
        bump()
    }

    // ---- Helpers ------------------------------------------------------------------------------

    private fun deleteOwnedFile(path: String) {
        val file = File(path)
        if (file.canonicalPath.startsWith(filesDir.canonicalPath)) file.delete()
    }

    private suspend fun <T> io(block: () -> T): T = withContext(Dispatchers.IO) { block() }

    private fun Cursor.str(name: String): String? = getColumnIndexOrThrow(name).let { if (isNull(it)) null else getString(it) }

    private fun Cursor.long(name: String): Long = getLong(getColumnIndexOrThrow(name))

    private fun Cursor.int(name: String): Int = getInt(getColumnIndexOrThrow(name))

    private fun Cursor.toConversation() = Conversation(
        id = long("id"),
        botId = str("bot_id").orEmpty(),
        title = str("title").orEmpty(),
        createdAt = long("created_at"),
        updatedAt = long("updated_at"),
        lastPreview = str("last_preview").orEmpty(),
        lastSender = str("last_sender"),
        unread = int("unread"),
        titleGenerated = int("title_generated") != 0,
        instructions = str("instructions"),
        style = str("style"),
    )

    private fun Cursor.toMessage() = ChatMessage(
        id = long("id"),
        conversationId = long("conversation_id"),
        role = runCatching { Role.valueOf(str("role")!!) }.getOrDefault(Role.BOT),
        botId = str("bot_id"),
        content = str("content").orEmpty(),
        attachments = Attachment.listFromJson(str("attachments")),
        status = runCatching { MessageStatus.valueOf(str("status")!!) }.getOrDefault(MessageStatus.DONE),
        error = str("error"),
        errorCode = str("error_code"),
        createdAt = long("created_at"),
    )

    private fun Cursor.toBot(): Bot {
        val base = BotCatalog.officialById(str("base_bot_id").orEmpty()) ?: BotCatalog.assistant
        return Bot(
            id = str("id").orEmpty(),
            name = str("name").orEmpty(),
            creator = "you",
            description = str("description").orEmpty(),
            avatar = AvatarStyle.CUSTOM,
            categories = setOf(BotCategory.YOURS),
            points = base.points,
            contextLabel = base.contextLabel,
            official = false,
            vision = base.vision,
            systemPrompt = str("prompt"),
            greeting = str("greeting"),
            baseBotId = base.id,
            color = long("color"),
            emoji = str("emoji"),
            createdAt = long("created_at"),
        )
    }
}

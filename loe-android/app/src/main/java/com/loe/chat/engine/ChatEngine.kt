package com.loe.chat.engine

import android.content.Context
import com.loe.chat.ai.AiService
import com.loe.chat.ai.ApiException
import com.loe.chat.ai.ChatRequest
import com.loe.chat.ai.ChatTurn
import com.loe.chat.ai.ImagePart
import com.loe.chat.ai.Purpose
import com.loe.chat.ai.Route
import com.loe.chat.ai.Router
import com.loe.chat.ai.StreamEvent
import com.loe.chat.data.Attachment
import com.loe.chat.data.Bot
import com.loe.chat.data.BotCatalog
import com.loe.chat.data.BotKind
import com.loe.chat.data.ChatMessage
import com.loe.chat.data.ChatRepository
import com.loe.chat.data.Conversation
import com.loe.chat.data.ErrorCodes
import com.loe.chat.data.MessageStatus
import com.loe.chat.data.ResponseStyle
import com.loe.chat.data.Role
import com.loe.chat.data.SettingsStore
import com.loe.chat.util.Attachments
import com.loe.chat.util.Text
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.CoroutineStart
import kotlinx.coroutines.Job
import kotlinx.coroutines.NonCancellable
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeoutOrNull
import java.io.File
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import java.util.Locale
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap

/**
 * Sends messages to bots and streams their replies. Lives for the whole app process, so replies
 * keep streaming (and update unread badges) when the user leaves the chat screen.
 */
class ChatEngine(
    private val context: Context,
    private val repo: ChatRepository,
    private val settings: SettingsStore,
    private val bots: BotRegistry,
    private val ai: AiService,
    private val notifier: ReplyNotifier,
    private val scope: CoroutineScope,
    private val isAppInForeground: () -> Boolean,
) {
    /** A reply that is still streaming; the chat screen renders it on top of the stored message. */
    data class LiveReply(
        val messageId: Long,
        val botId: String,
        val text: String,
        val startedAt: Long,
        val hasOutput: Boolean,
    )

    private val _live = MutableStateFlow<Map<Long, LiveReply>>(emptyMap())
    val live: StateFlow<Map<Long, LiveReply>> = _live.asStateFlow()

    private val jobs = ConcurrentHashMap<Long, Job>()

    private val _busy = MutableStateFlow<Set<Long>>(emptySet())

    /** Conversations with a message or reply in flight (drives the Stop button). */
    val busy: StateFlow<Set<Long>> = _busy.asStateFlow()

    /** The conversation on screen right now (its replies don't count as unread). */
    @Volatile
    var openConversationId: Long = -1L

    init {
        scope.launch { repo.markInterrupted() }
    }

    fun isBusy(conversationId: Long): Boolean = jobs[conversationId]?.isActive == true

    /** Creates a chat with [botId], sends the first message and returns the new chat's id. */
    suspend fun startChat(
        botId: String,
        text: String,
        attachments: List<Attachment>,
        style: ResponseStyle = ResponseStyle.DEFAULT,
        instructions: String? = null,
    ): Long {
        val bot = bots.getOrAssistant(botId)
        val id = repo.createConversation(bot.id)
        if (style != ResponseStyle.DEFAULT || !instructions.isNullOrBlank()) repo.setOptions(id, style, instructions)
        bot.greeting?.takeIf { it.isNotBlank() }?.let {
            repo.insertMessage(id, Role.GREETING, bot.id, it, status = MessageStatus.DONE)
        }
        send(id, text, attachments)
        return id
    }

    fun send(conversationId: Long, text: String, attachments: List<Attachment>) {
        if (isBusy(conversationId)) return
        launchTurn(conversationId) {
            val conversation = repo.conversationNow(conversationId) ?: return@launchTurn
            val mentioned = mentionedBot(text)
            val messageId = repo.insertMessage(
                conversationId, Role.USER, null, text.trim(), attachments, MessageStatus.SENDING,
            )
            repo.touchConversation(conversationId, Text.preview(text, attachments), "You", incrementUnread = false)
            if (!conversation.titleGenerated) {
                val route = Router.resolve(bots.getOrAssistant(conversation.botId), settings.current)
                scope.launch { generateTitle(conversationId, route) }
            }
            delay(SEND_TICK_MS)
            repo.updateMessage(messageId, status = MessageStatus.SENT)
            reply(conversationId, mentioned?.id ?: conversation.botId, replaceMessageId = null)
        }
    }

    /** Regenerates a bot reply in place. */
    fun retry(conversationId: Long, botMessageId: Long) {
        if (isBusy(conversationId)) return
        launchTurn(conversationId) {
            val message = repo.messageNow(botMessageId) ?: return@launchTurn
            val conversation = repo.conversationNow(conversationId) ?: return@launchTurn
            reply(conversationId, message.botId ?: conversation.botId, replaceMessageId = botMessageId)
        }
    }

    fun stop(conversationId: Long) {
        jobs[conversationId]?.cancel()
    }

    /** Inserts a context break: the bot forgets everything above it. */
    fun clearContext(conversationId: Long) {
        scope.launch { repo.insertMessage(conversationId, Role.DIVIDER, null, "", status = MessageStatus.DONE) }
    }

    private fun launchTurn(conversationId: Long, block: suspend CoroutineScope.() -> Unit) {
        val job = scope.launch(start = CoroutineStart.LAZY, block = block)
        jobs[conversationId] = job
        _busy.update { it + conversationId }
        job.invokeOnCompletion {
            if (jobs.remove(conversationId, job)) _busy.update { it - conversationId }
        }
        job.start()
    }

    private suspend fun reply(conversationId: Long, botId: String, replaceMessageId: Long?) {
        val bot = bots.getOrAssistant(botId)
        val current = settings.current
        val blocked: Pair<String, String>? = when {
            bot.points > current.perMessageBudget ->
                "${bot.name} costs ${bot.points} points per message, which is above your per-message budget of " +
                    "${current.perMessageBudget}. You can raise it in Settings → Compute points." to ErrorCodes.BUDGET
            bot.points > current.remainingPoints() ->
                "You don't have enough compute points left today (${current.remainingPoints()} left, ${bot.name} needs " +
                    "${bot.points}). Points reset at midnight, or raise your daily points in Settings." to ErrorCodes.POINTS
            else -> null
        }
        val route = if (blocked == null) Router.resolve(bot, current) else null
        if (blocked != null || route == null) {
            val (message, code) = blocked ?: (noKeyMessage(bot) to ErrorCodes.NO_KEY)
            if (replaceMessageId != null) {
                repo.updateMessage(replaceMessageId, content = "", status = MessageStatus.ERROR, error = message, errorCode = code, attachments = emptyList())
            } else {
                repo.insertMessage(conversationId, Role.BOT, bot.id, "", status = MessageStatus.ERROR, error = message, errorCode = code)
            }
            finishTurn(conversationId, bot, message)
            return
        }

        val messageId = if (replaceMessageId != null) {
            repo.updateMessage(replaceMessageId, content = "", status = MessageStatus.STREAMING, attachments = emptyList(), clearError = true)
            replaceMessageId
        } else {
            repo.insertMessage(conversationId, Role.BOT, bot.id, "", status = MessageStatus.STREAMING)
        }
        val startedAt = System.currentTimeMillis()
        setLive(conversationId, LiveReply(messageId, bot.id, "", startedAt, hasOutput = false))

        val conversation = repo.conversationNow(conversationId)
        val request = ChatRequest(
            route = route,
            system = systemPrompt(bot, conversation),
            turns = buildHistory(conversationId, messageId, bot),
            kind = bot.kind,
        )
        val text = StringBuilder()
        val images = mutableListOf<Attachment>()
        var refused = false
        var truncated = false
        try {
            var lastPush = 0L
            ai.stream(request).collect { event ->
                when (event) {
                    is StreamEvent.TextDelta -> {
                        text.append(event.text)
                        val now = System.currentTimeMillis()
                        if (now - lastPush >= LIVE_THROTTLE_MS) {
                            lastPush = now
                            setLive(conversationId, LiveReply(messageId, bot.id, text.toString(), startedAt, hasOutput = true))
                        }
                    }
                    is StreamEvent.ImageOut -> {
                        images += saveGenerated(event)
                        setLive(conversationId, LiveReply(messageId, bot.id, text.toString(), startedAt, hasOutput = true))
                    }
                    is StreamEvent.Thinking -> Unit
                    is StreamEvent.Finished -> {
                        refused = event.refused
                        truncated = event.truncated
                    }
                }
            }
            if (refused) {
                // A declined reply: discard any partial output rather than showing it as complete.
                val message = "${bot.name} declined to answer this message. Try rephrasing it, or ask a different bot."
                repo.updateMessage(messageId, content = "", status = MessageStatus.REFUSED, error = message, attachments = images)
                finishTurn(conversationId, bot, message)
            } else {
                var finalText = text.toString().trim()
                if (truncated) finalText += "\n\n_(This reply was cut off because it reached the length limit.)_"
                if (finalText.isBlank() && images.isEmpty()) {
                    val message = "${bot.name} sent an empty reply. Tap retry to try again."
                    repo.updateMessage(messageId, content = "", status = MessageStatus.ERROR, error = message, errorCode = ErrorCodes.OTHER)
                    finishTurn(conversationId, bot, message)
                } else {
                    repo.updateMessage(messageId, content = finalText, status = MessageStatus.DONE, attachments = images)
                    settings.spendPoints(bot.points)
                    finishTurn(conversationId, bot, Text.preview(finalText, images))
                }
            }
        } catch (e: CancellationException) {
            withContext(NonCancellable) {
                val partial = text.toString().trim()
                repo.updateMessage(messageId, content = partial, status = MessageStatus.STOPPED, attachments = images)
                if (partial.isNotEmpty() || images.isNotEmpty()) settings.spendPoints(bot.points)
                finishTurn(conversationId, bot, Text.preview(partial, images).ifBlank { "Stopped" }, notify = false)
                clearLive(conversationId)
            }
            throw e
        } catch (e: ApiException) {
            repo.updateMessage(messageId, content = text.toString().trim(), status = MessageStatus.ERROR, error = e.message, errorCode = e.code, attachments = images)
            finishTurn(conversationId, bot, e.message)
        } catch (e: Exception) {
            val message = "Something went wrong: ${e.message ?: e.javaClass.simpleName}"
            repo.updateMessage(messageId, content = text.toString().trim(), status = MessageStatus.ERROR, error = message, errorCode = ErrorCodes.OTHER, attachments = images)
            finishTurn(conversationId, bot, message)
        } finally {
            clearLive(conversationId)
        }
    }

    private suspend fun finishTurn(conversationId: Long, bot: Bot, preview: String, notify: Boolean = true) {
        val foreground = isAppInForeground()
        val onScreen = foreground && openConversationId == conversationId
        repo.touchConversation(conversationId, preview, bot.name, incrementUnread = !onScreen)
        if (notify && !foreground && settings.current.notifyReplies) {
            val title = repo.conversationNow(conversationId)?.title ?: "New chat"
            notifier.notifyReply(conversationId, title, bot.name, preview)
        }
    }

    // ---- History & prompts ------------------------------------------------------------------

    private fun buildHistory(conversationId: Long, beforeMessageId: Long, bot: Bot): List<ChatTurn> {
        val messages = repo.messagesNow(conversationId).filter { it.id < beforeMessageId }
        val relevant = messages.drop(messages.indexOfLast { it.role == Role.DIVIDER } + 1)
        val canSee = bot.vision || bot.kind == BotKind.IMAGE
        var imagesLeft = if (canSee) MAX_IMAGES else 0
        val turns = ArrayDeque<ChatTurn>()
        for (m in relevant.asReversed()) {
            when (m.role) {
                Role.USER -> {
                    var text = stripMention(m.content)
                    val images = mutableListOf<ImagePart>()
                    for (a in m.attachments) {
                        if (a.isImage) {
                            val file = File(a.path)
                            if (imagesLeft > 0 && file.exists()) {
                                images += ImagePart(a.mime.ifBlank { "image/jpeg" }, Attachments.base64(file))
                                imagesLeft--
                            } else if (!canSee) {
                                text += "\n\n[The user attached an image, but this bot can't view images.]"
                            }
                        } else {
                            text += "\n\n[Attached file: ${a.name}]\n```\n${Attachments.readText(a).take(MAX_FILE_CHARS)}\n```"
                        }
                    }
                    turns.addFirst(ChatTurn(fromUser = true, text = text, images = images))
                }
                Role.BOT -> if ((m.status == MessageStatus.DONE || m.status == MessageStatus.STOPPED) && m.content.isNotBlank()) {
                    turns.addFirst(ChatTurn(fromUser = false, text = m.content))
                }
                else -> Unit
            }
        }
        var result = mergeTurns(turns).dropWhile { !it.fromUser }
        // Image bots edit their last picture when the new request has no photo of its own.
        if (bot.kind == BotKind.IMAGE && result.isNotEmpty() && result.last().images.isEmpty()) {
            lastGeneratedImage(relevant)?.let { file ->
                val last = result.last()
                result = result.dropLast(1) + last.copy(images = listOf(ImagePart(mimeOf(file), Attachments.base64(file))))
            }
        }
        return result
    }

    private fun lastGeneratedImage(messages: List<ChatMessage>): File? =
        messages.lastOrNull { it.role == Role.BOT && it.attachments.any { a -> a.isImage } }
            ?.attachments?.last { it.isImage }?.let { File(it.path) }?.takeIf { it.exists() }

    private fun mimeOf(file: File): String = when (file.extension.lowercase()) {
        "png" -> "image/png"
        "webp" -> "image/webp"
        else -> "image/jpeg"
    }

    private fun mergeTurns(turns: List<ChatTurn>): List<ChatTurn> {
        val out = mutableListOf<ChatTurn>()
        for (t in turns) {
            val last = out.lastOrNull()
            if (last != null && last.fromUser == t.fromUser) {
                out[out.lastIndex] = last.copy(text = last.text + "\n\n" + t.text, images = last.images + t.images)
            } else {
                out += t
            }
        }
        return out
    }

    private fun systemPrompt(bot: Bot, conversation: Conversation?): String? {
        val parts = mutableListOf<String>()
        if (Router.baseOf(bot).id == BotCatalog.ASSISTANT_ID && !bot.isCustom) {
            val today = LocalDate.now().format(DateTimeFormatter.ofPattern("MMMM d, yyyy", Locale.ENGLISH))
            parts += "You are Assistant, the general-purpose AI assistant in the Loe app. Be helpful, accurate and friendly. " +
                "Reply in the same language the user writes in, and use Markdown when it makes the answer easier to read. " +
                "Today's date is $today."
        }
        bot.systemPrompt?.takeIf { it.isNotBlank() }?.let { parts += it }
        ResponseStyle.fromId(conversation?.style).hint?.let { parts += it }
        conversation?.instructions?.takeIf { it.isNotBlank() }?.let {
            parts += "Additional instructions from the user for this chat:\n$it"
        }
        return parts.joinToString("\n\n").ifBlank { null }
    }

    private fun noKeyMessage(bot: Bot): String {
        val base = Router.baseOf(bot)
        return if (base.id == BotCatalog.ASSISTANT_ID) {
            "To chat with ${bot.name}, connect an AI provider in Settings → API keys. Any provider works. " +
                "Tip: Google Gemini has a free tier, and one OpenRouter key unlocks every bot."
        } else {
            val providers = Router.providersFor(base).joinToString(", ") { it.displayName }
            "To chat with ${bot.name}, connect an API key in Settings → API keys. ${bot.name} works with: $providers."
        }
    }

    // ---- Titles --------------------------------------------------------------------------------

    private suspend fun generateTitle(conversationId: Long, route: Route?) {
        val first = repo.messagesNow(conversationId).firstOrNull { it.role == Role.USER } ?: return
        val fallback = Text.fallbackTitle(stripMention(first.content), first.attachments)
        val titleRoute = route?.let { Router.titleRoute(it) }
        val generated = if (titleRoute != null && first.content.isNotBlank()) {
            withTimeoutOrNull(TITLE_TIMEOUT_MS) {
                runCatching {
                    ai.complete(
                        ChatRequest(
                            route = titleRoute,
                            system = "You write short titles for chat conversations.",
                            turns = listOf(ChatTurn(true, TITLE_PROMPT + stripMention(first.content).take(1500))),
                            purpose = Purpose.TITLE,
                        ),
                    )
                }.getOrNull()
            }
        } else {
            null
        }
        val title = Text.cleanTitle(generated) ?: fallback
        if (repo.conversationNow(conversationId)?.titleGenerated == false) repo.setTitle(conversationId, title, generated = true)
    }

    // ---- Helpers -------------------------------------------------------------------------------

    fun mentionedBot(text: String): Bot? {
        val match = MENTION.find(text.trimStart()) ?: return null
        return bots.byName(match.groupValues[1])
    }

    private fun stripMention(text: String): String {
        val trimmed = text.trimStart()
        val match = MENTION.find(trimmed) ?: return text
        if (bots.byName(match.groupValues[1]) == null) return text
        return trimmed.removeRange(match.range).trim().ifBlank { text }
    }

    private fun saveGenerated(event: StreamEvent.ImageOut): Attachment {
        val dir = File(context.filesDir, "generated").apply { mkdirs() }
        val ext = when {
            event.mime.contains("png") -> "png"
            event.mime.contains("webp") -> "webp"
            else -> "jpg"
        }
        val file = File(dir, "${UUID.randomUUID()}.$ext")
        file.writeBytes(event.bytes)
        return Attachment("image", file.absolutePath, event.mime, "Loe image.$ext")
    }

    private fun setLive(conversationId: Long, reply: LiveReply) = _live.update { it + (conversationId to reply) }

    private fun clearLive(conversationId: Long) = _live.update { it - conversationId }

    companion object {
        private const val SEND_TICK_MS = 350L
        private const val LIVE_THROTTLE_MS = 50L
        private const val TITLE_TIMEOUT_MS = 25_000L
        private const val MAX_IMAGES = 6
        private const val MAX_FILE_CHARS = 60_000
        private val MENTION = Regex("^@([A-Za-z0-9._-]+)\\s*")
        private const val TITLE_PROMPT =
            "Write a short title (2 to 5 words) for a chat that starts with the message below. " +
                "Use the same language as the message. Reply with the title only: no quotes, no trailing punctuation.\n\nMessage:\n"
    }
}

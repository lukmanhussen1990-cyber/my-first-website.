package com.runova.app.coach

import com.runova.app.data.AppRepository
import com.runova.app.data.ChatRow
import com.runova.app.data.SecretStore
import com.runova.app.state.UiEnv
import com.runova.app.state.UiMapper
import com.runova.app.ui.model.ChatMessageUi
import com.runova.app.ui.model.ChatRole
import com.runova.claude.ChatTurn
import com.runova.claude.ClaudeCoach
import com.runova.claude.ClaudeModel
import com.runova.claude.CoachReply
import com.runova.claude.ConnectionResult
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

/**
 * The AI Coach conversation. Answers come from Claude when an API key is saved and from the
 * offline rule-based coach otherwise, or whenever Claude can't answer.
 */
class CoachRepository(
    private val repository: AppRepository,
    private val secrets: SecretStore,
    private val scope: CoroutineScope,
) {
    private val claude = ClaudeCoach()

    private val messagesState = MutableStateFlow<List<ChatMessageUi>>(emptyList())
    val messages: StateFlow<List<ChatMessageUi>> = messagesState.asStateFlow()

    private val thinkingState = MutableStateFlow(false)
    val thinking: StateFlow<Boolean> = thinkingState.asStateFlow()

    private val noticeState = MutableStateFlow<String?>(null)
    /** Why the last answer came from the offline coach, if something went wrong. */
    val notice: StateFlow<String?> = noticeState.asStateFlow()

    private var replyJob: Job? = null

    val usingClaude: StateFlow<Boolean> get() = secrets.hasApiKey

    init {
        scope.launch { messagesState.value = repository.chat().map { it.toUi() } }
    }

    private fun ChatRow.toUi() = ChatMessageUi(id, if (fromUser) ChatRole.USER else ChatRole.COACH, text)

    fun send(text: String) {
        val question = text.trim().take(MAX_QUESTION_CHARS)
        if (question.isEmpty() || thinkingState.value) return
        thinkingState.value = true
        noticeState.value = null
        replyJob = scope.launch {
            try {
                val history = messagesState.value.map { ChatTurn(it.role == ChatRole.USER, it.text) }
                val userRow = repository.addChat(fromUser = true, text = question)
                messagesState.update { it + userRow.toUi() }
                val data = repository.snapshot()
                val snapshot = UiMapper.coachSnapshot(data, UiEnv.system())
                val reply = claude.reply(secrets.apiKey(), ClaudeModel.of(data.settings.claudeModel), history, question, snapshot)
                val coachRow = repository.addChat(fromUser = false, text = reply.text)
                messagesState.update { it + coachRow.toUi() }
                noticeState.value = (reply as? CoachReply.Offline)?.notice
            } finally {
                thinkingState.value = false
            }
        }
    }

    fun clear() {
        replyJob?.cancel()
        thinkingState.value = false
        noticeState.value = null
        messagesState.value = emptyList()
        scope.launch { repository.clearChat() }
    }

    suspend fun testConnection(): String {
        val key = secrets.apiKey() ?: return "Add an API key first."
        val model = ClaudeModel.of(repository.settings.load().claudeModel)
        return when (val r = claude.testConnection(key, model)) {
            is ConnectionResult.Ok -> r.message
            is ConnectionResult.Failed -> r.message
        }
    }

    fun forgetKey() {
        secrets.clearApiKey()
        claude.close()
        noticeState.value = null
    }

    private companion object {
        const val MAX_QUESTION_CHARS = 2_000
    }
}

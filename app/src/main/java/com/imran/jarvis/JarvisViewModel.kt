package com.imran.jarvis

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.imran.jarvis.actions.ActionOutcome
import com.imran.jarvis.actions.Permissions
import com.imran.jarvis.actions.QuickAction
import com.imran.jarvis.ai.AiException
import com.imran.jarvis.ai.AiRequest
import com.imran.jarvis.ai.ConversationHistory
import com.imran.jarvis.ai.JarvisPrompt
import com.imran.jarvis.ai.JarvisReply
import com.imran.jarvis.ai.NetworkChecker
import com.imran.jarvis.data.AiProvider
import com.imran.jarvis.data.AppLanguage
import com.imran.jarvis.data.AppSettings
import com.imran.jarvis.data.ChatMessage
import com.imran.jarvis.data.Phase
import com.imran.jarvis.data.Role
import com.imran.jarvis.data.VoiceGender
import com.imran.jarvis.i18n.Phrases
import com.imran.jarvis.voice.SpeechError
import com.imran.jarvis.voice.SpeechListener
import com.imran.jarvis.voice.SpeechRecognizerManager
import com.imran.jarvis.voice.TtsManager
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Job
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.receiveAsFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

/** What the screens show. */
data class JarvisUiState(
    val phase: Phase = Phase.Idle,
    val messages: List<ChatMessage> = emptyList(),
    /** Words recognised so far while the user is speaking. */
    val partialText: String = "",
)

/** The three permission switches in Settings, as they really are right now. */
data class PermissionState(
    val calls: Boolean = false,
    val notifications: Boolean = false,
    val openApps: Boolean = true,
)

/** One-time things the screen must react to (show a message, ask Android for a permission...). */
sealed interface UiEvent {
    data class Message(val text: String) : UiEvent
    data class RequestPermissions(val permissions: List<String>) : UiEvent
    data object NeedNotificationAccess : UiEvent

    /** A permission is blocked: show [text] with a "Settings" button that opens this app's info page. */
    data class AppInfoHint(val text: String) : UiEvent
}

/**
 * The brain of the app: listens, asks the AI, runs the action, speaks the answer.
 * One instance is shared by all three screens.
 */
class JarvisViewModel(application: Application) : AndroidViewModel(application), SpeechListener {

    private val app = application
    private val container = (application as JarvisApplication).container

    val settings: StateFlow<AppSettings> = container.settings.settings

    private val _state = MutableStateFlow(JarvisUiState())
    val state: StateFlow<JarvisUiState> = _state.asStateFlow()

    /** Voice loudness 0..1 while listening. Kept apart from [state] because it changes ~20 times a second. */
    private val _level = MutableStateFlow(0f)
    val level: StateFlow<Float> = _level.asStateFlow()

    val torchOn: StateFlow<Boolean> = container.torch.isOn

    private val events = Channel<UiEvent>(Channel.BUFFERED)
    val uiEvents: Flow<UiEvent> = events.receiveAsFlow()

    private val permissionTick = MutableStateFlow(0)
    val permissions: StateFlow<PermissionState> =
        combine(settings, permissionTick) { s, _ -> readPermissions(s) }
            .stateIn(viewModelScope, SharingStarted.Eagerly, readPermissions(settings.value))

    private val stt = SpeechRecognizerManager(application, this)
    private val tts = TtsManager(application).also { engine ->
        engine.onVoiceMissing = { events.trySend(UiEvent.Message(phrases().ttsVoiceMissing)) }
    }

    private var aiJob: Job? = null
    private var nextMessageId = 0L

    /** An app/screen to open as soon as JARVIS has finished speaking. */
    private var pendingLaunch: ActionOutcome.Launch? = null

    /** An action that is waiting for the user to grant an Android permission. */
    private var pendingAfterPermission: JarvisReply? = null

    private fun phrases(): Phrases = Phrases.forLanguage(settings.value.language)

    // ---------------------------------------------------------------------------------------------
    // Listening
    // ---------------------------------------------------------------------------------------------

    /** The big mic button. The screen has already made sure the microphone permission is granted. */
    fun onMicTapped() {
        when (_state.value.phase) {
            Phase.Listening -> stt.stop() // "I'm done talking": process what was heard
            else -> startListening()      // also interrupts thinking or speaking
        }
    }

    fun startListening() {
        aiJob?.cancel()
        tts.stop()
        pendingLaunch = null
        pendingAfterPermission = null

        val phrases = phrases()
        if (!stt.isAvailable()) return showProblem(phrases.sttUnavailable)
        if (!NetworkChecker.isOnline(app)) return showProblem(phrases.noInternet)

        _level.value = 0f
        _state.update { it.copy(phase = Phase.Listening, partialText = "") }
        stt.start(settings.value.language)
    }

    override fun onReady() {}

    override fun onLevel(level: Float) {
        _level.value = level
    }

    override fun onPartialText(text: String) {
        _state.update { it.copy(partialText = text) }
    }

    override fun onFinalText(text: String) {
        _level.value = 0f
        addMessage(Role.USER, text)
        _state.update { it.copy(phase = Phase.Thinking, partialText = "") }
        aiJob = viewModelScope.launch { askAi() }
    }

    override fun onError(error: SpeechError) {
        _level.value = 0f
        _state.update { it.copy(phase = Phase.Idle, partialText = "") }
        val p = phrases()
        when (error) {
            SpeechError.NO_SPEECH -> showProblem(p.heardNothing, aloud = false)
            SpeechError.NO_MATCH -> showProblem(p.didntCatch)
            SpeechError.NETWORK -> showProblem(p.noInternet)
            SpeechError.PERMISSION -> {
                showProblem(p.micDenied, aloud = false)
                events.trySend(UiEvent.AppInfoHint(MIC_HINT))
            }
            SpeechError.BUSY -> showProblem(p.sttBusy)
            SpeechError.UNAVAILABLE -> showProblem(p.sttUnavailable)
            SpeechError.LANGUAGE_UNSUPPORTED -> showProblem(p.sttLanguageUnavailable, aloud = false)
            SpeechError.AUDIO, SpeechError.SERVER, SpeechError.OTHER -> showProblem(p.genericError)
        }
    }

    /** The screen asked for the microphone and the user said no. */
    fun onMicPermissionDenied() {
        showProblem(phrases().micDenied, aloud = false)
        events.trySend(UiEvent.AppInfoHint(MIC_HINT))
    }

    // ---------------------------------------------------------------------------------------------
    // Asking the AI and acting on the answer
    // ---------------------------------------------------------------------------------------------

    private suspend fun askAi() {
        val s = settings.value
        val p = phrases()
        try {
            val key = container.apiKeys.get(s.provider)
            if (key.isBlank()) throw AiException.NoApiKey()
            if (!NetworkChecker.isOnline(app)) throw AiException.NoInternet()

            val request = AiRequest(
                apiKey = key,
                model = s.model,
                systemPrompt = JarvisPrompt.build(s.language),
                turns = ConversationHistory.buildTurns(_state.value.messages),
            )
            val raw = container.ai.chat(s.provider, request)
            respond(JarvisReply.parse(raw))
        } catch (e: CancellationException) {
            throw e
        } catch (e: AiException) {
            showProblem(p.forAiError(e), detail = technicalDetail(e))
        } catch (e: Exception) {
            showProblem(p.genericError, detail = e.javaClass.simpleName)
        }
    }

    /** Does what the AI asked, then speaks. */
    private suspend fun respond(reply: JarvisReply) {
        val s = settings.value
        val p = phrases()
        val outcome = try {
            container.actions.execute(reply, s, p)
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            ActionOutcome.Problem(p.genericError)
        }

        val aiSentence = reply.reply.ifBlank { p.defaultReply(reply) }
        when (outcome) {
            is ActionOutcome.Done -> deliver(outcome.spoken ?: aiSentence, reply.toHistoryJson())

            is ActionOutcome.Launch -> deliver(outcome.spoken ?: aiSentence, reply.toHistoryJson(), outcome)

            is ActionOutcome.Problem -> {
                // What the user heard is what the AI should remember (not an action that never happened).
                deliver(outcome.spoken, JarvisReply(outcome.spoken).toHistoryJson())
                if (outcome.permissions.isNotEmpty()) {
                    pendingAfterPermission = reply
                    events.trySend(UiEvent.RequestPermissions(outcome.permissions))
                }
                if (outcome.needsNotificationAccess) events.trySend(UiEvent.NeedNotificationAccess)
            }
        }
    }

    /** The screen finished asking Android for the permissions an action was waiting for. */
    fun onPermissionsResult(allGranted: Boolean) {
        refreshPermissions()
        val waiting = pendingAfterPermission ?: return
        pendingAfterPermission = null
        if (allGranted) {
            aiJob = viewModelScope.launch {
                _state.update { it.copy(phase = Phase.Thinking) }
                respond(waiting)
            }
        } else {
            events.trySend(UiEvent.Message(phrases().callsNeedPermission))
        }
    }

    private fun deliver(text: String, historyJson: String, launch: ActionOutcome.Launch? = null) {
        addMessage(Role.ASSISTANT, text, historyJson)
        pendingLaunch = launch
        speak(text)
    }

    private fun speak(text: String) {
        if (text.isBlank()) return finishSpeaking()
        _state.update { it.copy(phase = Phase.Speaking) }
        val s = settings.value
        tts.speak(text, s.language, s.voice) { finishSpeaking() }
    }

    private fun finishSpeaking() {
        _state.update { it.copy(phase = Phase.Idle) }
        val launch = pendingLaunch ?: return
        pendingLaunch = null
        if (!container.actions.start(launch.intent, launch.fallback)) {
            addMessage(Role.ASSISTANT, phrases().cantOpen, isError = true)
        }
    }

    /** An explanation bubble for something that went wrong. It is shown (and maybe spoken) but not sent to the AI. */
    private fun showProblem(text: String, aloud: Boolean = true, detail: String = "") {
        val shown = if (detail.isBlank()) text else "$text\n($detail)"
        addMessage(Role.ASSISTANT, shown, historyText = text, isError = true)
        if (aloud) speak(text) else _state.update { it.copy(phase = Phase.Idle) }
    }

    /** The provider's own explanation, for errors where it helps ("model X not found", "region not supported"). */
    private fun technicalDetail(e: AiException): String {
        val raw = when (e) {
            is AiException.BadRequest -> e.detail
            is AiException.PermissionDenied -> e.detail
            is AiException.ModelNotFound -> e.detail
            is AiException.ServerError -> e.detail
            else -> ""
        }
        return scrubKeys(raw).take(200)
    }

    private fun addMessage(role: Role, text: String, historyText: String = text, isError: Boolean = false) {
        val message = ChatMessage(nextMessageId++, role, text, historyText, isError)
        _state.update { it.copy(messages = (it.messages + message).takeLast(MAX_MESSAGES_KEPT)) }
    }

    // ---------------------------------------------------------------------------------------------
    // Everything else the screens can ask for
    // ---------------------------------------------------------------------------------------------

    /** Stops listening, thinking and speaking (leaving the screen, or the app going to the background). */
    fun stopEverything() {
        aiJob?.cancel()
        stt.cancel()
        tts.stop()
        pendingLaunch = null
        pendingAfterPermission = null
        _level.value = 0f
        _state.update { it.copy(phase = Phase.Idle, partialText = "") }
    }

    fun clearConversation() {
        stopEverything()
        _state.update { it.copy(messages = emptyList()) }
    }

    fun onQuickAction(action: QuickAction) {
        val p = phrases()
        if (action == QuickAction.FLASHLIGHT) {
            if (!container.torch.toggle()) events.trySend(UiEvent.Message(p.noFlashlight))
            return
        }
        val intent = container.actions.quickIntent(action)
        if (intent == null || !container.actions.start(intent)) {
            events.trySend(UiEvent.Message(if (action == QuickAction.WHATSAPP) p.whatsappMissing else p.cantOpen))
        }
    }

    // ----- Settings -----

    fun setProvider(value: AiProvider) = container.settings.setProvider(value)
    fun setModel(provider: AiProvider, model: String) = container.settings.setModel(provider, model)
    fun setCallsEnabled(value: Boolean) = container.settings.setCallsEnabled(value).also { refreshPermissions() }
    fun setNotificationsEnabled(value: Boolean) =
        container.settings.setNotificationsEnabled(value).also { refreshPermissions() }
    fun setOpenAppsEnabled(value: Boolean) = container.settings.setOpenAppsEnabled(value)

    fun setLanguage(value: AppLanguage) {
        container.settings.setLanguage(value)
        previewVoice()
    }

    fun setVoice(value: VoiceGender) {
        container.settings.setVoice(value)
        previewVoice()
    }

    /** Lets the user hear the language/voice they just chose. */
    private fun previewVoice() {
        stopEverything()
        val s = settings.value
        val sample = if (s.language == AppLanguage.HINDI) "नमस्ते, मैं जार्विस हूँ।" else "Hello, I am JARVIS."
        tts.speak(sample, s.language, s.voice) {}
    }

    suspend fun loadApiKey(provider: AiProvider): String = container.apiKeys.get(provider)

    fun saveApiKey(provider: AiProvider, key: String) {
        viewModelScope.launch {
            container.apiKeys.set(provider, key)
            events.send(UiEvent.Message(if (key.isBlank()) "API key removed" else "API key saved"))
        }
    }

    /** Shows a short message at the bottom of the screen. */
    fun showMessage(text: String) {
        events.trySend(UiEvent.Message(text))
    }

    /** Shows [text] with a "Settings" button that opens this app's page in the phone's Settings. */
    fun showAppInfoHint(text: String) {
        events.trySend(UiEvent.AppInfoHint(text))
    }

    /** Call when the app comes back to the front: the user may have changed permissions in system Settings. */
    fun refreshPermissions() {
        permissionTick.update { it + 1 }
    }

    private fun readPermissions(s: AppSettings) = PermissionState(
        calls = s.callsEnabled && Permissions.hasCalls(app),
        notifications = s.notificationsEnabled && Permissions.hasNotificationAccess(app),
        openApps = s.openAppsEnabled,
    )

    override fun onCleared() {
        stt.destroy()
        tts.shutdown()
        super.onCleared()
    }

    private companion object {
        const val MAX_MESSAGES_KEPT = 50
        const val MIC_HINT = "Microphone permission is off"

        /** Hides anything that looks like an API key before an error text is shown on screen. */
        private val KEY_LOOKALIKE = Regex("(sk-[A-Za-z0-9_\\-]{8,}|AIza[0-9A-Za-z_\\-]{10,})")

        fun scrubKeys(text: String): String = text.replace(KEY_LOOKALIKE, "***")
    }
}

package com.weplay.guesserai.service

import android.graphics.Bitmap
import android.graphics.Rect
import com.weplay.guesserai.data.HistoryRepository
import com.weplay.guesserai.data.WordBankRepository
import com.weplay.guesserai.data.settings.SettingsRepository
import com.weplay.guesserai.domain.AiModel
import com.weplay.guesserai.domain.AnswerStats
import com.weplay.guesserai.domain.AppSettings
import com.weplay.guesserai.domain.FrameAnalysis
import com.weplay.guesserai.domain.FrameChangeDetector
import com.weplay.guesserai.domain.Guess
import com.weplay.guesserai.domain.GuessEngine
import com.weplay.guesserai.domain.HintPattern
import com.weplay.guesserai.domain.PartialAnalysis
import com.weplay.guesserai.domain.PromptHints
import com.weplay.guesserai.domain.RankedGuess
import com.weplay.guesserai.domain.VisionAnalyzer
import com.weplay.guesserai.domain.VisionException
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeoutOrNull
import kotlin.math.max
import kotlin.math.roundToInt

enum class AiStatus { STARTING, ANALYZING, WATCHING, PAUSED, GAME_AWAY, ERROR }

data class OverlayUiState(
    val status: AiStatus = AiStatus.STARTING,
    val message: String = "Starting…",
    val thumbnail: Bitmap? = null,
    val detectedObject: String = "",
    val category: String = "",
    val emoji: String = "",
    val hint: HintPattern? = null,
    val guesses: List<RankedGuess> = emptyList(),
    val hintMismatch: Boolean = false,
    val lastLatencyMs: Long = 0,
    val toast: String? = null,
    /** Answer copied most recently, so the overlay can flash "✓ Copied" on that row. */
    val copied: String? = null,
) {
    val isPaused: Boolean get() = status == AiStatus.PAUSED
}

/**
 * The capture → analyse → rank loop, tuned for low latency:
 *  - captures run on a fixed beat (the interval counts from the start of each capture),
 *  - up to [MAX_IN_FLIGHT] requests overlap; once a newer frame starts answering, older
 *    requests are cancelled and their results ignored,
 *  - replies stream in and each complete guess is shown immediately,
 *  - frames that did not change are never sent.
 * All state is touched on the main thread ([scope] is the service's lifecycle scope).
 */
class AssistantSession(
    private val scope: CoroutineScope,
    private val capturer: ScreenCapturer,
    private val analyzer: VisionAnalyzer,
    private val history: HistoryRepository,
    private val settingsRepo: SettingsRepository,
    private val wordBanks: WordBankRepository,
    private val gameMonitor: GameAppMonitor,
    private val isScreenOn: () -> Boolean,
    /** Overlay bounds in real screen pixels, to mask it out of captures. */
    private val overlayRect: () -> Rect?,
) {
    private val _state = MutableStateFlow(OverlayUiState())
    val state: StateFlow<OverlayUiState> = _state.asStateFlow()

    private val engine = GuessEngine()
    private val changes = FrameChangeDetector()
    private val wake = Channel<Unit>(Channel.CONFLATED)

    private var paused = false
    private var forceNext = true
    private var loopJob: Job? = null

    // Requests
    private var seqStarted = 0L
    private var seqApplied = 0L
    private val inFlight = LinkedHashMap<Long, Job>()
    private var backoffMs = 0L
    private var notGameStreak = 0

    // Per-round memory, reset when the hint changes or the canvas is cleared.
    private val rejected = mutableSetOf<String>()
    private var smoothed = mapOf<String, Int>()
    private var prevRaw = emptyList<Guess>()
    private var roundHint: HintPattern? = null
    private var knownForHint = emptyList<String>()
    private var canvasBox: List<Float>? = null
    private var lastJpeg: ByteArray? = null
    private var stats = emptyMap<String, AnswerStats>()

    fun start() {
        if (loopJob != null) return
        refreshStats()
        loopJob = scope.launch { loop() }
    }

    fun stop() {
        loopJob?.cancel()
        loopJob = null
        cancelInFlight()
    }

    fun togglePause() {
        paused = !paused
        if (paused) {
            cancelInFlight()
            _state.update { it.copy(status = AiStatus.PAUSED, message = "AI paused") }
        } else {
            forceNext = true
            _state.update { it.copy(status = AiStatus.WATCHING, message = "Resuming…") }
            wake.trySend(Unit)
        }
    }

    /** Re-analyse now, even if the drawing did not change, and forget this round's rejections. */
    fun refresh() {
        resetRound()
        forceNext = true
        _state.update { it.copy(message = "Refreshing…") }
        if (paused) togglePause() else wake.trySend(Unit)
    }

    /** "Next Guess": the top answer was wrong; drop it and promote the next one. Returns the new top answer. */
    fun nextGuess(): String? {
        val current = _state.value.guesses.firstOrNull() ?: return null
        rejected += GuessEngine.normalize(current.answer)
        scope.launch { history.recordRejected(current.answer); refreshStats() }
        val remaining = _state.value.guesses.drop(1)
        val next = remaining.firstOrNull()?.answer
        _state.update { it.copy(guesses = remaining, copied = next) }
        return next
    }

    fun markCopied(answer: String) = _state.update { it.copy(copied = answer) }

    /** Long-press on a guess: it was the right answer — teach the learning database. */
    fun markCorrect(guess: RankedGuess) {
        val s = _state.value
        val jpeg = if (settingsRepo.current.saveScreenshots) lastJpeg else null
        scope.launch {
            history.recordCorrect(guess.answer, jpeg, s.guesses, s.hint, s.category)
            refreshStats()
            _state.update { it.copy(toast = "Saved \"${guess.answer}\" — AI will remember it") }
        }
        resetRound()
        changes.reset()
    }

    fun consumeToast() = _state.update { it.copy(toast = null) }

    // ---------------------------------------------------------------- loop

    private suspend fun loop() {
        _state.update { it.copy(status = AiStatus.WATCHING, message = "Waiting for the game…") }
        withTimeoutOrNull(300) { wake.receive() } // first frame from the projection
        while (scope.isActive) {
            val tickStart = System.currentTimeMillis()
            val settings = settingsRepo.current
            val interval = settings.captureSpeed.seconds * 1000L

            val skip = when {
                paused -> 60_000L
                !isScreenOn() -> 3_000L
                settings.autoPauseWhenGameClosed && gameMonitor.isGameInForeground(settings.gamePackage) == false -> {
                    _state.update { it.copy(status = AiStatus.GAME_AWAY, message = "WePlay not open — AI sleeping") }
                    2_000L
                }
                else -> 0L
            }
            if (skip > 0) { waitFor(skip); continue }

            val frame = withContext(Dispatchers.Default) { capturer.capture() }
            if (frame != null) {
                runCatching { tick(frame, settings) }.onFailure { handleError(it, isNewest = true) }
                frame.recycle()
            }

            val elapsed = System.currentTimeMillis() - tickStart
            waitFor(max(MIN_GAP_MS, interval + backoffMs - elapsed))
        }
    }

    private suspend fun tick(frame: Bitmap, settings: AppSettings) {
        val (fingerprint, changed) = withContext(Dispatchers.Default) {
            overlayRect()?.let { r ->
                val s = capturer.scale
                FrameTools.maskRect(frame, Rect((r.left * s).toInt(), (r.top * s).toInt(), (r.right * s).toInt(), (r.bottom * s).toInt()))
            }
            val fp = FrameTools.fingerprint(frame)
            fp to (forceNext || changes.hasChanged(fp))
        }
        if (!changed) {
            if (inFlight.isEmpty()) {
                _state.update {
                    if (it.status == AiStatus.ERROR) it
                    else it.copy(status = AiStatus.WATCHING, message = "Watching for new strokes…")
                }
            }
            return
        }
        // Too many requests already running: leave the frame "changed" so the next beat sends it.
        if (inFlight.size >= MAX_IN_FLIGHT) return

        changes.accept(fingerprint)
        forceNext = false
        val box = canvasBox
        val (jpeg, thumb) = withContext(Dispatchers.Default) {
            FrameTools.toJpeg(frame) to (if (settings.compactOverlay) null else FrameTools.thumbnail(frame, box))
        }
        if (thumb != null) _state.update { it.copy(thumbnail = thumb) }
        launchRequest(jpeg, settings)
    }

    private fun launchRequest(jpeg: ByteArray, settings: AppSettings) {
        val seq = ++seqStarted
        val bank = wordBanks.get(settings.customWords)
        val hints = PromptHints(
            lastHint = roundHint,
            knownAnswers = knownForHint,
            wordListCandidates = bank.candidates(roundHint, PROMPT_CANDIDATES).map { it.answer },
        )
        _state.update {
            if (it.status == AiStatus.PAUSED) it else it.copy(status = AiStatus.ANALYZING, message = "Analyzing drawing…")
        }
        val started = System.currentTimeMillis()
        val job = scope.launch {
            try {
                val analysis = analyzer.analyze(jpeg, hints, settings) { partial ->
                    // Called on the network thread; hop to main so state changes stay ordered.
                    scope.launch { onPartial(seq, partial) }
                }
                onFinal(seq, analysis, jpeg, System.currentTimeMillis() - started)
            } catch (e: CancellationException) {
                throw e
            } catch (e: Throwable) {
                handleError(e, isNewest = seq == seqStarted)
            } finally {
                inFlight.remove(seq)
                if (inFlight.isEmpty()) {
                    _state.update { if (it.status == AiStatus.ANALYZING) it.copy(status = AiStatus.WATCHING) else it }
                }
            }
        }
        inFlight[seq] = job
    }

    /** Results from frame [seq] may be shown; anything older still running is now stale. */
    private fun claim(seq: Long): Boolean {
        if (seq < seqApplied) return false
        if (seq > seqApplied) {
            seqApplied = seq
            inFlight.filterKeys { it < seq }.values.forEach { it.cancel() }
        }
        return true
    }

    private fun onPartial(seq: Long, p: PartialAnalysis) {
        if (paused || p.isDrawingGame == false || p.guesses.isEmpty() || !claim(seq)) return
        if (p.canvasEmpty == true) return
        p.hint?.let { newRoundIfHintChanged(it) }
        // Keep last frame's guesses visible (slightly faded in confidence) until the new list catches up.
        val seen = p.guesses.mapTo(HashSet()) { GuessEngine.normalize(it.answer) }
        val carried = prevRaw.filter { GuessEngine.normalize(it.answer) !in seen }
            .map { it.copy(confidence = (it.confidence * 0.85).roundToInt()) }
        val ranked = rank(p.guesses + carried)
        _state.update { it.copy(guesses = ranked.guesses, hint = roundHint ?: it.hint, hintMismatch = ranked.hintMismatch) }
    }

    private fun onFinal(seq: Long, a: FrameAnalysis, jpeg: ByteArray, latency: Long) {
        if (!claim(seq)) return
        backoffMs = 0

        if (!a.isDrawingGame) {
            notGameStreak++
            if (notGameStreak >= 3) backoffMs = 6_000 // nothing to solve: check far less often
            _state.update {
                it.copy(
                    status = if (paused) AiStatus.PAUSED else AiStatus.WATCHING,
                    message = if (notGameStreak >= 3) "No drawing game on screen" else "Looking for the game…",
                    lastLatencyMs = latency,
                )
            }
            return
        }
        notGameStreak = 0
        if (a.canvasEmpty) resetRound()
        a.hint?.let { newRoundIfHintChanged(it) }
        a.canvasBox?.let { canvasBox = it }
        if (settingsRepo.current.saveScreenshots) lastJpeg = jpeg

        val ranked = rank(a.guesses)
        smoothed = ranked.guesses.associate { GuessEngine.normalize(it.answer) to it.confidence }
        prevRaw = a.guesses

        _state.update {
            it.copy(
                status = when {
                    paused -> AiStatus.PAUSED
                    inFlight.keys.any { k -> k > seq } -> AiStatus.ANALYZING
                    else -> AiStatus.WATCHING
                },
                message = if (a.canvasEmpty) "Canvas is empty — waiting" else liveMessage(a.modelUsed, latency),
                detectedObject = a.detectedObject,
                category = a.category,
                emoji = a.emoji,
                hint = roundHint ?: it.hint,
                guesses = if (a.canvasEmpty) emptyList() else ranked.guesses,
                hintMismatch = ranked.hintMismatch,
                lastLatencyMs = latency,
            )
        }
    }

    private fun rank(guesses: List<Guess>) = engine.rank(
        guesses = guesses,
        hint = roundHint,
        rejected = rejected,
        history = stats,
        previous = smoothed,
        wordBank = wordBanks.get(settingsRepo.current.customWords),
        knownAnswers = knownForHint,
    )

    private fun liveMessage(modelUsed: String, latency: Long): String {
        val name = AiModel.entries.firstOrNull { it.id == modelUsed }?.label?.removePrefix("Claude ")?.substringBefore(' ')
            ?: modelUsed.ifBlank { "AI" }
        val note = if (settingsRepo.current.model == AiModel.HAIKU && modelUsed == AiModel.OPUS.id) " (Haiku n/a)" else ""
        return "Live • $name$note • ${latency / 100 / 10.0}s"
    }

    private fun newRoundIfHintChanged(hint: HintPattern) {
        if (hint == roundHint) return
        if (roundHint != null) resetRound() // a different hint means a new word
        roundHint = hint
        knownForHint = emptyList()
        scope.launch { knownForHint = history.knownAnswers(hint) }
    }

    private fun resetRound() {
        rejected.clear()
        smoothed = emptyMap()
        prevRaw = emptyList()
    }

    private fun refreshStats() {
        scope.launch { stats = history.stats() }
    }

    private fun cancelInFlight() {
        inFlight.values.forEach { it.cancel() }
        inFlight.clear()
    }

    private fun handleError(e: Throwable, isNewest: Boolean) {
        if (!isNewest) return // a newer request is already on its way
        val (msg, pause) = when (e) {
            is VisionException.InvalidKey -> "Invalid API key — check Settings" to true
            is VisionException.ModelNotFound -> "Model not found — check Settings" to true
            is VisionException.RateLimited -> { backoffMs = (backoffMs * 2).coerceIn(4_000, 60_000); e.message!! to false }
            is VisionException -> { backoffMs = (backoffMs + 1_000).coerceAtMost(10_000); (e.message ?: "AI error") to false }
            else -> { backoffMs = (backoffMs + 1_000).coerceAtMost(10_000); "Error: ${e.message ?: e.javaClass.simpleName}" to false }
        }
        forceNext = true
        if (pause) { paused = true; cancelInFlight() }
        _state.update { it.copy(status = if (pause) AiStatus.PAUSED else AiStatus.ERROR, message = msg) }
    }

    /** Sleeps up to [ms], waking early on refresh / resume. */
    private suspend fun waitFor(ms: Long) {
        withTimeoutOrNull(ms) { wake.receive() }
    }

    private companion object {
        const val MAX_IN_FLIGHT = 2
        const val MIN_GAP_MS = 150L
        const val PROMPT_CANDIDATES = 40
    }
}

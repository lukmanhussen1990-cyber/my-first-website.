package com.weplay.guesserai.service

import android.graphics.Bitmap
import android.graphics.Rect
import com.weplay.guesserai.data.HistoryRepository
import com.weplay.guesserai.data.settings.SettingsRepository
import com.weplay.guesserai.domain.FrameAnalysis
import com.weplay.guesserai.domain.FrameChangeDetector
import com.weplay.guesserai.domain.GuessEngine
import com.weplay.guesserai.domain.HintPattern
import com.weplay.guesserai.domain.RankedGuess
import com.weplay.guesserai.domain.VisionAnalyzer
import com.weplay.guesserai.domain.VisionException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeoutOrNull

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
) {
    val isPaused: Boolean get() = status == AiStatus.PAUSED
}

/**
 * The capture → analyse → rank loop. One request in flight at a time; the next capture waits
 * for the configured interval after the previous answer, and frames that did not change are
 * never sent.
 */
class AssistantSession(
    private val scope: CoroutineScope,
    private val capturer: ScreenCapturer,
    private val analyzer: VisionAnalyzer,
    private val history: HistoryRepository,
    private val settingsRepo: SettingsRepository,
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

    @Volatile private var paused = false
    @Volatile private var forceNext = true
    private var job: Job? = null

    // Per-round memory, reset when the hint changes or the canvas is cleared.
    private val rejected = mutableSetOf<String>()
    private var smoothed = mapOf<String, Int>()
    private var lastAnalysis: FrameAnalysis? = null
    private var lastJpeg: ByteArray? = null
    private var notGameStreak = 0
    private var backoffMs = 0L

    fun start() {
        if (job != null) return
        job = scope.launch { loop() }
    }

    fun stop() {
        job?.cancel()
        job = null
    }

    fun togglePause() {
        paused = !paused
        if (paused) {
            _state.update { it.copy(status = AiStatus.PAUSED, message = "AI paused") }
        } else {
            forceNext = true
            _state.update { it.copy(status = AiStatus.WATCHING, message = "Resuming…") }
            wake.trySend(Unit)
        }
    }

    /** Re-analyse now, even if the drawing did not change, and forget this round's rejections. */
    fun refresh() {
        rejected.clear()
        smoothed = emptyMap()
        forceNext = true
        if (paused) togglePause() else wake.trySend(Unit)
        _state.update { it.copy(message = "Refreshing…") }
    }

    /** "Next Guess": the top answer was wrong; drop it and promote the next one. */
    fun nextGuess(): String? {
        val current = _state.value.guesses.firstOrNull() ?: return null
        rejected += GuessEngine.normalize(current.answer)
        scope.launch { history.recordRejected(current.answer) }
        val remaining = _state.value.guesses.drop(1)
        _state.update { it.copy(guesses = remaining, toast = remaining.firstOrNull()?.let { g -> "Next: ${g.answer} (copied)" }) }
        return remaining.firstOrNull()?.answer
    }

    /** Long-press on a guess: it was the right answer — teach the learning database. */
    fun markCorrect(guess: RankedGuess) {
        val s = _state.value
        val jpeg = if (settingsRepo.current.saveScreenshots) lastJpeg else null
        scope.launch {
            history.recordCorrect(guess.answer, jpeg, s.guesses, s.hint, s.category)
            _state.update { it.copy(toast = "Saved \"${guess.answer}\" — AI will remember it") }
        }
        // The round is over; start fresh for the next drawing.
        resetRound()
    }

    fun consumeToast() = _state.update { it.copy(toast = null) }

    private fun resetRound() {
        rejected.clear()
        smoothed = emptyMap()
        changes.reset()
    }

    private suspend fun loop() {
        _state.update { it.copy(status = AiStatus.WATCHING, message = "Waiting for the game…") }
        delay(600) // let the projection deliver its first frame
        while (scope.isActive) {
            val settings = settingsRepo.current
            val interval = settings.captureSpeed.seconds * 1000L

            when {
                paused -> { waitFor(60_000); continue }
                !isScreenOn() -> { waitFor(3_000); continue }
                settings.autoPauseWhenGameClosed && gameMonitor.isGameInForeground(settings.gamePackage) == false -> {
                    _state.update { it.copy(status = AiStatus.GAME_AWAY, message = "WePlay not open — AI sleeping") }
                    waitFor(2_000)
                    continue
                }
            }

            val frame = withContext(Dispatchers.Default) { capturer.capture() }
            if (frame == null) { waitFor(500); continue }

            val outcome = runCatching { processFrame(frame, settings.saveScreenshots) }
            frame.recycle()
            outcome.exceptionOrNull()?.let { handleError(it) }

            waitFor(interval + backoffMs)
        }
    }

    private suspend fun processFrame(frame: Bitmap, keepJpeg: Boolean) {
        val (jpeg, changed) = withContext(Dispatchers.Default) {
            overlayRect()?.let { r ->
                val s = capturer.scale
                FrameTools.maskRect(frame, Rect((r.left * s).toInt(), (r.top * s).toInt(), (r.right * s).toInt(), (r.bottom * s).toInt()))
            }
            val fp = FrameTools.fingerprint(frame)
            val changed = forceNext || changes.hasChanged(fp)
            if (changed) changes.accept(fp)
            (if (changed) FrameTools.toJpeg(frame) else null) to changed
        }
        if (!changed || jpeg == null) {
            _state.update {
                if (it.status == AiStatus.ERROR) it
                else it.copy(status = AiStatus.WATCHING, message = "Watching for new strokes…")
            }
            return
        }
        forceNext = false

        _state.update { it.copy(status = AiStatus.ANALYZING, message = "Analyzing drawing…") }
        val started = System.currentTimeMillis()
        val known = history.knownAnswers(lastAnalysis?.hint)
        val analysis = analyzer.analyze(jpeg, known, settingsRepo.current)
        val latency = System.currentTimeMillis() - started
        backoffMs = 0
        if (keepJpeg) lastJpeg = jpeg

        if (!analysis.isDrawingGame) {
            notGameStreak++
            _state.update {
                it.copy(
                    status = AiStatus.WATCHING,
                    message = if (notGameStreak >= 3) "No drawing game on screen" else "Looking for the game…",
                    lastLatencyMs = latency,
                )
            }
            if (notGameStreak >= 3) backoffMs = 8_000 // nothing to solve: check far less often
            return
        }
        notGameStreak = 0

        val prev = lastAnalysis
        if (analysis.canvasEmpty || (prev?.hint != null && analysis.hint != null && prev.hint != analysis.hint)) {
            resetRound()
        }
        lastAnalysis = analysis

        val ranked = engine.rank(analysis.guesses, analysis.hint, rejected, history.stats(), smoothed)
        smoothed = ranked.guesses.associate { GuessEngine.normalize(it.answer) to it.confidence }
        val thumb = withContext(Dispatchers.Default) { FrameTools.thumbnail(frame, analysis.canvasBox) }

        _state.update {
            it.copy(
                status = AiStatus.WATCHING,
                message = if (analysis.canvasEmpty) "Canvas is empty — waiting" else "Live • ${latency / 100 / 10.0}s",
                thumbnail = thumb,
                detectedObject = analysis.detectedObject,
                category = analysis.category,
                emoji = analysis.emoji,
                hint = analysis.hint ?: it.hint,
                guesses = if (analysis.canvasEmpty) emptyList() else ranked.guesses.take(10),
                hintMismatch = ranked.hintMismatch,
                lastLatencyMs = latency,
            )
        }
    }

    private fun handleError(e: Throwable) {
        val (msg, pause) = when (e) {
            is VisionException.InvalidKey -> "Invalid API key — check Settings" to true
            is VisionException.ModelNotFound -> "Model not found — check Settings" to true
            is VisionException.RateLimited -> { backoffMs = (backoffMs * 2).coerceIn(5_000, 60_000); e.message!! to false }
            is VisionException -> { backoffMs = (backoffMs + 2_000).coerceAtMost(15_000); (e.message ?: "AI error") to false }
            else -> { backoffMs = (backoffMs + 2_000).coerceAtMost(15_000); "Error: ${e.message ?: e.javaClass.simpleName}" to false }
        }
        forceNext = true
        if (pause) paused = true
        _state.update { it.copy(status = if (pause) AiStatus.PAUSED else AiStatus.ERROR, message = msg) }
    }

    /** Sleeps up to [ms], waking early on refresh / resume. */
    private suspend fun waitFor(ms: Long) {
        withTimeoutOrNull(ms) { wake.receive() }
    }
}

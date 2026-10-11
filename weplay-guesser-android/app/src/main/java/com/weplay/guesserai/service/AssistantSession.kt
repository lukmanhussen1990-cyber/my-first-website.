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
import com.weplay.guesserai.domain.FrameImages
import com.weplay.guesserai.domain.HintPattern
import com.weplay.guesserai.domain.LayoutLearner
import com.weplay.guesserai.domain.PartialAnalysis
import com.weplay.guesserai.domain.PromptHints
import com.weplay.guesserai.domain.RankedGuess
import com.weplay.guesserai.domain.RoundTracker
import com.weplay.guesserai.domain.ScreenState
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
    /** The hint was set by hand in the overlay and the AI's reading is ignored until the round ends. */
    val hintManual: Boolean = false,
    /** The answer the game showed (we guessed it, or the round ended); pinned above the guesses. */
    val answer: String? = null,
) {
    val isPaused: Boolean get() = status == AiStatus.PAUSED
}

/**
 * The capture → analyse → rank loop, tuned for low latency:
 *  - captures run on a fixed beat (the interval counts from the start of each capture),
 *  - up to [MAX_IN_FLIGHT] requests overlap; once a newer frame starts answering, older
 *    requests are cancelled and their results ignored,
 *  - replies stream in and each complete guess is shown immediately,
 *  - only changes on the canvas or in the hint trigger a request,
 *  - close-ups of the hint and the canvas are sent, from the measured WePlay layout; a
 *    whole-screen look now and then checks the layout and the game state.
 * Round logic (hints, round ends, revealed answers, guess history) lives in [RoundTracker].
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

    private val tracker = RoundTracker()
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

    // Layout: measured WePlay layout, corrected only by repeated whole-screen looks.
    private var learner: LayoutLearner? = null
    private var aspect = 0f
    private var croppedSinceFull = FULL_LOOK_EVERY // first request looks at the whole screen
    private var cropMisses = 0

    // Learning
    private var stats = emptyMap<String, AnswerStats>()
    private var knownForHint = emptyList<String>()
    private var knownLoadedFor: HintPattern? = null
    private var lastCanvasJpeg: ByteArray? = null

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

    /** Start this word over with a whole-screen look: re-read the hint, forget guesses and rejections. */
    fun refresh() {
        show(tracker.refresh(ctx()))
        croppedSinceFull = FULL_LOOK_EVERY
        forceNext = true
        _state.update { it.copy(message = "Refreshing…") }
        if (paused) togglePause() else wake.trySend(Unit)
    }

    /** "Next Guess": the top answer was wrong; drop it and promote the next one. Returns the new top answer. */
    fun nextGuess(): String? {
        val r = tracker.next(ctx()) ?: return null
        scope.launch { history.recordRejected(r.rejected); refreshStats() }
        show(r.view)
        val next = r.view.guesses.firstOrNull()?.answer
        _state.update { it.copy(copied = next) }
        return next
    }

    fun markCopied(answer: String) = _state.update { it.copy(copied = answer) }

    /** Long-press on a guess: it was the right answer — teach the learning database. */
    fun markCorrect(guess: RankedGuess) {
        val before = _state.value
        val outcome = tracker.markCorrect(guess.answer, ctx())
        outcome.learn?.let { learn(it, before.guesses, tracker.hint ?: before.hint, before.category) }
        show(outcome.view)
        _state.update { it.copy(toast = "Saved \"${guess.answer}\" — AI will remember it") }
    }

    /** +/- on the overlay's hint editor. Locks the hint for this round. */
    fun adjustHint(dWords: Int, dLetters: Int) {
        show(tracker.adjustHint(dWords, dLetters, ctx()))
        forceNext = true
        wake.trySend(Unit)
    }

    /** Back to the AI's reading of the hint. */
    fun clearManualHint() {
        show(tracker.clearManualHint(ctx()))
        forceNext = true
        wake.trySend(Unit)
    }

    /** Screen rotated or resized: start again from the measured layout. */
    fun onScreenChanged() {
        aspect = 0f
        croppedSinceFull = FULL_LOOK_EVERY
        forceNext = true
    }

    fun consumeToast() = _state.update { it.copy(toast = null) }

    // ---------------------------------------------------------------- loop

    private suspend fun loop() {
        _state.update { it.copy(status = AiStatus.WATCHING, message = "Waiting for the game…") }
        withTimeoutOrNull(300) { wake.receive() } // first frame from the projection
        while (scope.isActive) {
            val tickStart = System.currentTimeMillis()
            val settings = settingsRepo.current
            // Once the game showed the answer, just keep an eye out for the next word.
            val interval = max(settings.captureSpeed.seconds * 1000L, if (tracker.solved) SOLVED_INTERVAL_MS else 0L)

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
        val frameAspect = frame.height.toFloat() / frame.width
        if (learner == null || kotlin.math.abs(frameAspect - aspect) > 0.01f) {
            aspect = frameAspect
            learner = LayoutLearner(frameAspect)
        }
        val lay = learner?.layout
        val sendFull = lay == null || croppedSinceFull >= FULL_LOOK_EVERY
        val (fingerprint, changed) = withContext(Dispatchers.Default) {
            overlayRect()?.let { r ->
                val s = capturer.scale
                FrameTools.maskRect(frame, Rect((r.left * s).toInt(), (r.top * s).toInt(), (r.right * s).toInt(), (r.bottom * s).toInt()))
            }
            // Watch only the canvas and the hint text — not the chat, the timer or the players.
            val fp = if (lay == null) FrameTools.fingerprint(frame)
            else FrameTools.fingerprint(frame, lay.canvas, 40, 40) + FrameTools.fingerprint(frame, lay.hintCenter, 24, 4)
            fp to (forceNext || changes.hasChanged(fp))
        }
        if (!changed) {
            if (inFlight.isEmpty()) {
                _state.update {
                    when {
                        it.status == AiStatus.ERROR -> it
                        it.answer != null && tracker.solved -> it.copy(status = AiStatus.WATCHING, message = "Solved — waiting for the next word")
                        else -> it.copy(status = AiStatus.WATCHING, message = "Watching for new strokes…")
                    }
                }
            }
            return
        }
        // Too many requests already running: leave the frame "changed" so the next beat sends it.
        if (inFlight.size >= MAX_IN_FLIGHT) return

        changes.accept(fingerprint)
        forceNext = false
        val (images, thumb) = withContext(Dispatchers.Default) {
            val imgs = if (sendFull || lay == null) {
                FrameImages(full = FrameTools.toJpeg(frame, maxSide = 896, quality = 75))
            } else {
                FrameImages(
                    hintBar = FrameTools.toJpeg(frame, lay.hint, maxSide = 900, quality = 85),
                    canvas = FrameTools.toJpeg(frame, lay.canvas, pad = 0.01f, maxSide = 768, quality = 75),
                )
            }
            imgs to (if (settings.compactOverlay) null else FrameTools.thumbnail(frame, lay?.canvas))
        }
        if (thumb != null) _state.update { it.copy(thumbnail = thumb) }
        if (images.isCropped) croppedSinceFull++ else croppedSinceFull = 0
        launchRequest(images, settings)
    }

    private fun launchRequest(images: FrameImages, settings: AppSettings) {
        val seq = ++seqStarted
        val hint = tracker.hint
        val hints = PromptHints(
            lastHint = hint,
            knownAnswers = knownForHint,
            wordListCandidates = wordBanks.get(settings.customWords).candidates(hint, PROMPT_CANDIDATES).map { it.answer },
        )
        _state.update {
            if (it.status == AiStatus.PAUSED) it else it.copy(status = AiStatus.ANALYZING, message = "Analyzing drawing…")
        }
        val started = System.currentTimeMillis()
        val job = scope.launch {
            try {
                val analysis = analyzer.analyze(images, hints, settings) { partial ->
                    // Called on the network thread; hop to main so state changes stay ordered.
                    scope.launch { onPartial(seq, partial) }
                }
                onFinal(seq, analysis, images, System.currentTimeMillis() - started)
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
        if (paused || seq < seqApplied) return
        val view = tracker.partial(seq, p, ctx()) ?: return
        claim(seq)
        show(view)
    }

    private fun onFinal(seq: Long, a: FrameAnalysis, images: FrameImages, latency: Long) {
        if (!claim(seq)) return
        backoffMs = 0
        val before = _state.value

        if (a.screenState == ScreenState.NOT_GAME) {
            notGameStreak++
            // Close-ups that show no game: look at the whole screen next time.
            if (images.isCropped && ++cropMisses >= 2) croppedSinceFull = FULL_LOOK_EVERY
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
        cropMisses = 0
        // Learn the layout only from a normal guessing screen (never from a popup).
        if (!images.isCropped && a.screenState == ScreenState.GUESSING) learner?.onFullLook(a.canvasBox, a.hintBox)
        if (a.screenState == ScreenState.GUESSING) lastCanvasJpeg = images.canvas ?: images.full

        val hintBefore = tracker.hint ?: before.hint
        val outcome = tracker.final(seq, a, ctx())
        // Save with what was on screen for this word, not the reset list of the next one.
        outcome.learn?.let { learn(it, before.guesses, hintBefore, before.category) }
        show(outcome.view)

        val message = when {
            outcome.view.answer != null && (outcome.roundOver || tracker.solved) -> "✓ Answer: ${outcome.view.answer}"
            a.canvasEmpty -> "Canvas is empty — waiting"
            else -> liveMessage(a.modelUsed, latency)
        }
        _state.update {
            it.copy(
                status = when {
                    paused -> AiStatus.PAUSED
                    inFlight.keys.any { k -> k > seq } -> AiStatus.ANALYZING
                    else -> AiStatus.WATCHING
                },
                message = message,
                detectedObject = if (a.screenState == ScreenState.GUESSING) a.detectedObject else it.detectedObject,
                category = if (a.screenState == ScreenState.GUESSING) a.category else it.category,
                emoji = if (a.screenState == ScreenState.GUESSING) a.emoji else it.emoji,
                lastLatencyMs = latency,
            )
        }
    }

    /** Push a tracker view to the overlay, and fetch learned answers when the hint changed. */
    private fun show(view: RoundTracker.View) {
        _state.update {
            it.copy(
                guesses = view.guesses,
                hint = view.hint,
                hintManual = view.hintManual,
                hintMismatch = view.hintMismatch,
                answer = view.answer,
            )
        }
        if (view.hint != knownLoadedFor) loadKnownAnswers(view.hint)
    }

    private fun ctx() = RoundTracker.Context(
        wordBank = wordBanks.get(settingsRepo.current.customWords),
        stats = stats,
        knownAnswers = knownForHint,
    )

    /** Save an answer the game showed (or the user confirmed) with the last drawing. */
    private fun learn(answer: String, guesses: List<RankedGuess>, hint: HintPattern?, category: String) {
        val jpeg = if (settingsRepo.current.saveScreenshots) lastCanvasJpeg else null
        scope.launch {
            history.recordCorrect(answer, jpeg, guesses, hint, category)
            refreshStats()
        }
    }

    private fun loadKnownAnswers(hint: HintPattern?) {
        knownLoadedFor = hint
        knownForHint = emptyList()
        if (hint == null) return
        scope.launch {
            val known = history.knownAnswers(hint)
            if (knownLoadedFor == hint) {
                knownForHint = known
                if (known.isNotEmpty()) show(tracker.view(ctx()))
            }
        }
    }

    private fun liveMessage(modelUsed: String, latency: Long): String {
        val name = AiModel.entries.firstOrNull { it.id == modelUsed }?.label?.removePrefix("Claude ")?.substringBefore(' ')
            ?: modelUsed.ifBlank { "AI" }
        val note = if (settingsRepo.current.model == AiModel.HAIKU && modelUsed == AiModel.OPUS.id) " (Haiku n/a)" else ""
        return "Live • $name$note • ${latency / 100 / 10.0}s"
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
        /** Whole-screen look every so often: checks the layout and spots popups the close-ups miss. */
        const val FULL_LOOK_EVERY = 12
        const val SOLVED_INTERVAL_MS = 2_500L
    }
}

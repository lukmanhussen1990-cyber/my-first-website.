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
    /** The hint was set by hand in the overlay and the AI's reading is ignored until the round ends. */
    val hintManual: Boolean = false,
) {
    val isPaused: Boolean get() = status == AiStatus.PAUSED
}

/**
 * The capture → analyse → rank loop, tuned for low latency:
 *  - captures run on a fixed beat (the interval counts from the start of each capture),
 *  - up to [MAX_IN_FLIGHT] requests overlap; once a newer frame starts answering, older
 *    requests are cancelled and their results ignored,
 *  - replies stream in and each complete guess is shown immediately,
 *  - frames that did not change are never sent,
 *  - after one whole-screen look the layout is known and only close-ups of the hint and the
 *    canvas are sent (sharper hint, smaller upload),
 *  - a new hint reading must be seen twice before it replaces the current one, and the user can
 *    set the hint by hand.
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
    private var aiHint: HintPattern? = null
    private var manualHint: HintPattern? = null
    private var pendingHint: HintPattern? = null
    private var pendingVotes = 0
    private var lastVotedSeq = 0L
    private val roundHint: HintPattern? get() = manualHint ?: aiHint
    private var knownForHint = emptyList<String>()

    // Where the canvas and the hint are on screen, learned from a whole-screen look.
    private var layout: Layout? = null
    private var croppedSinceFull = 0
    private var cropMisses = 0
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

    /** Re-analyse now with a whole-screen look, re-read the hint, and forget this round's rejections. */
    fun refresh() {
        resetRound()
        aiHint = null
        pendingHint = null
        pendingVotes = 0
        croppedSinceFull = FULL_LOOK_EVERY
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

    /** +/- on the overlay's hint editor. Locks the hint for this round. */
    fun adjustHint(dWords: Int, dLetters: Int) {
        val base = roundHint ?: HintPattern(1, 4)
        val words = (base.wordCount + dWords).coerceIn(1, 6)
        val letters = (base.letterCount + dLetters).coerceIn(words, 40)
        setManualHint(HintPattern(words, letters))
    }

    /** Back to the AI's reading of the hint. */
    fun clearManualHint() = setManualHint(null)

    private fun setManualHint(h: HintPattern?) {
        manualHint = h
        loadKnownAnswers()
        rerankShown()
        forceNext = true
        wake.trySend(Unit)
    }

    /** Screen rotated or resized: learn the layout again. */
    fun onScreenChanged() {
        layout = null
        forceNext = true
    }

    /** Long-press on a guess: it was the right answer — teach the learning database. */
    fun markCorrect(guess: RankedGuess) {
        val s = _state.value
        val jpeg = if (settingsRepo.current.saveScreenshots) lastJpeg else null
        scope.launch {
            history.recordCorrect(guess.answer, jpeg, s.guesses, s.hint, s.category)
            refreshStats()
            _state.update { it.copy(toast = "Saved \"${guess.answer}\" — AI will remember it") }
        }
        endRound()
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
        val lay = layout
        val sendFull = lay == null || croppedSinceFull >= FULL_LOOK_EVERY
        val (fingerprint, changed) = withContext(Dispatchers.Default) {
            overlayRect()?.let { r ->
                val s = capturer.scale
                FrameTools.maskRect(frame, Rect((r.left * s).toInt(), (r.top * s).toInt(), (r.right * s).toInt(), (r.bottom * s).toInt()))
            }
            // Watch only the canvas and the middle of the hint (not the chat or the timer) once we know where they are.
            val fp = if (lay == null) FrameTools.fingerprint(frame)
            else FrameTools.fingerprint(frame, lay.canvas, 40, 40) + FrameTools.fingerprint(frame, lay.hintCenter, 24, 4)
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
        if (paused || p.isDrawingGame == false || p.guesses.isEmpty() || !claim(seq)) return
        if (p.canvasEmpty == true) return
        p.hint?.let { voteHint(seq, it) }
        // Keep last frame's guesses visible (slightly faded in confidence) until the new list catches up.
        val seen = p.guesses.mapTo(HashSet()) { GuessEngine.normalize(it.answer) }
        val carried = prevRaw.filter { GuessEngine.normalize(it.answer) !in seen }
            .map { it.copy(confidence = (it.confidence * 0.85).roundToInt()) }
        val ranked = rank(p.guesses + carried)
        _state.update {
            it.copy(guesses = ranked.guesses, hint = roundHint, hintManual = manualHint != null, hintMismatch = ranked.hintMismatch)
        }
    }

    private fun onFinal(seq: Long, a: FrameAnalysis, images: FrameImages, latency: Long) {
        if (!claim(seq)) return
        backoffMs = 0

        if (!a.isDrawingGame) {
            notGameStreak++
            // Close-ups that show no game mean the layout moved: look at the whole screen again.
            if (images.isCropped && ++cropMisses >= 2) layout = null
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
        if (!images.isCropped) a.canvasBox?.let { layout = Layout.from(it, a.hintBox) }
        if (a.canvasEmpty) endRound()
        else a.hint?.let { voteHint(seq, it) }
        if (settingsRepo.current.saveScreenshots) lastJpeg = images.full ?: images.canvas

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
                hint = roundHint,
                hintManual = manualHint != null,
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

    /**
     * One vote per response. The first reading of a round is taken as is; a different reading
     * must come twice in a row before it replaces the current one (a new word), so a single
     * misread does not wipe the list. A reading with the same totals only adds the word lengths.
     */
    private fun voteHint(seq: Long, h: HintPattern) {
        if (seq <= lastVotedSeq) return
        lastVotedSeq = seq
        val current = aiHint
        when {
            current == null -> acceptHint(h, newWord = false)
            h.wordCount == current.wordCount && h.letterCount == current.letterCount -> {
                pendingHint = null; pendingVotes = 0
                if (h.wordLengths.isNotEmpty() && h != current) aiHint = h
            }
            h == pendingHint -> if (++pendingVotes >= HINT_VOTES) acceptHint(h, newWord = true)
            else -> { pendingHint = h; pendingVotes = 1 }
        }
    }

    private fun acceptHint(h: HintPattern, newWord: Boolean) {
        if (newWord) { resetRound(); manualHint = null }
        aiHint = h
        pendingHint = null
        pendingVotes = 0
        loadKnownAnswers()
    }

    private fun loadKnownAnswers() {
        val h = roundHint
        knownForHint = emptyList()
        scope.launch { knownForHint = history.knownAnswers(h); rerankShown() }
    }

    /** Re-rank what is on screen after the hint or the learned answers changed. */
    private fun rerankShown() {
        val ranked = rank(prevRaw)
        _state.update {
            it.copy(guesses = ranked.guesses, hint = roundHint, hintManual = manualHint != null, hintMismatch = ranked.hintMismatch)
        }
    }

    /** The word was found or the canvas was cleared: the next hint belongs to a new word. */
    private fun endRound() {
        resetRound()
        aiHint = null
        manualHint = null
        pendingHint = null
        pendingVotes = 0
        knownForHint = emptyList()
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

    /** Where the canvas and the hint sit on screen, as [left, top, right, bottom] fractions. */
    private data class Layout(val canvas: List<Float>, val hint: List<Float>) {
        /** Middle of the hint bar: where the blanks are, without the timer and buttons. */
        val hintCenter: List<Float> get() = listOf(0.3f, hint[1], 0.7f, hint[3])

        companion object {
            fun from(canvas: List<Float>, hintBox: List<Float>?): Layout {
                val hint = if (hintBox != null) {
                    listOf(minOf(hintBox[0], 0.15f), (hintBox[1] - 0.012f).coerceAtLeast(0f), maxOf(hintBox[2], 0.85f), (hintBox[3] + 0.012f).coerceAtMost(1f))
                } else {
                    // The hint sits in the bar right above the canvas.
                    listOf(0.15f, (canvas[1] - 0.07f).coerceAtLeast(0f), 0.85f, (canvas[1] + 0.005f).coerceAtMost(1f))
                }
                return Layout(canvas, hint)
            }
        }
    }

    private companion object {
        const val MAX_IN_FLIGHT = 2
        const val MIN_GAP_MS = 150L
        const val PROMPT_CANDIDATES = 40
        const val HINT_VOTES = 2
        /** Re-check the whole screen every so often in case the layout changed. */
        const val FULL_LOOK_EVERY = 25
    }
}

package com.weplay.guesserai.service

import android.graphics.Bitmap
import android.graphics.Rect
import com.weplay.guesserai.data.HistoryRepository
import com.weplay.guesserai.data.WordBankRepository
import com.weplay.guesserai.data.ai.ClaudeVisionClient
import com.weplay.guesserai.data.settings.SettingsRepository
import com.weplay.guesserai.domain.AiModel
import com.weplay.guesserai.domain.AnswerStats
import com.weplay.guesserai.domain.AppSettings
import com.weplay.guesserai.domain.FrameAnalysis
import com.weplay.guesserai.domain.ChangeGate
import com.weplay.guesserai.domain.FrameChangeDetector
import com.weplay.guesserai.domain.FrameImages
import com.weplay.guesserai.domain.GuessEngine
import com.weplay.guesserai.domain.HintPattern
import com.weplay.guesserai.domain.LayoutLearner
import com.weplay.guesserai.domain.OverlaySize
import com.weplay.guesserai.domain.PartialAnalysis
import com.weplay.guesserai.domain.PromptHints
import com.weplay.guesserai.domain.RankedGuess
import com.weplay.guesserai.domain.RoundTracker
import com.weplay.guesserai.domain.ScreenLayout
import com.weplay.guesserai.domain.ScreenState
import com.weplay.guesserai.domain.VisionAnalyzer
import com.weplay.guesserai.domain.VisionException
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineDispatcher
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeoutOrNull
import kotlin.math.abs
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
    /** Why the AI stopped and what to fix (bad key, unknown model); null while it runs or was paused by hand. */
    val problem: String? = null,
) {
    val isPaused: Boolean get() = status == AiStatus.PAUSED
}

/**
 * The capture → analyse → rank loop, tuned for low latency:
 *  - captures run on a fixed beat (the interval counts from the start of each capture),
 *  - up to [MAX_IN_FLIGHT] requests overlap; once a newer frame starts answering, older
 *    requests are cancelled and their results ignored,
 *  - replies stream in, so the first guesses of a word show before the reply is complete,
 *  - only changes on the canvas or in the hint trigger a request; a scrolling or sparkling
 *    hint does not ([ChangeGate]),
 *  - close-ups of the hint and the canvas are sent, from the measured WePlay layout; a
 *    whole-screen look now and then checks the layout and the game state,
 *  - with the accuracy boost, a stronger model also looks at the same close-ups every few
 *    seconds while the drawing grows; its answers count for more on the board,
 *  - every request belongs to one word ([RoundTracker.roundId]): once that word is over the
 *    request is cancelled, and anything it still sends is dropped.
 * Round logic (hints, round ends, revealed answers, guess history) lives in [RoundTracker].
 * All state is touched on the main thread ([scope] is the service's lifecycle scope).
 */
class AssistantSession(
    private val scope: CoroutineScope,
    private val capturer: FrameSource,
    private val analyzer: VisionAnalyzer,
    private val history: HistoryRepository,
    private val settingsRepo: SettingsRepository,
    private val wordBanks: WordBankRepository,
    private val gameMonitor: GameAppMonitor,
    private val isScreenOn: () -> Boolean,
    /** Overlay bounds in real screen pixels, to mask it out of captures. */
    private val overlayRect: () -> Rect?,
    /** Capturing, fingerprinting and encoding run here, off the main thread. */
    private val work: CoroutineDispatcher = Dispatchers.Default,
    private val clock: () -> Long = System::currentTimeMillis,
) {
    private val _state = MutableStateFlow(OverlayUiState())
    val state: StateFlow<OverlayUiState> = _state.asStateFlow()

    private val engine = GuessEngine()
    private val tracker = RoundTracker(engine)
    private val changes = ChangeGate()
    /** Canvas at the last accuracy-boost request: the stronger model only looks again once it changed. */
    private val deepChanges = FrameChangeDetector()
    private val wake = Channel<Unit>(Channel.CONFLATED)

    private var paused = false
    private var forceNext = true
    private var loopJob: Job? = null
    private var settingsJob: Job? = null
    /** Key, endpoint and model when a blocking error paused the AI; changing them tries again. */
    private var problemConnection: String? = null

    // Requests
    private var seqStarted = 0L
    private var seqApplied = 0L
    private val inFlight = LinkedHashMap<Long, Request>()
    private var backoffMs = 0L
    private var notGameStreak = 0

    // Accuracy boost: at most one request to the stronger model, beside the fast ones.
    private var deep: Request? = null
    private var deepNotBefore = 0L
    /** The key cannot use the stronger model: no boost for the rest of this session. */
    private var deepDisabled = false
    /** Round the stronger model last answered for, so the status line can say it has looked. */
    private var deepAnsweredRound = -1
    /** Model behind the last fast answer; differs from the setting once the key fell back to another model. */
    private var fastModelUsed = ""

    // Status line
    /** "Live • Haiku 1.2s", from the last fast answer. */
    private var fastNote: String? = null
    /** Live status last composed, so a newer note can replace it without overwriting anything else. */
    private var lastLive: String? = null

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

    /**
     * One model request. [round] is the word it answers for; once that word is over its results are
     * dropped. [drawing] is the canvas alone, kept for the learning history.
     */
    private class Request(val seq: Long, var round: Int, val drawing: ByteArray? = null) {
        var job: Job? = null
    }

    fun start() {
        if (loopJob != null) return
        refreshStats()
        loopJob = scope.launch { loop() }
        // A fix in Settings (new key, endpoint or model) retries by itself, once typing has stopped.
        settingsJob = scope.launch {
            settingsRepo.settings.map(::connectionOf).distinctUntilChanged().collectLatest { connection ->
                val stuckOn = problemConnection ?: return@collectLatest
                if (connection == stuckOn) return@collectLatest
                delay(SETTINGS_SETTLE_MS)
                if (paused && problemConnection != null) togglePause()
            }
        }
    }

    fun stop() {
        loopJob?.cancel()
        loopJob = null
        settingsJob?.cancel()
        settingsJob = null
        cancelInFlight()
    }

    private fun connectionOf(s: AppSettings) = listOf(s.apiKey.trim(), s.baseUrl.trim(), s.modelId).joinToString("|")

    fun togglePause() {
        paused = !paused
        if (paused) {
            cancelInFlight()
            _state.update { it.copy(status = AiStatus.PAUSED, message = "AI paused") }
        } else {
            forceNext = true
            problemConnection = null
            _state.update { it.copy(status = AiStatus.WATCHING, message = "Resuming…", problem = null) }
            wake.trySend(Unit)
        }
    }

    /** Start this word over with a whole-screen look: re-read the hint, forget guesses and rejections. */
    fun refresh() {
        show(track { tracker.refresh(ctx()) })
        croppedSinceFull = FULL_LOOK_EVERY
        forceNext = true
        _state.update { it.copy(message = "Refreshing…") }
        if (paused) togglePause() else wake.trySend(Unit)
    }

    /** "Next Guess": the top answer was wrong; drop it and promote the next one. Returns the new top answer. */
    fun nextGuess(): String? {
        val r = track { tracker.next(ctx()) } ?: return null
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
        val outcome = track { tracker.markCorrect(guess.answer, ctx()) }
        outcome.learn?.let { learn(it, before.guesses, tracker.hint ?: before.hint, before.category) }
        show(outcome.view)
        _state.update { it.copy(toast = "Saved \"${guess.answer}\" — AI will remember it") }
    }

    /** +/- on the overlay's hint editor. Locks the hint for this round. */
    fun adjustHint(dWords: Int, dLetters: Int) {
        show(track { tracker.adjustHint(dWords, dLetters, ctx()) })
        forceNext = true
        wake.trySend(Unit)
    }

    /** Back to the AI's reading of the hint. */
    fun clearManualHint() {
        show(track { tracker.clearManualHint(ctx()) })
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

    /**
     * The part of the screen the AI reads — from the top of the hint down to the bottom of the
     * canvas — as fractions of the screen height, so the floating window can stay off it: the
     * measured layout, else WePlay's usual one for a screen of [screenAspect] (height / width).
     * Null when unknown (landscape).
     */
    fun readBand(screenAspect: Float): Pair<Float, Float>? {
        // Right after a rotation the measured layout belongs to the old orientation.
        val measured = learner?.layout?.takeIf { abs(aspect - screenAspect) <= SAME_ASPECT }
        val layout = measured ?: ScreenLayout.weplayDefault(screenAspect) ?: return null
        return layout.hint[1] to layout.canvas[3]
    }

    // ---------------------------------------------------------------- loop

    private suspend fun loop() {
        _state.update { it.copy(status = AiStatus.WATCHING, message = "Waiting for the game…") }
        withTimeoutOrNull(300) { wake.receive() } // first frame from the projection
        while (scope.isActive) {
            val tickStart = clock()
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

            // The frame lives in the capturer's reused buffer: it is fully processed before the next capture.
            val frame = withContext(work) { capturer.capture() }
            if (frame != null) {
                try {
                    tick(frame, settings)
                } catch (e: CancellationException) {
                    throw e
                } catch (e: Throwable) {
                    handleError(e, isNewest = true)
                }
            }

            val elapsed = clock() - tickStart
            waitFor(max(MIN_GAP_MS, interval + backoffMs - elapsed))
        }
    }

    private suspend fun tick(frame: Frame, settings: AppSettings) {
        val frameAspect = frame.height.toFloat() / frame.width
        if (learner == null || abs(frameAspect - aspect) > 0.01f) {
            aspect = frameAspect
            learner = LayoutLearner(frameAspect)
        }
        val lay = learner?.layout
        val sendFull = lay == null || croppedSinceFull >= FULL_LOOK_EVERY
        // Read the window's bounds here, on the main thread that moves it.
        val mask = overlayRect()?.let { r ->
            val s = capturer.scale
            Rect((r.left * s).toInt(), (r.top * s).toInt(), (r.right * s).toInt(), (r.bottom * s).toInt())
        }
        val (canvasFp, hintFp) = withContext(work) {
            FrameTools.maskRect(frame, mask, lay?.canvas)
            // Watch only the canvas and the hint text — not the chat, the timer or the players.
            if (lay == null) FrameTools.fingerprint(frame) to IntArray(0)
            else FrameTools.fingerprint(frame, lay.canvas, 40, 40) to FrameTools.fingerprint(frame, lay.hintCenter, 24, 4)
        }
        if (paused) return
        if (!changes.observe(canvasFp, hintFp) && !forceNext) {
            if (inFlight.isEmpty()) _state.update { idle(it) }
            return
        }
        // Too many requests already running: leave the frame "changed" so the next beat sends it.
        if (inFlight.size >= MAX_IN_FLIGHT) return

        changes.accept(canvasFp, hintFp)
        forceNext = false
        val (images, thumb, drawing) = withContext(work) {
            val imgs = if (sendFull) {
                FrameImages(full = FrameTools.toJpeg(frame, maxSide = 896, quality = 75))
            } else {
                FrameImages(
                    hintBar = FrameTools.toJpeg(frame, lay.hint, maxSide = 900, quality = 85),
                    canvas = FrameTools.toJpeg(frame, lay.canvas, pad = 0.01f, maxSide = 768, quality = 75),
                )
            }
            // The history keeps the drawing only: a whole-screen look also shows the chat and other players.
            val drawing = when {
                !settings.saveScreenshots || lay == null -> null
                imgs.canvas != null -> imgs.canvas
                else -> FrameTools.toJpeg(frame, lay.canvas, pad = 0.01f, maxSide = 768, quality = 75)
            }
            // Only the large panel shows the drawing preview.
            Triple(imgs, if (settings.overlaySize == OverlaySize.LARGE) FrameTools.thumbnail(frame, lay?.canvas) else null, drawing)
        }
        if (paused) return // resuming sends a fresh frame
        if (thumb != null) _state.update { it.copy(thumbnail = thumb) }
        if (images.isCropped) croppedSinceFull++ else croppedSinceFull = 0
        // A blank canvas is left to the fast lane; the stronger model waits for the first strokes.
        val blankCanvas = lay != null && FrameTools.looksBlank(canvasFp)
        launchRequest(images, settings, canvasFp.takeUnless { blankCanvas }, drawing)
    }

    /** Status on an unchanged frame: the waveform stops; the text only changes when it had nothing to say. */
    private fun idle(st: OverlayUiState): OverlayUiState = when {
        st.status == AiStatus.ERROR -> st
        st.status == AiStatus.GAME_AWAY -> st.copy(status = AiStatus.WATCHING, message = restingMessage(st))
        nothingShown(st) -> st.copy(status = AiStatus.WATCHING, message = WATCHING_MSG)
        else -> st.copy(status = AiStatus.WATCHING)
    }

    /**
     * Sends [images] to the fast model, and to the stronger one too when the accuracy boost is
     * due. [canvas] is the canvas fingerprint, null when only the fast model should look.
     */
    private fun launchRequest(images: FrameImages, settings: AppSettings, canvas: IntArray?, drawing: ByteArray?) {
        val seq = ++seqStarted
        val hint = tracker.hint
        val hints = PromptHints(
            lastHint = hint,
            knownAnswers = knownForHint,
            wordListCandidates = engine.promptCandidates(hint, wordBanks.get(settings.customWords)),
            rejected = tracker.rejectedAnswers,
        )
        // Once guesses are up only the waveform shows the new request; the text stays put.
        _state.update {
            when {
                it.status == AiStatus.PAUSED -> it
                nothingShown(it) || it.status == AiStatus.GAME_AWAY -> it.copy(status = AiStatus.ANALYZING, message = ANALYZING_MSG)
                else -> it.copy(status = AiStatus.ANALYZING)
            }
        }
        val req = Request(seq, tracker.roundId, drawing)
        inFlight[seq] = req
        val started = clock()
        req.job = scope.launch {
            try {
                val analysis = analyzer.analyze(images, hints, settings) { partial ->
                    // Called on the network thread; hop to main so state changes stay ordered.
                    scope.launch { onPartial(req, partial) }
                }
                onFinal(req, analysis, images, clock() - started)
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
        if (canvas != null) launchDeepIfDue(seq, images, hints, settings, canvas)
    }

    /**
     * Accuracy boost: the stronger model looks at the same frame, one request at a time, at most
     * every [DEEP_MIN_INTERVAL_MS] and only once the canvas changed since its last look. It never
     * cancels the fast requests and they never cancel it; only the end of its word does.
     */
    private fun launchDeepIfDue(seq: Long, images: FrameImages, hints: PromptHints, settings: AppSettings, canvas: IntArray) {
        val now = clock()
        if (!boostOn(settings) || deep != null || tracker.solved || now < deepNotBefore) return
        if (!deepChanges.hasChanged(canvas)) return
        deepChanges.accept(canvas)
        deepNotBefore = now + DEEP_MIN_INTERVAL_MS
        val req = Request(seq, tracker.roundId)
        deep = req
        val deepSettings = settings.copy(model = AiModel.SONNET, fastMode = false)
        req.job = scope.launch {
            try {
                // No partials: its answer only counts once complete.
                onDeepFinal(req, analyzer.analyze(images, hints, deepSettings))
            } catch (e: CancellationException) {
                throw e
            } catch (e: Throwable) {
                // Never shown: the fast lane carries on without it.
                if (e is VisionException.InvalidKey || e is VisionException.ModelNotFound) {
                    deepDisabled = true
                } else {
                    deepNotBefore = max(deepNotBefore, clock() + DEEP_RETRY_MS)
                    deepChanges.reset() // it never saw this canvas
                }
            } finally {
                if (deep === req) deep = null
                refreshLiveMessage()
            }
        }
        refreshLiveMessage()
    }

    /** Beside the fast default model on the official API — not once the key fell back to a model that is stronger already. */
    private fun boostOn(s: AppSettings): Boolean =
        s.accuracyBoost && s.model == AiModel.HAIKU && ClaudeVisionClient.isOfficial(s) &&
            !deepDisabled && fastModelUsed != AiModel.OPUS.id

    /** Results from frame [seq] may be shown; anything older still running is now stale. */
    private fun claim(seq: Long): Boolean {
        if (seq < seqApplied) return false
        if (seq > seqApplied) {
            seqApplied = seq
            inFlight.values.filter { it.seq < seq }.forEach { it.job?.cancel() }
        }
        return true
    }

    /** Answers from [req] may still change the overlay: same word, not cancelled, not paused. */
    private fun isCurrent(req: Request): Boolean =
        loopJob != null && !paused && req.round == tracker.roundId && req.job?.isCancelled != true

    private fun onPartial(req: Request, p: PartialAnalysis) {
        if (!isCurrent(req) || req.seq < seqApplied) return
        val view = track(req) { tracker.partial(req.seq, p, ctx()) } ?: return
        claim(req.seq)
        show(view)
    }

    private fun onFinal(req: Request, a: FrameAnalysis, images: FrameImages, latency: Long) {
        if (!isCurrent(req) || !claim(req.seq)) return
        backoffMs = 0
        fastModelUsed = a.modelUsed
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
        if (a.screenState == ScreenState.GUESSING) lastCanvasJpeg = req.drawing

        val hintBefore = tracker.hint ?: before.hint
        val outcome = track(req) { tracker.final(req.seq, a, ctx()) }
        // Save with what was on screen for this word, not the reset list of the next one.
        outcome.learn?.let { learn(it, before.guesses, hintBefore, before.category) }
        show(outcome.view)

        fastNote = fastNoteFor(a.modelUsed, latency)
        val message = when {
            outcome.view.answer != null && (outcome.roundOver || tracker.solved) -> answerMessage(outcome.view.answer)
            a.canvasEmpty -> "Canvas is empty — waiting"
            else -> liveMessage().also { lastLive = it }
        }
        _state.update {
            it.copy(
                status = when {
                    paused -> AiStatus.PAUSED
                    inFlight.keys.any { k -> k > req.seq } -> AiStatus.ANALYZING
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

    private fun onDeepFinal(req: Request, a: FrameAnalysis) {
        // Its frame is older than the fast lane's by now: an empty canvas or "no game" there must not wipe the board.
        if (!isCurrent(req) || a.canvasEmpty || a.screenState == ScreenState.NOT_GAME) return
        val before = _state.value
        val hintBefore = tracker.hint ?: before.hint
        val outcome = track(req) { tracker.final(req.seq, a, ctx(), deep = true) }
        outcome.learn?.let { learn(it, before.guesses, hintBefore, before.category) }
        show(outcome.view)
        if (!outcome.roundOver) deepAnsweredRound = tracker.roundId
        val answer = outcome.view.answer
        if (answer != null && (outcome.roundOver || tracker.solved)) {
            _state.update { it.copy(message = answerMessage(answer)) }
        } else {
            refreshLiveMessage()
        }
    }

    /**
     * Runs a tracker call. When it started or ended a word, requests made for the old word are
     * cancelled; [req], the request whose answer this is, moves on to the new word. Once the word
     * is solved the stronger model has nothing left to add.
     */
    private inline fun <T> track(req: Request? = null, call: () -> T): T {
        val round = tracker.roundId
        val result = call()
        req?.round = tracker.roundId
        if (tracker.roundId != round) {
            deepChanges.reset()
            dropStaleRequests()
            // A ✓ from the last word must not mark the same answer as already typed in the next one.
            _state.update { it.copy(copied = null) }
        }
        if (tracker.solved && deep != null && deep !== req) cancelDeep()
        return result
    }

    /** Cancels requests made for an earlier word; the current frame is sent again for the new one. */
    private fun dropStaleRequests() {
        val round = tracker.roundId
        val stale = inFlight.values.filter { it.round != round }
        stale.forEach { it.job?.cancel(); inFlight.remove(it.seq) }
        if (stale.isNotEmpty()) forceNext = true
        if (deep?.round?.let { it != round } == true) cancelDeep()
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

    private fun ctx() = RoundTracker.Context(stats = stats)

    /** Save an answer the game showed (or the user confirmed) with the last drawing. */
    private fun learn(answer: String, guesses: List<RankedGuess>, hint: HintPattern?, category: String) {
        val jpeg = if (settingsRepo.current.saveScreenshots) lastCanvasJpeg else null // the canvas only
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
            // Only sent to the model with the next frame; never shown as guesses by themselves.
            val known = history.knownAnswers(hint)
            if (knownLoadedFor == hint) knownForHint = known
        }
    }

    // ---------------------------------------------------------------- status line

    /** Nothing to keep on screen yet: no guesses, no answer, and the game was not reported missing. */
    private fun nothingShown(st: OverlayUiState) = st.guesses.isEmpty() && st.answer == null && notGameStreak == 0

    /** What the status line says when the game comes back into view with something already shown. */
    private fun restingMessage(st: OverlayUiState): String = when {
        st.answer != null -> answerMessage(st.answer)
        st.guesses.isNotEmpty() -> lastLive ?: WATCHING_MSG
        else -> WATCHING_MSG
    }

    private fun answerMessage(answer: String) = "✓ Answer: $answer"

    /** "Live • Haiku 1.2s • Sonnet ✓": the fast lane's model and speed, then the accuracy boost's state. */
    private fun liveMessage(): String = (fastNote ?: "Live") + deepNote()

    private fun fastNoteFor(modelUsed: String, latency: Long): String {
        val note = if (settingsRepo.current.model == AiModel.HAIKU && modelUsed == AiModel.OPUS.id) " (Haiku n/a)" else ""
        return "Live • ${shortName(modelUsed)}$note ${latency / 100 / 10.0}s"
    }

    /** " • Sonnet ✓" once the stronger model answered for this word, " • Sonnet…" while it is looking. */
    private fun deepNote(): String {
        val name = shortName(AiModel.SONNET.id)
        return when {
            deepAnsweredRound == tracker.roundId -> " • $name ✓"
            deep != null -> " • $name…"
            else -> ""
        }
    }

    private fun shortName(modelId: String): String =
        AiModel.entries.firstOrNull { modelId.isNotBlank() && it.id == modelId }?.label?.removePrefix("Claude ")?.substringBefore(' ')
            ?: modelId.ifBlank { "AI" }

    /** The accuracy boost's note changed: update the live status, if that is what the overlay shows. */
    private fun refreshLiveMessage() {
        val shown = lastLive ?: return
        val live = liveMessage()
        if (live == shown) return
        lastLive = live
        _state.update { if (it.message == shown) it.copy(message = live) else it }
    }

    private fun refreshStats() {
        scope.launch { stats = history.stats() }
    }

    /** Stops the stronger model's look; it may look at the same canvas again later. */
    private fun cancelDeep() {
        val d = deep ?: return
        d.job?.cancel()
        deep = null
        deepChanges.reset()
    }

    private fun cancelInFlight() {
        inFlight.values.forEach { it.job?.cancel() }
        inFlight.clear()
        cancelDeep()
    }

    private fun handleError(e: Throwable, isNewest: Boolean) {
        if (!isNewest) return // a newer request is already on its way
        val (msg, pause) = when (e) {
            is VisionException.InvalidKey -> "Invalid API key — check Settings" to true
            is VisionException.ModelNotFound -> "Model not found — check Settings" to true
            is VisionException.BadConfig -> e.message!! to true
            is VisionException.RateLimited -> { backoffMs = (backoffMs * 2).coerceIn(4_000, 60_000); e.message!! to false }
            is VisionException -> { backoffMs = (backoffMs + 1_000).coerceAtMost(10_000); (e.message ?: "AI error") to false }
            else -> { backoffMs = (backoffMs + 1_000).coerceAtMost(10_000); "Error: ${e.message ?: e.javaClass.simpleName}" to false }
        }
        forceNext = true
        if (pause) { paused = true; cancelInFlight(); problemConnection = connectionOf(settingsRepo.current) }
        _state.update { it.copy(status = if (pause) AiStatus.PAUSED else AiStatus.ERROR, message = msg, problem = if (pause) msg else it.problem) }
    }

    /** Sleeps up to [ms], waking early on refresh / resume. */
    private suspend fun waitFor(ms: Long) {
        withTimeoutOrNull(ms) { wake.receive() }
    }

    private companion object {
        const val MAX_IN_FLIGHT = 2
        const val MIN_GAP_MS = 150L
        /** Whole-screen look every so often: checks the layout and spots popups the close-ups miss. */
        const val FULL_LOOK_EVERY = 12
        const val SOLVED_INTERVAL_MS = 2_500L
        /** A changed key or model is tried this long after the last keystroke, not with every letter. */
        const val SETTINGS_SETTLE_MS = 1_500L
        /** Accuracy boost: shortest gap between two looks by the stronger model. */
        const val DEEP_MIN_INTERVAL_MS = 5_000L
        /** Accuracy boost: pause after a failed look (rate limit, network) before trying again. */
        const val DEEP_RETRY_MS = 15_000L
        /** Height / width ratios this close belong to the same screen orientation. */
        const val SAME_ASPECT = 0.02f
        const val ANALYZING_MSG = "Analyzing drawing…"
        const val WATCHING_MSG = "Watching for new strokes…"
    }
}

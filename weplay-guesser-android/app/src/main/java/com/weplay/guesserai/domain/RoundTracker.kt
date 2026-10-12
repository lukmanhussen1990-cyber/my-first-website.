package com.weplay.guesserai.domain

/**
 * Everything the overlay knows about the current round (one word being drawn), driven by the
 * model's answers and the user's taps. Plain Kotlin, so every rule here is unit-tested.
 *
 * Rounds end when the game shows the answer (round-over popup, or the word appearing in the top
 * bar once we guessed it), when the user confirms an answer, or when the hint changes. Nothing
 * from one round leaks into the next. The answer the game shows is reported once per round so
 * the learning database can save it.
 */
class RoundTracker(private val engine: GuessEngine = GuessEngine()) {

    /** Inputs owned by the session: what the learning database knows (marks answers confirmed before with ★). */
    data class Context(
        val stats: Map<String, AnswerStats> = emptyMap(),
    )

    /** What the overlay should show. */
    data class View(
        val guesses: List<RankedGuess>,
        val hint: HintPattern?,
        val hintManual: Boolean,
        val hintMismatch: Boolean,
        /** The answer the game showed for the current or just-finished word. */
        val answer: String?,
    )

    data class Outcome(
        val view: View,
        /** Save this answer to the learning database (reported once per round). */
        val learn: String? = null,
        /** The round ended (popup or confirmed answer); the next hint starts a new word. */
        val roundOver: Boolean = false,
    )

    data class NextResult(val rejected: String, val view: View)

    private val board = RoundBoard()
    private val rejected = mutableSetOf<String>()
    private val rejectedNames = mutableListOf<String>()
    private var aiHint: HintPattern? = null
    private var manualHint: HintPattern? = null
    private var pendingHint: HintPattern? = null
    private var pendingVotes = 0
    private var lastVotedSeq = 0L
    private var answer: String? = null
    private var learnedKey: String? = null

    /** The game has shown this round's answer; analysing can slow down until the next word. */
    var solved: Boolean = false
        private set

    /** Hint in use: the user's, else the model's reading. */
    val hint: HintPattern? get() = manualHint ?: aiHint

    /**
     * Changes whenever a word ends or starts. A request launched under an older id belongs to a
     * previous word and its result must be thrown away.
     */
    var roundId: Int = 0
        private set

    /** Answers the user already tried this word, as shown (sent to the model as known-wrong). */
    val rejectedAnswers: List<String> get() = rejectedNames.toList()

    /** Order last shown, so near-equal guesses do not swap places every second. */
    private var lastOrder: List<String> = emptyList()

    /**
     * A streamed, unfinished answer. Only used to fill an empty board quickly (first guesses of a
     * word); once guesses are on screen the list changes once per complete answer, not mid-stream.
     * Returns null when it should not change the overlay.
     */
    fun partial(seq: Long, p: PartialAnalysis, ctx: Context): View? {
        if (p.screenState != null && p.screenState != ScreenState.GUESSING) return null
        if (p.isDrawingGame == false || p.canvasEmpty == true || p.guesses.isEmpty()) return null
        if (!board.isEmpty && p.hint.let { it == null || hint == null || it.sameShape(hint!!) }) return null
        p.hint?.let { considerHint(seq, it) }
        return view(ctx, board.preview(p.guesses))
    }

    /**
     * A complete answer for frame [seq] (frames are applied in order by the caller). [deep] marks
     * the slower, stronger model's answer, which counts for more on the board.
     */
    fun final(seq: Long, a: FrameAnalysis, ctx: Context, deep: Boolean = false): Outcome {
        when (a.screenState) {
            ScreenState.NOT_GAME -> return Outcome(view(ctx))
            ScreenState.ROUND_OVER -> {
                // Only the popup's own answer ends a round; a vague "round over" could be a misread.
                val revealed = cleanReveal(a.revealedAnswer) ?: return Outcome(view(ctx))
                val learn = remember(revealed)
                endRound()
                answer = revealed
                return Outcome(view(ctx), learn = learn, roundOver = true)
            }
            ScreenState.WORD_REVEALED -> {
                // The top bar shows the word only after we guessed it, so it must fit the hint.
                val revealed = cleanReveal(a.revealedAnswer)?.takeIf { r -> hint.let { h -> h == null || GuessEngine.matches(r, h) } }
                if (revealed != null) {
                    val learn = remember(revealed)
                    answer = revealed
                    solved = true
                    return Outcome(view(ctx), learn = learn)
                }
                // Not a believable reveal: use the frame as a normal one.
            }
            ScreenState.GUESSING -> Unit
        }
        a.hint?.let { considerHint(seq, it) }
        if (a.canvasEmpty) board.clear() else board.commit(a.guesses, deep)
        return Outcome(view(ctx))
    }

    /** "Next Guess": the top answer was wrong. */
    fun next(ctx: Context): NextResult? {
        val top = view(ctx).guesses.firstOrNull() ?: return null
        rejected += GuessEngine.normalize(top.answer)
        rejectedNames += top.answer
        return NextResult(top.answer, view(ctx))
    }

    /**
     * The user confirmed [correct] (long-press). The word is solved for us, but the round goes on
     * for the others until the popup or the next hint, so nothing is reset yet.
     */
    fun markCorrect(correct: String, ctx: Context): Outcome {
        val learn = remember(correct)
        answer = GuessEngine.cleanAnswer(correct)
        solved = true
        return Outcome(view(ctx), learn = learn)
    }

    /** +/- in the overlay's hint editor; locks the hint until the next word. */
    fun adjustHint(dWords: Int, dLetters: Int, ctx: Context): View {
        val base = hint ?: HintPattern(1, 4)
        val words = (base.wordCount + dWords).coerceIn(1, 6)
        val letters = (base.letterCount + dLetters).coerceIn(words, 40)
        manualHint = HintPattern(words, letters, clue = base.clue)
        return view(ctx)
    }

    fun clearManualHint(ctx: Context): View {
        manualHint = null
        return view(ctx)
    }

    /** Start this word over: forget guesses, rejections and the hint reading (a hand-set hint stays). */
    fun refresh(ctx: Context): View {
        roundId++
        resetGuesses()
        aiHint = null
        clearPending()
        answer = null
        solved = false
        learnedKey = null
        return view(ctx)
    }

    fun view(ctx: Context): View = view(ctx, board.current())

    private fun view(ctx: Context, raw: List<Guess>): View {
        val ranked = engine.rank(raw, hint, rejected, ctx.stats)
        val ordered = stableOrder(ranked.guesses, lastOrder)
        lastOrder = ordered.map { GuessEngine.normalize(it.answer) }
        return View(ordered, hint, manualHint != null, ranked.hintMismatch, answer)
    }

    /**
     * One vote per response. The first reading of a word is taken as is. A different reading must
     * be seen twice in a row before it counts as a new word, so one misread cannot wipe the list.
     * Once solved, the top bar shows the word itself; only a different hint with a clue
     * ("5 letters|A food") means the next word has started (the round-over popup also ends it).
     * A long hint scrolls, and a reading with its start cut off is the same word, not a new one.
     */
    private fun considerHint(seq: Long, h: HintPattern) {
        if (seq <= lastVotedSeq) return
        lastVotedSeq = seq
        val current = aiHint
        when {
            solved -> {
                val sameWord = current != null &&
                    (h.sameShape(current) && !h.clueConflicts(current) || h.cutOffReadingOf(current))
                if (h.clue.isNotBlank() && !sameWord) startNewRound(h)
            }
            current == null -> startNewRound(h)
            h.sameShape(current) && !h.clueConflicts(current) -> {
                clearPending()
                aiHint = current.copy(
                    wordLengths = h.wordLengths.ifEmpty { current.wordLengths },
                    clue = h.clue.ifBlank { current.clue },
                )
            }
            // A cut-off reading only ever loses words, so the higher word count is the real one.
            h.cutOffReadingOf(current) -> {
                clearPending()
                if (h.wordCount > current.wordCount) aiHint = h
            }
            else -> vote(h)
        }
    }

    private fun vote(h: HintPattern) {
        val p = pendingHint
        if (p != null && p.sameShape(h) && !p.clueConflicts(h)) {
            if (++pendingVotes >= HINT_VOTES) startNewRound(h)
        } else {
            pendingHint = h
            pendingVotes = 1
        }
    }

    private fun startNewRound(h: HintPattern) {
        roundId++
        resetGuesses()
        aiHint = h
        manualHint = null
        clearPending()
        answer = null
        solved = false
        learnedKey = null
    }

    /** The word is over; keep [learnedKey] so popup frames that follow are not saved twice. */
    private fun endRound() {
        roundId++
        resetGuesses()
        aiHint = null
        manualHint = null
        clearPending()
        solved = false
    }

    private fun resetGuesses() {
        board.clear()
        rejected.clear()
        rejectedNames.clear()
        lastOrder = emptyList()
    }

    private fun clearPending() {
        pendingHint = null
        pendingVotes = 0
    }

    /** Returns [answer] the first time it is seen this round, null afterwards. */
    private fun remember(answer: String): String? {
        val key = GuessEngine.normalize(answer)
        if (key.isEmpty() || key == learnedKey) return null
        learnedKey = key
        return answer
    }

    /** The answer text the game showed, or null if it is not a plausible answer. */
    private fun cleanReveal(raw: String): String? {
        val r = GuessEngine.cleanAnswer(raw)
        if (r.isEmpty() || r.length > 40) return null
        if (r.contains("letter", ignoreCase = true) || r.contains('|') || r.contains('_')) return null
        return r
    }

    companion object {
        private const val HINT_VOTES = 2
        /** Extra sort weight for the guesses that were 1st, 2nd, 3rd last time (display order only). */
        private val STICKY = intArrayOf(8, 3, 1)

        /**
         * Sort by confidence, but a guess already near the top keeps its place unless another one is
         * clearly ahead — the list stops shuffling when two scores are within a few points.
         */
        fun stableOrder(guesses: List<RankedGuess>, previous: List<String>): List<RankedGuess> {
            if (previous.isEmpty()) return guesses
            fun weight(g: RankedGuess): Int {
                val i = previous.indexOf(GuessEngine.normalize(g.answer))
                return g.confidence + if (i in STICKY.indices) STICKY[i] else 0
            }
            // Answers that fit the hint always stay above the ones that do not.
            return guesses.sortedWith(
                compareByDescending<RankedGuess> { it.matchesHint }.thenByDescending { weight(it) }.thenByDescending { it.confidence }
            )
        }
    }
}

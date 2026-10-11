package com.weplay.guesserai.domain

/** One candidate answer as returned by the vision model. */
data class Guess(
    val answer: String,
    /** 0..100 */
    val confidence: Int,
    val reason: String = "",
)

/**
 * The game's word hint, e.g. "_ _ _ _   _ _ _ _ _" = 2 words, 9 letters, lengths [4, 5].
 * [wordLengths] is empty when only the totals are known.
 */
data class HintPattern(
    val wordCount: Int,
    val letterCount: Int,
    val wordLengths: List<Int> = emptyList(),
    /** Category clue the game shows next to the count: "A state" in "4 letters|A state". */
    val clue: String = "",
) {
    val isKnown: Boolean get() = wordCount > 0 && letterCount > 0

    fun sameShape(other: HintPattern): Boolean = wordCount == other.wordCount && letterCount == other.letterCount

    /** Clues differ only when both are known and say different things. */
    fun clueConflicts(other: HintPattern): Boolean =
        clue.isNotBlank() && other.clue.isNotBlank() && normClue(clue) != normClue(other.clue)

    fun label(): String {
        val w = if (wordCount == 1) "1 word" else "$wordCount words"
        return "$w • $letterCount letters"
    }

    private fun normClue(c: String) = c.lowercase().filter { it.isLetterOrDigit() }

    /** "_ _ _ _   _ _ _ _ _" style blanks for the overlay, when per-word lengths are known. */
    fun blanks(): String? =
        if (wordLengths.isEmpty()) null
        else wordLengths.joinToString("   ") { n -> List(n) { "_" }.joinToString(" ") }
}

/** What the game screen is showing. */
enum class ScreenState {
    /** A word is being drawn and guessed; the top bar shows the hint. */
    GUESSING,
    /** We already guessed it: the top bar shows the word itself instead of the hint. */
    WORD_REVEALED,
    /** The round-over popup ("Word: fear") or a "Round over! Answer: …" message. */
    ROUND_OVER,
    /** Not the drawing game (lobby, another app, a menu). */
    NOT_GAME,
}

/** Everything one vision call tells us about the current frame. */
data class FrameAnalysis(
    val isDrawingGame: Boolean,
    val canvasEmpty: Boolean,
    val detectedObject: String,
    val category: String,
    val emoji: String,
    val hint: HintPattern?,
    /** Normalised canvas rectangle [left, top, right, bottom] in 0..1, if the model found it. */
    val canvasBox: List<Float>?,
    /** Normalised rectangle of the word hint in the top bar, if the model found it. */
    val hintBox: List<Float>? = null,
    val guesses: List<Guess>,
    /** Model that actually answered (differs from the setting after a Haiku → Opus fallback). */
    val modelUsed: String = "",
    val screenState: ScreenState = if (isDrawingGame) ScreenState.GUESSING else ScreenState.NOT_GAME,
    /** The answer the game itself shows (revealed word or round-over popup), "" when none. */
    val revealedAnswer: String = "",
)

/**
 * What is sent for one frame: the whole screen while the layout is unknown, afterwards two
 * close-ups — the hint in the top bar and the canvas — which read better and upload faster.
 */
class FrameImages(
    val full: ByteArray? = null,
    val hintBar: ByteArray? = null,
    val canvas: ByteArray? = null,
) {
    val isCropped: Boolean get() = full == null
}

/** What the model has streamed so far for one frame. */
data class PartialAnalysis(
    val hint: HintPattern?,
    val guesses: List<Guess>,
    val isDrawingGame: Boolean?,
    val canvasEmpty: Boolean?,
    val screenState: ScreenState? = null,
)

/** Extra context sent with a frame so the model picks from likely answers. */
data class PromptHints(
    /** Hint seen on the previous frame of this round (the model re-reads it from the image). */
    val lastHint: HintPattern? = null,
    /** Answers confirmed in earlier rounds that fit [lastHint]. */
    val knownAnswers: List<String> = emptyList(),
    /** Word-list answers that fit [lastHint]. */
    val wordListCandidates: List<String> = emptyList(),
)

/** Where a guess shown in the overlay came from. */
enum class GuessSource { AI, WORD_LIST, LEARNED }

/** A guess after filtering and ranking by [GuessEngine]. */
data class RankedGuess(
    val answer: String,
    val confidence: Int,
    val reason: String,
    val matchesHint: Boolean,
    val learned: Boolean,
    val source: GuessSource = GuessSource.AI,
)

enum class CaptureSpeed(val seconds: Int, val label: String) {
    FAST(1, "1 second"),
    NORMAL(2, "2 seconds"),
    SLOW(5, "5 seconds"),
}

enum class AiModel(val id: String, val label: String, val note: String) {
    HAIKU("claude-haiku-5-5", "Claude Haiku 5.5", "Fastest, cheapest (default)"),
    SONNET("claude-sonnet-5-5", "Claude Sonnet 5.5", "Balanced"),
    OPUS("claude-opus-5-5", "Claude Opus 5.5", "Most accurate, slowest"),
    CUSTOM("", "Custom model ID", "For Anthropic-compatible endpoints"),
}

data class AppSettings(
    val apiKey: String = "",
    val baseUrl: String = DEFAULT_BASE_URL,
    val model: AiModel = AiModel.HAIKU,
    val customModelId: String = "",
    val captureSpeed: CaptureSpeed = CaptureSpeed.FAST,
    /** Answer without extended thinking (Haiku / Sonnet only): much lower latency. */
    val fastMode: Boolean = true,
    /** User's own words, one per line, added to the built-in word list. */
    val customWords: String = "",
    /** Small overlay (no preview image, one button row) so it covers less of the game. */
    val compactOverlay: Boolean = true,
    val gamePackage: String = "",
    val autoPauseWhenGameClosed: Boolean = true,
    val saveScreenshots: Boolean = true,
) {
    val modelId: String get() = if (model == AiModel.CUSTOM) customModelId.trim() else model.id
    val hasApiKey: Boolean get() = apiKey.isNotBlank()

    companion object {
        const val DEFAULT_BASE_URL = "https://api.anthropic.com"
    }
}

/** Per-answer history the learning system has collected. */
data class AnswerStats(val correct: Int, val rejected: Int)

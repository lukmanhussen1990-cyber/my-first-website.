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
) {
    val isKnown: Boolean get() = wordCount > 0 && letterCount > 0

    fun label(): String {
        val w = if (wordCount == 1) "1 word" else "$wordCount words"
        return "$w • $letterCount letters"
    }

    /** "_ _ _ _   _ _ _ _ _" style blanks for the overlay, when per-word lengths are known. */
    fun blanks(): String? =
        if (wordLengths.isEmpty()) null
        else wordLengths.joinToString("   ") { n -> List(n) { "_" }.joinToString(" ") }
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
    val guesses: List<Guess>,
)

/** A guess after filtering and ranking by [GuessEngine]. */
data class RankedGuess(
    val answer: String,
    val confidence: Int,
    val reason: String,
    val matchesHint: Boolean,
    val learned: Boolean,
)

enum class CaptureSpeed(val seconds: Int, val label: String) {
    FAST(1, "1 second"),
    NORMAL(2, "2 seconds"),
    SLOW(5, "5 seconds"),
}

enum class AiModel(val id: String, val label: String, val note: String) {
    OPUS("claude-opus-5-5", "Claude Opus 5.5", "Most accurate (default)"),
    SONNET("claude-sonnet-5-5", "Claude Sonnet 5.5", "Faster, lower cost"),
    HAIKU("claude-haiku-5-5", "Claude Haiku 5.5", "Fastest, cheapest"),
    CUSTOM("", "Custom model ID", "For Anthropic-compatible endpoints"),
}

data class AppSettings(
    val apiKey: String = "",
    val baseUrl: String = DEFAULT_BASE_URL,
    val model: AiModel = AiModel.OPUS,
    val customModelId: String = "",
    val captureSpeed: CaptureSpeed = CaptureSpeed.NORMAL,
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

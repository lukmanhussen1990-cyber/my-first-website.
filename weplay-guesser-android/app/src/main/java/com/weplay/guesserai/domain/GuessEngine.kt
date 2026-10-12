package com.weplay.guesserai.domain


/**
 * Orders the model's guesses for the overlay. It never invents, completes or reshapes an answer:
 * everything shown is exactly what the AI returned (through the user's API key), with the AI's own
 * confidence. It only
 *  1. tidies the text and merges duplicates,
 *  2. drops answers the user already rejected this round ("Next Guess"),
 *  3. puts answers that fit the game's word/letter hint first; answers that do not fit are still
 *     shown after them, flagged, so nothing the AI said is hidden.
 */
class GuessEngine {

    fun rank(
        guesses: List<Guess>,
        hint: HintPattern?,
        rejected: Set<String>,
        history: Map<String, AnswerStats> = emptyMap(),
        maxResults: Int = 10,
    ): RankResult {
        val hintKnown = hint != null && hint.isKnown
        val merged = LinkedHashMap<String, Guess>()
        for (g in guesses) {
            val clean = cleanAnswer(g.answer)
            val key = normalize(clean)
            if (key.isEmpty() || key in rejected) continue
            val existing = merged[key]
            if (existing == null || g.confidence > existing.confidence) {
                merged[key] = g.copy(answer = clean, confidence = g.confidence.coerceIn(0, 100))
            }
        }
        val all = merged.map { (key, g) ->
            RankedGuess(
                answer = g.answer,
                confidence = g.confidence,
                reason = g.reason,
                matchesHint = !hintKnown || matches(g.answer, hint!!),
                learned = (history[key]?.correct ?: 0) > 0,
            )
        }
        val sorted = all.sortedWith(
            compareByDescending<RankedGuess> { it.matchesHint }.thenByDescending { it.confidence }.thenByDescending { it.learned }
        )
        return RankResult(sorted.take(maxResults), hintMismatch = hintKnown && all.isNotEmpty() && all.none { it.matchesHint })
    }

    /**
     * Word-list answers worth mentioning to the model for this hint: all of them when the shape has
     * few answers; the most likely ones for distinctive shapes (several words, or 3 letters or fewer —
     * "A Bike", "Free Fire", TV/GO/AC); none for a common single word like "4 letters". The model
     * decides whether any of them fits the drawing; they are never shown as guesses by themselves.
     */
    fun promptCandidates(hint: HintPattern?, wordBank: WordBank): List<String> {
        if (hint == null || !hint.isKnown) return emptyList()
        val candidates = wordBank.candidates(hint)
        return when {
            candidates.size <= MAX_PROMPT_CANDIDATES -> candidates
            hint.wordCount > 1 || hint.letterCount <= 3 -> candidates.take(MAX_PROMPT_CANDIDATES)
            else -> emptyList()
        }.map { it.answer }
    }

    data class RankResult(val guesses: List<RankedGuess>, val hintMismatch: Boolean)

    companion object {
        private const val MAX_PROMPT_CANDIDATES = 15

        /** Lower-case, letters/digits/spaces only, single spaces. Used as the identity of an answer. */
        fun normalize(answer: String): String =
            answer.lowercase()
                .map { if (it.isLetterOrDigit()) it else ' ' }
                .joinToString("")
                .trim()
                .replace(Regex("\\s+"), " ")

        /** Display form: no leading/trailing punctuation, single spaces, Title Case words (TV, KFC stay as is). */
        fun cleanAnswer(answer: String): String =
            answer.trim { !it.isLetterOrDigit() }.replace(Regex("\\s+"), " ")
                .split(' ').filter { it.isNotEmpty() }
                .joinToString(" ") { w -> if (w.length <= 3 && w.all { it.isUpperCase() }) w else w.replaceFirstChar { c -> c.titlecase() } }

        fun wordLengths(answer: String): List<Int> =
            answer.split(Regex("[\\s\\-]+")).map { w -> w.count { it.isLetter() } }.filter { it > 0 }

        fun matches(answer: String, hint: HintPattern): Boolean {
            val lengths = wordLengths(answer)
            if (lengths.size != hint.wordCount) return false
            if (lengths.sum() != hint.letterCount) return false
            if (hint.wordLengths.size == hint.wordCount && hint.wordLengths != lengths) return false
            return true
        }
    }
}

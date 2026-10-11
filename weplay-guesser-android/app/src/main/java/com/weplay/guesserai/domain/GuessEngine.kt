package com.weplay.guesserai.domain

import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt

/**
 * Turns the raw model guesses into the list the overlay shows:
 *  1. normalise + de-duplicate,
 *  2. drop answers the user already rejected this round ("Next Guess"),
 *  3. keep only answers that fit the game's word/letter hint (falls back to all
 *     answers, flagged, when nothing fits — so the overlay is never empty),
 *  4. smooth confidence across frames of the same drawing,
 *  5. adjust with what the learning database knows,
 *  6. sort, highest confidence first.
 */
class GuessEngine {

    fun rank(
        guesses: List<Guess>,
        hint: HintPattern?,
        rejected: Set<String>,
        history: Map<String, AnswerStats>,
        previous: Map<String, Int> = emptyMap(),
    ): RankResult {
        val merged = LinkedHashMap<String, Guess>()
        for (g in guesses) {
            val clean = cleanAnswer(g.answer)
            if (clean.isEmpty()) continue
            val key = normalize(clean)
            if (key in rejected) continue
            val existing = merged[key]
            if (existing == null || g.confidence > existing.confidence) {
                merged[key] = g.copy(answer = clean, confidence = g.confidence.coerceIn(0, 100))
            }
        }

        val all = merged.map { (key, g) ->
            val stats = history[key]
            val smoothed = previous[key]?.let { (0.6 * g.confidence + 0.4 * it).roundToInt() } ?: g.confidence
            RankedGuess(
                answer = g.answer,
                confidence = (smoothed + learningBoost(stats)).coerceIn(1, 99),
                reason = g.reason,
                matchesHint = hint == null || !hint.isKnown || matches(g.answer, hint),
                learned = stats != null && stats.correct > 0,
            )
        }

        val matching = all.filter { it.matchesHint }
        val hintKnown = hint != null && hint.isKnown
        val chosen = if (!hintKnown || matching.isNotEmpty()) matching else all
        val sorted = chosen.sortedWith(
            compareByDescending<RankedGuess> { it.confidence }.thenByDescending { it.learned }
        )
        return RankResult(sorted, hintMismatch = hintKnown && matching.isEmpty() && all.isNotEmpty())
    }

    data class RankResult(val guesses: List<RankedGuess>, val hintMismatch: Boolean)

    companion object {
        /** Lower-case, letters/digits/spaces only, single spaces. Used as the identity of an answer. */
        fun normalize(answer: String): String =
            answer.lowercase()
                .map { if (it.isLetterOrDigit()) it else ' ' }
                .joinToString("")
                .trim()
                .replace(Regex("\\s+"), " ")

        /** Display form: no leading/trailing punctuation, single spaces, Title Case words. */
        fun cleanAnswer(answer: String): String =
            answer.trim { !it.isLetterOrDigit() }.replace(Regex("\\s+"), " ")
                .split(' ').filter { it.isNotEmpty() }
                .joinToString(" ") { w -> w.replaceFirstChar { c -> c.titlecase() } }

        fun wordLengths(answer: String): List<Int> =
            answer.split(Regex("[\\s\\-]+")).map { w -> w.count { it.isLetter() } }.filter { it > 0 }

        fun matches(answer: String, hint: HintPattern): Boolean {
            val lengths = wordLengths(answer)
            if (lengths.size != hint.wordCount) return false
            if (lengths.sum() != hint.letterCount) return false
            if (hint.wordLengths.size == hint.wordCount && hint.wordLengths != lengths) return false
            return true
        }

        /** Previously confirmed answers get a boost; answers the user keeps rejecting are pushed down. */
        fun learningBoost(stats: AnswerStats?): Int {
            if (stats == null) return 0
            val up = min(18, 6 * stats.correct)
            val down = min(12, 3 * max(0, stats.rejected - stats.correct))
            return up - down
        }
    }
}

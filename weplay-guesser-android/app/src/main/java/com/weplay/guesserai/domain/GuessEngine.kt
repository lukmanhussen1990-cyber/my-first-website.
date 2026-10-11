package com.weplay.guesserai.domain

import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt

/**
 * Turns the raw model guesses into the list the overlay shows:
 *  1. normalise + de-duplicate,
 *  2. drop answers the user already rejected this round ("Next Guess"),
 *  3. keep only answers that fit the game's word/letter hint,
 *  4. smooth confidence across frames of the same drawing,
 *  5. adjust with the learning database and the word list,
 *  6. top up with word-list / learned answers that fit the hint when the model runs short,
 *  7. sort, highest confidence first.
 * When nothing fits the hint at all, the unfiltered model answers are shown, flagged.
 */
class GuessEngine {

    fun rank(
        guesses: List<Guess>,
        hint: HintPattern?,
        rejected: Set<String>,
        history: Map<String, AnswerStats>,
        previous: Map<String, Int> = emptyMap(),
        wordBank: WordBank = WordBank.EMPTY,
        knownAnswers: List<String> = emptyList(),
        maxResults: Int = 10,
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

        val hintKnown = hint != null && hint.isKnown
        val all = merged.map { (key, g) ->
            val stats = history[key]
            val smoothed = previous[key]?.let { (0.6 * g.confidence + 0.4 * it).roundToInt() } ?: g.confidence
            val listBonus = if (wordBank.contains(g.answer)) WORD_LIST_BONUS else 0
            RankedGuess(
                answer = g.answer,
                confidence = (smoothed + learningBoost(stats) + listBonus).coerceIn(1, 99),
                reason = g.reason,
                matchesHint = !hintKnown || matches(g.answer, hint!!),
                learned = stats != null && stats.correct > 0,
            )
        }

        val matching = all.filter { it.matchesHint }.toMutableList()
        if (hintKnown) addFillers(matching, hint!!, rejected, history, wordBank, knownAnswers, maxResults)

        val mismatch = hintKnown && matching.isEmpty() && all.isNotEmpty()
        val chosen = if (mismatch) all else matching
        val sorted = chosen.sortedWith(
            compareByDescending<RankedGuess> { it.confidence }.thenByDescending { it.learned }
        )
        return RankResult(sorted.take(maxResults), hintMismatch = mismatch)
    }

    /** Word-list and previously confirmed answers that fit the hint, below the model's own picks. */
    private fun addFillers(
        list: MutableList<RankedGuess>,
        hint: HintPattern,
        rejected: Set<String>,
        history: Map<String, AnswerStats>,
        wordBank: WordBank,
        knownAnswers: List<String>,
        maxResults: Int,
    ) {
        val present = list.mapTo(HashSet()) { normalize(it.answer) }
        fun add(answer: String, confidence: Int, source: GuessSource) {
            val key = normalize(answer)
            if (key in present || key in rejected || !matches(answer, hint)) return
            present += key
            val stats = history[key]
            list += RankedGuess(
                answer = cleanAnswer(answer),
                confidence = (confidence + learningBoost(stats)).coerceIn(1, 99),
                reason = if (source == GuessSource.LEARNED) "confirmed in an earlier round" else "common answer for this hint",
                matchesHint = true,
                learned = stats != null && stats.correct > 0,
                source = source,
            )
        }

        for (k in knownAnswers) if (list.size < maxResults) add(k, LEARNED_FILLER, GuessSource.LEARNED)

        val candidates = wordBank.candidates(hint)
        // A hint shape with a single known answer (1 letter → "A") is almost certainly that answer.
        if (candidates.size == 1) {
            add(candidates[0].answer, max(candidates[0].weight, SOLE_CANDIDATE_MIN), GuessSource.WORD_LIST)
            return
        }
        for (c in candidates) {
            if (list.size >= maxResults) break
            add(c.answer, min(WORD_LIST_FILLER_MAX, c.weight / 2), GuessSource.WORD_LIST)
        }
    }

    data class RankResult(val guesses: List<RankedGuess>, val hintMismatch: Boolean)

    companion object {
        private const val WORD_LIST_BONUS = 4
        private const val WORD_LIST_FILLER_MAX = 40
        private const val LEARNED_FILLER = 30
        private const val SOLE_CANDIDATE_MIN = 80

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

        /** Previously confirmed answers get a boost; answers the user keeps rejecting are pushed down. */
        fun learningBoost(stats: AnswerStats?): Int {
            if (stats == null) return 0
            val up = min(18, 6 * stats.correct)
            val down = min(12, 3 * max(0, stats.rejected - stats.correct))
            return up - down
        }
    }
}

package com.weplay.guesserai.domain

import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt

/**
 * Turns the raw model guesses into the list the overlay shows:
 *  1. normalise + de-duplicate,
 *  2. drop answers the user already rejected this round ("Next Guess"),
 *  3. keep only answers that fit the game's word/letter hint — reshaping near misses to fit
 *     (Snail → Snails, Bike → A Bike, Ice Cream → Icecream),
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
        val hintKnown = hint != null && hint.isKnown
        val merged = LinkedHashMap<String, Guess>()
        fun put(g: Guess) {
            val key = normalize(g.answer)
            if (key.isEmpty() || key in rejected) return
            val existing = merged[key]
            if (existing == null || g.confidence > existing.confidence) merged[key] = g
        }
        for (g in guesses) {
            val clean = cleanAnswer(g.answer)
            if (clean.isEmpty()) continue
            put(g.copy(answer = clean, confidence = g.confidence.coerceIn(0, 100)))
            // A near miss that only differs in form from the hint ("Snail" for 6 letters) is reshaped to fit.
            if (hintKnown && !matches(clean, hint!!)) {
                variantsOf(clean).firstOrNull { matches(it, hint) }?.let { v ->
                    put(Guess(v, (g.confidence - VARIANT_PENALTY).coerceIn(0, 100), "from \"$clean\""))
                }
            }
        }

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
        // Only distinctive shapes (2 letters, "2 words • 8 letters" …) are worth suggesting from the list.
        // For a common shape like "4 letters" the list is just random words that drown the real guesses.
        if (candidates.size <= MAX_FILLER_CANDIDATES) {
            for (c in candidates) {
                if (list.size >= maxResults) break
                add(c.answer, min(WORD_LIST_FILLER_MAX, c.weight / 2), GuessSource.WORD_LIST)
            }
        }
        // A 1-letter word in the hint is "A": "_ ____" (2 words • 5 letters) → A Bike, A Kite …
        if (startsWithA(hint)) {
            val rest = HintPattern(hint.wordCount - 1, hint.letterCount - 1, hint.wordLengths.drop(1))
            val restCandidates = wordBank.candidates(rest)
            if (restCandidates.size <= MAX_FILLER_CANDIDATES) {
                for (c in restCandidates) {
                    if (list.size >= maxResults) break
                    add("A " + c.answer, min(ARTICLE_FILLER_MAX, c.weight / 3), GuessSource.WORD_LIST)
                }
            }
        }
    }

    /** Word-list answers worth showing the model for this hint: only when the shape is distinctive. */
    fun promptCandidates(hint: HintPattern?, wordBank: WordBank): List<String> {
        val c = wordBank.candidates(hint)
        return if (c.size in 1..MAX_PROMPT_CANDIDATES) c.map { it.answer } else emptyList()
    }

    data class RankResult(val guesses: List<RankedGuess>, val hintMismatch: Boolean)

    companion object {
        private const val WORD_LIST_BONUS = 4
        private const val WORD_LIST_FILLER_MAX = 40
        private const val ARTICLE_FILLER_MAX = 25
        private const val LEARNED_FILLER = 30
        private const val SOLE_CANDIDATE_MIN = 80
        private const val VARIANT_PENALTY = 10
        private const val MAX_FILLER_CANDIDATES = 12
        private const val MAX_PROMPT_CANDIDATES = 15
        private val ARTICLES = setOf("a", "an", "the")

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

        /** True when the hint's first word may be the 1-letter "A". */
        fun startsWithA(hint: HintPattern): Boolean =
            hint.wordCount >= 2 && hint.letterCount >= 2 &&
                (hint.wordLengths.size != hint.wordCount || hint.wordLengths.first() == 1)

        /**
         * Other spellings of an answer the game might use: singular/plural of the last word,
         * with or without a leading "A"/"An"/"The", and multi-word answers written as one word.
         */
        fun variantsOf(answer: String): List<String> {
            val words = cleanAnswer(answer).split(' ').filter { it.isNotEmpty() }
            if (words.isEmpty()) return emptyList()
            val bases = buildList {
                add(words)
                if (words.size > 1 && words[0].lowercase() in ARTICLES) add(words.drop(1))
            }
            val out = LinkedHashSet<String>()
            for (b in bases) {
                val head = b.dropLast(1)
                for (last in listOf(b.last()) + numberForms(b.last())) {
                    val w = head + last
                    out += w.joinToString(" ")
                    out += "A " + w.joinToString(" ")
                    if (w.first().first().lowercaseChar() in "aeiou") out += "An " + w.joinToString(" ")
                    if (w.size > 1) out += cleanAnswer(w.joinToString("").lowercase())
                }
            }
            out.remove(cleanAnswer(answer))
            return out.toList()
        }

        /** Plural ↔ singular forms of one word. */
        private fun numberForms(word: String): List<String> {
            val w = word.lowercase()
            val forms = mutableListOf<String>()
            when {
                w.endsWith("ies") && w.length > 4 -> forms += word.dropLast(3) + "y"
                w.endsWith("ches") || w.endsWith("shes") || w.endsWith("xes") || w.endsWith("ses") || w.endsWith("zes") ->
                    forms += word.dropLast(2)
                w.endsWith("s") && !w.endsWith("ss") && w.length > 3 -> forms += word.dropLast(1)
            }
            if (!w.endsWith("s") || w.endsWith("ss")) {
                forms += when {
                    w.endsWith("y") && w.length > 2 && w[w.length - 2] !in "aeiou" -> word.dropLast(1) + "ies"
                    w.endsWith("s") || w.endsWith("x") || w.endsWith("z") || w.endsWith("ch") || w.endsWith("sh") -> word + "es"
                    else -> word + "s"
                }
                if (w.endsWith("o")) forms += word + "es"
            }
            return forms
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

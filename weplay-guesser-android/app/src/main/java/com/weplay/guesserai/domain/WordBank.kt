package com.weplay.guesserai.domain

/**
 * Common answers of the drawing game, indexed by the shape of the hint (words + letters).
 *
 * Line format: `answer` or `answer|weight` (weight 1–99, default 50); `#` starts a comment.
 * The hint shape alone narrows the answer a lot — a 1-letter answer is "A", a 2-letter one is
 * usually TV / GO / AC / CD / DJ, "2 words • 8 letters" is often Free Fire — so these
 * candidates are given to the model and also fill the overlay when the model runs short.
 */
class WordBank(entries: List<Entry>) {

    data class Entry(val answer: String, val weight: Int, val order: Int)

    private val byKey: Map<String, Entry>
    private val byShape: Map<Pair<Int, Int>, List<Entry>>

    init {
        val unique = LinkedHashMap<String, Entry>()
        for (e in entries) {
            val key = GuessEngine.normalize(e.answer)
            if (key.isEmpty()) continue
            val old = unique[key]
            if (old == null || e.weight > old.weight) unique[key] = e.copy(order = old?.order ?: e.order)
        }
        byKey = unique
        byShape = unique.values.groupBy { shapeOf(it.answer) }
            .mapValues { (_, list) -> list.sortedWith(compareByDescending<Entry> { it.weight }.thenBy { it.order }) }
    }

    val size: Int get() = byKey.size

    fun contains(answer: String): Boolean = GuessEngine.normalize(answer) in byKey

    fun weight(answer: String): Int? = byKey[GuessEngine.normalize(answer)]?.weight

    /** Entries that fit [hint] exactly, most likely first. */
    fun candidates(hint: HintPattern?, limit: Int = Int.MAX_VALUE): List<Entry> {
        if (hint == null || !hint.isKnown) return emptyList()
        return byShape[hint.wordCount to hint.letterCount].orEmpty()
            .filter { GuessEngine.matches(it.answer, hint) }
            .take(limit)
    }

    companion object {
        val EMPTY = WordBank(emptyList())

        fun shapeOf(answer: String): Pair<Int, Int> =
            GuessEngine.wordLengths(answer).let { it.size to it.sum() }

        fun parse(text: String, defaultWeight: Int = 50, startOrder: Int = 0): List<Entry> =
            text.lineSequence()
                .map { it.substringBefore('#').trim() }
                .filter { it.isNotEmpty() }
                .mapIndexedNotNull { i, line ->
                    val answer = GuessEngine.cleanAnswer(line.substringBefore('|'))
                    val weight = line.substringAfter('|', "").trim().toIntOrNull() ?: defaultWeight
                    if (answer.isEmpty()) null else Entry(answer, weight.coerceIn(1, 99), startOrder + i)
                }
                .toList()
    }
}

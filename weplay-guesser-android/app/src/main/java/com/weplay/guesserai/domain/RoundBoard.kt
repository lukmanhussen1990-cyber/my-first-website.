package com.weplay.guesserai.domain

import kotlin.math.roundToInt

/**
 * The guesses collected over one round (one word). Each new answer from the model is blended
 * with what was already on the board, and guesses the model stops mentioning fade out slowly
 * instead of vanishing — one bad frame can no longer wipe a good guess like "Halwa".
 */
class RoundBoard(
    /** Weight of the previous score when the model repeats a guess. */
    private val keep: Double = 0.45,
    /** Score multiplier per frame for guesses the model did not repeat. */
    private val decay: Double = 0.8,
    /** Guesses fading below this score leave the board. */
    private val dropBelow: Double = 8.0,
    private val maxEntries: Int = 30,
) {
    private data class Entry(val answer: String, val score: Double, val reason: String)

    private val entries = LinkedHashMap<String, Entry>()

    val isEmpty: Boolean get() = entries.isEmpty()

    /**
     * Blend a final answer from the model into the board; returns the board, best first.
     * A [deep] answer (the slower, stronger model) counts for more and fades the others less.
     */
    fun commit(guesses: List<Guess>, deep: Boolean = false): List<Guess> {
        val fresh = blend(guesses, if (deep) DEEP_KEEP else keep)
        for (key in entries.keys.toList()) {
            if (key in fresh) continue
            val e = entries.getValue(key)
            val faded = e.score * (if (deep) DEEP_DECAY else decay)
            if (faded < dropBelow) entries.remove(key) else entries[key] = e.copy(score = faded)
        }
        entries.putAll(fresh)
        if (entries.size > maxEntries) {
            entries.entries.sortedBy { it.value.score }.take(entries.size - maxEntries).forEach { entries.remove(it.key) }
        }
        return snapshot(entries)
    }

    /** What the board would look like with a partial (still streaming) answer, without changing it. */
    fun preview(partial: List<Guess>): List<Guess> {
        val view = LinkedHashMap<String, Entry>()
        entries.forEach { (k, e) -> view[k] = e.copy(score = e.score * PREVIEW_FADE) }
        view.putAll(blend(partial, keep))
        return snapshot(view)
    }

    /** The board as it stands, best first. */
    fun current(): List<Guess> = snapshot(entries)

    fun clear() = entries.clear()

    private fun blend(guesses: List<Guess>, keep: Double): Map<String, Entry> {
        val out = LinkedHashMap<String, Entry>()
        for (g in guesses) {
            val key = GuessEngine.normalize(g.answer)
            if (key.isEmpty()) continue
            val old = entries[key]
            val score = if (old == null) g.confidence.toDouble() else (1 - keep) * g.confidence + keep * old.score
            val prev = out[key]
            if (prev == null || score > prev.score) out[key] = Entry(g.answer, score, g.reason.ifBlank { old?.reason.orEmpty() })
        }
        return out
    }

    private fun snapshot(map: Map<String, Entry>): List<Guess> =
        map.values.sortedByDescending { it.score }.map { Guess(it.answer, it.score.roundToInt().coerceIn(0, 100), it.reason) }

    private companion object {
        const val PREVIEW_FADE = 0.9
        const val DEEP_KEEP = 0.3
        const val DEEP_DECAY = 0.9
    }
}

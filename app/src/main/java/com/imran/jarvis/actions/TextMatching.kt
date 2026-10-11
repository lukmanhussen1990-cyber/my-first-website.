package com.imran.jarvis.actions

import java.util.Locale

/** Forgiving name matching, used to find apps and contacts from what the user said. */
object TextMatching {

    private val NON_WORD = Regex("[^\\p{L}\\p{M}\\p{N}]+")

    /** Lower-case, letters and digits only (any script, including Hindi), single spaces. */
    fun normalize(text: String): String =
        text.lowercase(Locale.ROOT).replace(NON_WORD, " ").trim()

    /**
     * How well does [candidate] match what the user asked for ([query])?
     * 100 = identical, 0 = no match. Examples: "chrome" vs "Google Chrome" = 85, "play store" vs "Playstore" = 98.
     */
    fun score(query: String, candidate: String): Int {
        val q = normalize(query)
        val c = normalize(candidate)
        if (q.isEmpty() || c.isEmpty()) return 0
        if (q == c) return 100

        val qCompact = q.replace(" ", "")
        val cCompact = c.replace(" ", "")
        if (qCompact == cCompact) return 98

        val qTokens = q.split(' ')
        val cTokens = c.split(' ')
        return when {
            q in cTokens -> 85 // one whole word of the candidate: "chrome" in "google chrome"
            c.startsWith(q) -> 80
            qTokens.all { it in cTokens } -> 78 // all words, any order: "sharma rahul" vs "rahul sharma"
            cTokens.any { it.startsWith(q) } -> 70
            qTokens.all { qt -> cTokens.any { it.startsWith(qt) } } -> 65
            qCompact.length >= 3 && cCompact.contains(qCompact) -> 50
            cCompact.length >= 4 && qCompact.contains(cCompact) -> 40 // "open whatsapp" contains "whatsapp"
            else -> 0
        }
    }
}

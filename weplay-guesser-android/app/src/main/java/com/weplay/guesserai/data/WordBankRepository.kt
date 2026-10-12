package com.weplay.guesserai.data

import android.content.Context
import com.weplay.guesserai.domain.WordBank

/** Built-in word list (assets/wordbank.txt) plus the user's own words from Settings. */
class WordBankRepository(private val context: Context) {
    private val builtIn: List<WordBank.Entry> by lazy {
        runCatching { context.assets.open("wordbank.txt").bufferedReader().use { WordBank.parse(it.readText()) } }
            .getOrDefault(emptyList())
    }

    /** Size of the built-in list; reads the asset on first use, so call it off the main thread. */
    val builtInCount: Int get() = builtIn.size

    @Volatile private var cached: Pair<String, WordBank>? = null

    /** Rebuilt only when the custom word text changes. */
    fun get(customWords: String): WordBank {
        cached?.let { (text, bank) -> if (text == customWords) return bank }
        // User words come first and default to a higher weight than built-ins.
        val bank = WordBank(WordBank.parse(customWords, defaultWeight = 65) + builtIn.map { it.copy(order = it.order + 100_000) })
        cached = customWords to bank
        return bank
    }
}

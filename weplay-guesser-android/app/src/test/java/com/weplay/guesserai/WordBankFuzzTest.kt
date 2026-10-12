package com.weplay.guesserai

import com.weplay.guesserai.domain.GuessEngine
import com.weplay.guesserai.domain.HintPattern
import com.weplay.guesserai.domain.WordBank
import org.junit.Assert.assertTrue
import org.junit.Test
import kotlin.random.Random

/** "My words" is free text typed by the user and is used on every request: no input may break it. */
class WordBankFuzzTest {
    private val samples = listOf(
        "", "\n\n", "|", "|||", "#", "# only a comment", "Free Fire|90", "Free Fire|", "|90", "TV|-5", "TV|9999999999999",
        "  heart   beat  |  80 ", "🍮🍮", "A", "Ölçü|50", "x".repeat(5_000), "Free Fire|90 # best game", "\t\r\n Pac-Man |77",
    )

    @Test fun `any typed word list parses and answers hint lookups`() {
        val rnd = Random(7)
        val alphabet = "ab AZ|#\n\t-_.😀ü0123456789"
        val inputs = samples + List(2_000) { String(CharArray(rnd.nextInt(0, 120)) { alphabet[rnd.nextInt(alphabet.length)] }) }
        val engine = GuessEngine()
        for (text in inputs) {
            val entries = runCatching { WordBank.parse(text, defaultWeight = 65) }.getOrElse { throw AssertionError("parse threw on <$text>", it) }
            entries.forEach { assertTrue("weight in range for <$text>", it.weight in 1..99) }
            val bank = WordBank(entries)
            for (w in 1..3) for (l in listOf(1, 2, 5, 8, 40)) {
                runCatching { engine.promptCandidates(HintPattern(w, l), bank) }
                    .onFailure { throw AssertionError("candidates threw on <$text> for $w/$l", it) }
            }
        }
    }
}

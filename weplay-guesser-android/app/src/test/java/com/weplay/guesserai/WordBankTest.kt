package com.weplay.guesserai

import com.weplay.guesserai.domain.GuessEngine
import com.weplay.guesserai.domain.HintPattern
import com.weplay.guesserai.domain.WordBank
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File

/** Uses the real built-in list from src/main/assets. */
class WordBankTest {
    private val bank = WordBank(WordBank.parse(File("src/main/assets/wordbank.txt").readText()))
    private val engine = GuessEngine()

    @Test fun `the model is told the likely answers for distinctive hints`() {
        assertEquals("A Bike", engine.promptCandidates(HintPattern(2, 5), bank).first())
        assertEquals("Free Fire", engine.promptCandidates(HintPattern(2, 8), bank).first())
        assertEquals(listOf("TV", "GO", "AC", "CD", "DJ"), engine.promptCandidates(HintPattern(1, 2), bank).take(5))
        assertEquals(listOf("A"), engine.promptCandidates(HintPattern(1, 1), bank))
    }

    @Test fun `no random list words for a common single-word hint`() {
        assertTrue(engine.promptCandidates(HintPattern(1, 4), bank).isEmpty())
        assertTrue(engine.promptCandidates(null, bank).isEmpty())
    }

    @Test fun `word-list answers never appear as guesses by themselves`() {
        val r = engine.rank(emptyList(), HintPattern(2, 9, clue = "Organ"), emptySet(), emptyMap())
        assertTrue(r.guesses.isEmpty())
    }

    @Test fun `built-in list loads`() {
        assertTrue(bank.size > 500)
    }

    @Test fun `1 letter is A`() {
        assertEquals(listOf("A"), bank.candidates(HintPattern(1, 1)).map { it.answer })
    }

    @Test fun `2 letters are the common abbreviations, user's examples first`() {
        val two = bank.candidates(HintPattern(1, 2)).map { it.answer }
        assertEquals(listOf("TV", "GO", "AC", "CD", "DJ"), two.take(5))
    }

    @Test fun `2 words 8 letters starts with Free Fire`() {
        assertEquals("Free Fire", bank.candidates(HintPattern(2, 8)).first().answer)
    }

    @Test fun `user words outrank built-ins and can carry a weight`() {
        val custom = WordBank(WordBank.parse("Fire Fist|90", 65) + WordBank.parse(File("src/main/assets/wordbank.txt").readText()))
        assertEquals("Fire Fist", custom.candidates(HintPattern(2, 8)).first().answer)
    }

    @Test fun `abbreviations keep their capitals`() {
        assertEquals("TV", GuessEngine.cleanAnswer("TV"))
        assertEquals("Free Fire", GuessEngine.cleanAnswer("free fire"))
    }
}

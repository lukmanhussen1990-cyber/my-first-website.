package com.weplay.guesserai

import com.weplay.guesserai.domain.Guess
import com.weplay.guesserai.domain.GuessEngine
import com.weplay.guesserai.domain.GuessSource
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

    @Test fun `sole candidate shape fills in A with high confidence even if the AI missed it`() {
        val r = engine.rank(listOf(Guess("Arrow", 60)), HintPattern(1, 1), emptySet(), emptyMap(), wordBank = bank)
        assertEquals("A", r.guesses.first().answer)
        assertTrue(r.guesses.first().confidence >= 80)
        assertFalse(r.hintMismatch)
    }

    @Test fun `AI guesses stay above word-list fillers`() {
        val r = engine.rank(listOf(Guess("TV", 70)), HintPattern(1, 2), emptySet(), emptyMap(), wordBank = bank)
        assertEquals("TV", r.guesses.first().answer)
        assertEquals(GuessSource.AI, r.guesses.first().source)
        assertTrue(r.guesses.drop(1).all { it.source == GuessSource.WORD_LIST })
        assertTrue(r.guesses.map { it.answer }.containsAll(listOf("GO", "AC", "CD", "DJ")))
    }

    @Test fun `free fire is suggested when the model has nothing that fits`() {
        val r = engine.rank(listOf(Guess("Gun", 80), Guess("Fire", 70)), HintPattern(2, 8), emptySet(), emptyMap(), wordBank = bank)
        assertEquals("Free Fire", r.guesses.first().answer)
        assertFalse(r.hintMismatch)
    }

    @Test fun `user words outrank built-ins and can carry a weight`() {
        val custom = WordBank(WordBank.parse("Fire Fist|90", 65) + WordBank.parse(File("src/main/assets/wordbank.txt").readText()))
        assertEquals("Fire Fist", custom.candidates(HintPattern(2, 8)).first().answer)
    }

    @Test fun `rejected filler is not suggested again`() {
        val r = engine.rank(emptyList(), HintPattern(1, 2), setOf("tv"), emptyMap(), wordBank = bank)
        assertFalse(r.guesses.any { it.answer == "TV" })
    }

    @Test fun `abbreviations keep their capitals`() {
        assertEquals("TV", GuessEngine.cleanAnswer("TV"))
        assertEquals("Free Fire", GuessEngine.cleanAnswer("free fire"))
    }

    @Test fun `2 words 5 letters suggests A Bike first`() {
        val r = engine.rank(emptyList(), HintPattern(2, 5), emptySet(), emptyMap(), wordBank = bank)
        assertEquals("A Bike", r.guesses.first().answer)
        assertTrue(r.guesses.all { it.answer.startsWith("A ") || GuessEngine.wordLengths(it.answer).first() != 1 })
    }

    @Test fun `A-prefix fillers come from the word list when lengths are unknown`() {
        val r = engine.rank(emptyList(), HintPattern(2, 6), emptySet(), emptyMap(), wordBank = bank)
        assertTrue(r.guesses.any { it.answer == "A House" })
    }

    @Test fun `no A-prefix when the first word is known to be longer`() {
        val r = engine.rank(emptyList(), HintPattern(2, 5, listOf(2, 3)), emptySet(), emptyMap(), wordBank = bank)
        assertFalse(r.guesses.any { it.answer.startsWith("A ") })
    }
}

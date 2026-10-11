package com.imran.jarvis.actions

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class TextMatchingTest {

    @Test
    fun `normalize lowercases and drops punctuation`() {
        assertEquals("rahul sharma", TextMatching.normalize("  Rahul   SHARMA!! "))
        assertEquals("dr a b c", TextMatching.normalize("Dr. A-B_C"))
    }

    @Test
    fun `normalize keeps Hindi letters together`() {
        assertEquals("यूट्यूब", TextMatching.normalize("यूट्यूब"))
        assertEquals("राहुल शर्मा", TextMatching.normalize("राहुल, शर्मा"))
    }

    @Test
    fun `exact and spacing-only differences`() {
        assertEquals(100, TextMatching.score("whatsapp", "WhatsApp"))
        assertEquals(98, TextMatching.score("play store", "Playstore"))
    }

    @Test
    fun `a whole word of the name scores high`() {
        assertEquals(85, TextMatching.score("chrome", "Google Chrome"))
        assertEquals(85, TextMatching.score("rahul", "Rahul Sharma"))
    }

    @Test
    fun `starts-with beats contains`() {
        val startsWith = TextMatching.score("cal", "Calculator")
        val contains = TextMatching.score("cul", "Calculator")
        assertTrue(startsWith > contains)
    }

    @Test
    fun `word order does not matter`() {
        assertEquals(78, TextMatching.score("sharma rahul", "Rahul Sharma"))
    }

    @Test
    fun `unrelated names do not match`() {
        assertEquals(0, TextMatching.score("camera", "Calculator"))
        assertEquals(0, TextMatching.score("", "Anything"))
        assertEquals(0, TextMatching.score("anything", ""))
    }

    @Test
    fun `the user's longer sentence still finds the short app name`() {
        assertTrue(TextMatching.score("open whatsapp please", "WhatsApp") >= 40)
    }

    @Test
    fun `hindi app aliases map to english names`() {
        assertEquals("youtube", AppAliases.canonical("यूट्यूब"))
        assertEquals("whatsapp", AppAliases.canonical("व्हाट्सएप"))
        assertEquals("Chrome", AppAliases.canonical("Chrome"))
    }
}

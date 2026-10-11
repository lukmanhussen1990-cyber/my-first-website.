package com.imran.jarvis.voice

import com.imran.jarvis.data.VoiceGender
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class VoiceTextTest {

    @Test
    fun `links, emojis and markdown are removed before speaking`() {
        assertEquals("Hello Imran", SpeechText.sanitize("Hello **Imran** 👋"))
        assertEquals("See", SpeechText.sanitize("See https://example.com/page?x=1"))
        assertEquals("one two", SpeechText.sanitize("one   \n  two"))
        assertEquals("", SpeechText.sanitize("  😀  "))
    }

    @Test
    fun `degrees and Hindi are kept`() {
        assertEquals("तापमान 28°C है।", SpeechText.sanitize("तापमान 28°C है।"))
    }

    @Test
    fun `very long text is cut to what the speech engine accepts`() {
        assertEquals(3900, SpeechText.sanitize("a".repeat(10_000)).length)
    }

    @Test
    fun `voice names that say male or female`() {
        assertEquals(VoiceGender.FEMALE, VoiceGenderGuess.guess("en-in-language-female-1"))
        assertEquals(VoiceGender.MALE, VoiceGenderGuess.guess("hindi male voice"))
        assertEquals(VoiceGender.FEMALE, VoiceGenderGuess.guess("x", setOf("female")))
    }

    @Test
    fun `female is not mistaken for male`() {
        // "female" contains the letters "male", which must not count as a male voice.
        assertEquals(VoiceGender.FEMALE, VoiceGenderGuess.guess("voice-female"))
    }

    @Test
    fun `samsung style names`() {
        assertEquals(VoiceGender.FEMALE, VoiceGenderGuess.guess("hi-IN-SMTf00"))
        assertEquals(VoiceGender.MALE, VoiceGenderGuess.guess("en-IN-SMTm01"))
    }

    @Test
    fun `google india speaker codes`() {
        assertEquals(VoiceGender.FEMALE, VoiceGenderGuess.guess("hi-in-x-hia-local"))
        assertEquals(VoiceGender.MALE, VoiceGenderGuess.guess("hi-in-x-hib-network"))
        assertEquals(VoiceGender.MALE, VoiceGenderGuess.guess("en-in-x-enc-local"))
        assertEquals(VoiceGender.FEMALE, VoiceGenderGuess.guess("en-in-x-end-local"))
    }

    @Test
    fun `unknown voices are not guessed`() {
        assertNull(VoiceGenderGuess.guess("en-us-x-tpd-local"))
        assertNull(VoiceGenderGuess.guess("some-engine-voice-7"))
    }
}

package com.imran.jarvis.voice

/** Cleans text before it is read aloud: a voice reads web links, emojis and markdown symbols badly. */
object SpeechText {

    /** Android's own limit is just under 4000 characters per request. */
    private const val MAX_LENGTH = 3900

    private val URL = Regex("https?://\\S+")
    // Symbols/dingbats, emoji modifiers and every emoji block (U+1F000 - U+1FAFF). Java regex works on
    // whole code points, so the big emoji must be written as \x{...}, not as surrogate pairs.
    private val EMOJI = Regex("[\\u2600-\\u27BF\\uFE0F\\u200D\\x{1F000}-\\x{1FAFF}]")
    private val MARKDOWN = Regex("[*_`#>~]+")
    private val SPACES = Regex("\\s+")

    fun sanitize(text: String): String =
        text.replace(URL, " ")
            .replace(EMOJI, " ")
            .replace(MARKDOWN, " ")
            .replace(SPACES, " ")
            .trim()
            .take(MAX_LENGTH)
}

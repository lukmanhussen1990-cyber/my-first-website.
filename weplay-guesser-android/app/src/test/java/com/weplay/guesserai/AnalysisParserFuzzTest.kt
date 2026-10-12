package com.weplay.guesserai

import com.weplay.guesserai.data.ai.AnalysisParser
import com.weplay.guesserai.domain.VisionException
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Assert.fail
import org.junit.Test
import kotlin.random.Random

/** Streamed replies arrive cut at any byte; garbled ones happen. The parser may give up, never crash. */
class AnalysisParserFuzzTest {
    private val replies = listOf(
        """{"screen_state":"guessing","revealed_answer":"","canvas_empty":false,"hint":{"word_count":2,"letter_count":9,"word_lengths":[5,4],"clue":"Organ"},"seen":"heart with a \"pulse\" line","guesses":[{"answer":"Heart Beat","confidence":82,"reason":"heart + pulse"},{"answer":"Heartbeat","confidence":"44%","reason":"one word }{ ]["},{"answer":"Pulse Rate","confidence":0.3,"reason":"line"}],"detected_object":"Heart","category":"Body","emoji":"❤️","canvas_box":[0,0.1,1,0.49],"hint_box":[0.23,0.04,0.8,0.1]}""",
        "Here is my answer:\n```json\n{\"screen_state\":\"round_over\",\"revealed_answer\":\"fear\",\"canvas_empty\":false,\"hint\":null,\"guesses\":[],\"detected_object\":\"\",\"category\":\"\",\"emoji\":\"\"}\n```",
        """{"is_drawing_game":true,"guesses":[{"answer":"A Bike","confidence":"90"},{"answer":"","confidence":10},{"answer":"Halwa 🍮","confidence":null}]}""",
        """{"screen_state":"not_game","guesses":[{"answer":"x\\y\"z","confidence":1e2}],"hint":{"word_count":"two","letter_count":-3}}""",
    )

    private fun parseAllowingBadResponse(text: String) {
        try {
            AnalysisParser.parse(text)
        } catch (e: VisionException.BadResponse) {
            // giving up on a broken reply is fine
        } catch (e: Throwable) {
            fail("parse threw ${e.javaClass.simpleName} on: ${text.take(120)}")
        }
    }

    @Test fun `every prefix of a streaming reply parses without throwing`() {
        var checked = 0
        for (reply in replies) for (cut in 0..reply.length) {
            val prefix = reply.substring(0, cut)
            runCatching { AnalysisParser.parsePartial(prefix) }.onFailure { fail("parsePartial threw $it at $cut of: $reply") }
            parseAllowingBadResponse(prefix)
            checked++
        }
        assertTrue(checked > 500)
    }

    @Test fun `guesses appear in order as the stream completes them`() {
        val reply = replies[0]
        val seen = (0..reply.length).map { AnalysisParser.parsePartial(reply.substring(0, it)).guesses.size }
        assertEquals("guess count never goes down", seen, seen.sorted())
        assertEquals(3, seen.last())
        assertEquals(listOf("Heart Beat", "Heartbeat", "Pulse Rate"), AnalysisParser.parsePartial(reply).guesses.map { it.answer })
    }

    @Test fun `randomly garbled replies never crash`() {
        val rnd = Random(42)
        val alphabet = "{}[]\":,\\ \n0123456789.-abcetruenl%❤"
        repeat(3_000) {
            val base = StringBuilder(replies[rnd.nextInt(replies.size)])
            repeat(1 + rnd.nextInt(6)) {
                val at = rnd.nextInt(base.length + 1)
                when (rnd.nextInt(3)) {
                    0 -> base.insert(at, alphabet[rnd.nextInt(alphabet.length)])
                    1 -> if (at < base.length) base.deleteCharAt(at)
                    else -> if (at < base.length) base.setCharAt(at, alphabet[rnd.nextInt(alphabet.length)])
                }
            }
            val text = base.toString()
            runCatching { AnalysisParser.parsePartial(text) }.onFailure { fail("parsePartial threw $it on: $text") }
            parseAllowingBadResponse(text)
        }
    }
}

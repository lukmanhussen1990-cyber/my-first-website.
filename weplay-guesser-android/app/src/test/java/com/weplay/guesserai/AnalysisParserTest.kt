package com.weplay.guesserai

import com.weplay.guesserai.data.ai.AnalysisParser
import com.weplay.guesserai.domain.HintPattern
import com.weplay.guesserai.domain.VisionException
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class AnalysisParserTest {
    @Test fun `parses full shape`() {
        val a = AnalysisParser.parse(
            """{"is_drawing_game":true,"canvas_empty":false,"detected_object":"Fire truck","category":"Vehicle","emoji":"🚒",
               "hint":{"word_count":2,"letter_count":9,"word_lengths":[4,5]},"canvas_box":[0.05,0.2,0.95,0.6],
               "guesses":[{"answer":"Red Vehicle","confidence":82,"reason":"red"},{"answer":"Fire Truck","confidence":95,"reason":"ladder"}]}"""
        )
        assertEquals(HintPattern(2, 9, listOf(4, 5)), a.hint)
        assertEquals("Fire Truck", a.guesses.first().answer)
        assertEquals(4, a.canvasBox!!.size)
        assertEquals("🚒", a.emoji)
    }

    @Test fun `accepts the minimal spec shape inside prose and code fences`() {
        val a = AnalysisParser.parse(
            "Here you go:\n```json\n{ \"guesses\":[{\"answer\":\"Cat House\",\"confidence\":\"92%\",\"reason\":\"a {cat} in a house\"}] }\n```"
        )
        assertEquals("Cat House", a.guesses.single().answer)
        assertEquals(92, a.guesses.single().confidence)
        assertNull(a.hint)
        assertTrue(a.isDrawingGame)
    }

    @Test fun `confidence as fraction is scaled`() {
        val a = AnalysisParser.parse("""{"guesses":[{"answer":"Dog","confidence":0.7,"reason":""}]}""")
        assertEquals(70, a.guesses.single().confidence)
    }

    @Test fun `zero hint means unknown, bad canvas box dropped`() {
        val a = AnalysisParser.parse("""{"hint":{"word_count":0,"letter_count":0,"word_lengths":[]},"canvas_box":[0,0,2,2],"guesses":[]}""")
        assertNull(a.hint)
        assertNull(a.canvasBox)
    }

    @Test(expected = VisionException.BadResponse::class)
    fun `no json throws`() {
        AnalysisParser.parse("I cannot tell what this is.")
    }
}

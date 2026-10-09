package com.loe.chat

import com.loe.chat.ai.Router
import com.loe.chat.ai.SseParser
import com.loe.chat.data.AppSettings
import com.loe.chat.data.BotCatalog
import com.loe.chat.data.Provider
import com.loe.chat.ui.components.MarkdownParser
import com.loe.chat.ui.components.MdBlock
import com.loe.chat.util.Text
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.ZoneId

class LogicTest {

    @Test
    fun sseParserJoinsDataLinesAndSkipsComments() {
        val parser = SseParser()
        val events = listOf(
            ": OPENROUTER PROCESSING",
            "",
            "event: message",
            "data: {\"a\":1}",
            "",
            "data: line1",
            "data: line2",
            "",
            "data: [DONE]",
        ).mapNotNull { parser.feed(it) } + listOfNotNull(parser.flush())
        assertEquals(3, events.size)
        assertEquals("message", events[0].event)
        assertEquals("{\"a\":1}", events[0].data)
        assertEquals("line1\nline2", events[1].data)
        assertEquals("[DONE]", events[2].data)
    }

    @Test
    fun markdownParsesCommonBlocks() {
        val md = """
            # Title
            Some **bold** text.

            - one
            - two
              continued

            1. first
            2. second

            ```kotlin
            val x = 1
            ```

            > quoted

            | A | B |
            |---|---|
            | 1 | 2 |

            ![cat](https://example.com/cat.png)
            https://example.com/video.mp4
        """.trimIndent()
        val blocks = MarkdownParser.parse(md)
        assertTrue(blocks[0] is MdBlock.Heading)
        assertTrue(blocks[1] is MdBlock.Paragraph)
        val bullets = blocks[2] as MdBlock.ListBlock
        assertEquals(2, bullets.items.size)
        assertEquals("two continued", bullets.items[1].text)
        val numbered = blocks[3] as MdBlock.ListBlock
        assertEquals("2.", numbered.items[1].marker)
        val code = blocks[4] as MdBlock.Code
        assertEquals("kotlin", code.language)
        assertEquals("val x = 1", code.code)
        assertTrue(blocks[5] is MdBlock.Quote)
        val table = blocks[6] as MdBlock.Table
        assertEquals(listOf("A", "B"), table.header)
        assertEquals(listOf(listOf("1", "2")), table.rows)
        assertTrue(blocks[7] is MdBlock.Image)
        assertTrue(blocks[8] is MdBlock.Video)
    }

    @Test
    fun unfinishedCodeFenceWhileStreamingStaysCode() {
        val blocks = MarkdownParser.parse("Here:\n```python\nprint('hi')")
        assertEquals("print('hi')", (blocks[1] as MdBlock.Code).code)
    }

    @Test
    fun titles() {
        assertEquals("Gi Conversation", Text.fallbackTitle("Gi"))
        assertEquals("How do I bake sourdough bread", Text.fallbackTitle("how do I bake sourdough bread at home please"))
        assertEquals("Friendly Greeting", Text.cleanTitle("\"Friendly Greeting.\""))
        assertEquals("Page Curve Unitarity Proof", Text.cleanTitle("Title: **Page Curve Unitarity Proof**\nmore"))
        assertNull(Text.cleanTitle("   "))
    }

    @Test
    fun dates() {
        val zone = ZoneId.of("UTC")
        val today = LocalDate.of(2026, 10, 9)
        val sameDay = today.atTime(17, 42).atZone(zone).toInstant().toEpochMilli()
        val earlier = LocalDate.of(2026, 9, 5).atTime(9, 0).atZone(zone).toInstant().toEpochMilli()
        assertEquals("5:42 pm", Text.listDate(sameDay, today, zone))
        assertTrue(Text.listDate(earlier, today, zone).startsWith("5 Sep"))
        assertEquals("05:42 pm", Text.messageTime(sameDay, zone))
        assertEquals("06:17:54", Text.countdownToMidnight(LocalDateTime.of(2026, 10, 9, 17, 42, 6)))
    }

    @Test
    fun routingPrefersNativeKeyThenOpenRouterThenPoe() {
        val opus = BotCatalog.officialById("claude-opus-5.5")!!
        val none = AppSettings()
        assertNull(Router.resolve(opus, none))

        val openRouter = AppSettings(apiKeys = mapOf(Provider.OPENROUTER to "or-key"))
        assertEquals(Provider.OPENROUTER, Router.resolve(opus, openRouter)!!.provider)
        assertEquals("anthropic/claude-opus-5.5", Router.resolve(opus, openRouter)!!.model)

        val both = AppSettings(apiKeys = mapOf(Provider.OPENROUTER to "or-key", Provider.ANTHROPIC to "ant-key"))
        val route = Router.resolve(opus, both)!!
        assertEquals(Provider.ANTHROPIC, route.provider)
        assertEquals("claude-opus-5-5", route.model)
        assertEquals("ant-key", route.apiKey)

        val poeOnly = AppSettings(apiKeys = mapOf(Provider.POE to "poe-key"))
        assertEquals("claude-opus-5.5", Router.resolve(opus, poeOnly)!!.model)

        val overridden = both.copy(modelOverrides = mapOf("claude-opus-5.5|anthropic" to "claude-opus-5"))
        assertEquals("claude-opus-5", Router.resolve(opus, overridden)!!.model)
    }

    @Test
    fun assistantUsesFirstConnectedProvider() {
        val assistant = BotCatalog.assistant
        val google = AppSettings(apiKeys = mapOf(Provider.GOOGLE to "g"))
        assertEquals("gemini-3.5-flash", Router.resolve(assistant, google)!!.model)
        val anthropic = AppSettings(apiKeys = mapOf(Provider.ANTHROPIC to "a", Provider.GOOGLE to "g"))
        assertEquals("claude-opus-5-5", Router.resolve(assistant, anthropic)!!.model)
    }

    @Test
    fun videoBotsNeedPoe() {
        val veo = BotCatalog.officialById("veo-3.1")!!
        assertNull(Router.resolve(veo, AppSettings(apiKeys = mapOf(Provider.OPENROUTER to "x"))))
        assertEquals(Provider.POE, Router.resolve(veo, AppSettings(apiKeys = mapOf(Provider.POE to "p")))!!.provider)
    }

    @Test
    fun catalogIdsAndNamesAreUnique() {
        val ids = BotCatalog.official.map { it.id }
        assertEquals(ids.size, ids.toSet().size)
        val names = BotCatalog.official.map { it.name.lowercase() }
        assertEquals(names.size, names.toSet().size)
    }
}

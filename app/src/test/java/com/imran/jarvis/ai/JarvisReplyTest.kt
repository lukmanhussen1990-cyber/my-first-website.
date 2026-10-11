package com.imran.jarvis.ai

import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Test

class JarvisReplyTest {

    @Test
    fun `clean JSON is read as is`() {
        val r = JarvisReply.parse("""{"reply": "Opening YouTube.", "action": "open_app", "target": "YouTube"}""")
        assertEquals("Opening YouTube.", r.reply)
        assertEquals(JarvisAction.OPEN_APP, r.action)
        assertEquals("YouTube", r.target)
    }

    @Test
    fun `code fences around the JSON are removed`() {
        val r = JarvisReply.parse("```json\n{\"reply\":\"Hi\",\"action\":\"none\",\"target\":\"\"}\n```")
        assertEquals("Hi", r.reply)
        assertEquals(JarvisAction.NONE, r.action)
    }

    @Test
    fun `text before and after the JSON is ignored`() {
        val r = JarvisReply.parse("Sure! Here you go: {\"reply\":\"Done\",\"action\":\"flashlight_on\",\"target\":\"\"} Hope that helps.")
        assertEquals("Done", r.reply)
        assertEquals(JarvisAction.FLASHLIGHT_ON, r.action)
    }

    @Test
    fun `braces inside the reply text do not confuse the parser`() {
        val r = JarvisReply.parse("""note {"reply":"Use {curly} braces","action":"none","target":""} end""")
        assertEquals("Use {curly} braces", r.reply)
    }

    @Test
    fun `json null becomes empty text, never the word null`() {
        val r = JarvisReply.parse("""{"reply":"Okay","action":"none","target":null}""")
        assertEquals("", r.target)
    }

    @Test
    fun `numbers in target are accepted`() {
        val r = JarvisReply.parse("""{"reply":"Timer","action":"set_timer","target":300}""")
        assertEquals(JarvisAction.SET_TIMER, r.action)
        assertEquals("300", r.target)
    }

    @Test
    fun `unknown action becomes none and keeps the reply`() {
        val r = JarvisReply.parse("""{"reply":"Hello","action":"launch_rocket","target":"moon"}""")
        assertEquals(JarvisAction.NONE, r.action)
        assertEquals("Hello", r.reply)
    }

    @Test
    fun `action names are forgiving about case and spaces`() {
        assertEquals(JarvisAction.OPEN_WIFI, JarvisAction.fromId(" Open Wifi "))
        assertEquals(JarvisAction.YOUTUBE_SEARCH, JarvisAction.fromId("YOUTUBE_SEARCH"))
        assertEquals(JarvisAction.READ_NOTIFICATIONS, JarvisAction.fromId("read-notifications"))
        assertEquals(JarvisAction.FLASHLIGHT_OFF, JarvisAction.fromId("torch_off"))
        assertEquals(JarvisAction.NONE, JarvisAction.fromId(null))
    }

    @Test
    fun `every action id round-trips`() {
        JarvisAction.entries.forEach { assertEquals(it, JarvisAction.fromId(it.id)) }
    }

    @Test
    fun `Devanagari text survives`() {
        val r = JarvisReply.parse("""{"reply":"यूट्यूब खोल रहा हूँ।","action":"open_app","target":"YouTube"}""")
        assertEquals("यूट्यूब खोल रहा हूँ।", r.reply)
    }

    @Test
    fun `broken JSON still gives the spoken text`() {
        val r = JarvisReply.parse("""{"reply": "I am fine, thanks", "action": "none", "target": """)
        assertEquals("I am fine, thanks", r.reply)
        assertEquals(JarvisAction.NONE, r.action)
    }

    @Test
    fun `plain text becomes the reply with no action`() {
        val r = JarvisReply.parse("Sorry, I could not do that.")
        assertEquals("Sorry, I could not do that.", r.reply)
        assertEquals(JarvisAction.NONE, r.action)
    }

    @Test
    fun `empty answer does not crash`() {
        assertEquals("", JarvisReply.parse("").reply)
        assertEquals("", JarvisReply.parse("   ").reply)
    }

    @Test
    fun `history json can be read back`() {
        val original = JarvisReply("Calling Rahul", JarvisAction.CALL, "Rahul")
        val again = JarvisReply.parse(original.toHistoryJson())
        assertEquals(original, again)
        assertEquals("call", JSONObject(original.toHistoryJson()).getString("action"))
    }
}

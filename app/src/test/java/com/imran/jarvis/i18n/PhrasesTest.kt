package com.imran.jarvis.i18n

import com.imran.jarvis.ai.AiException
import com.imran.jarvis.ai.JarvisAction
import com.imran.jarvis.ai.JarvisReply
import com.imran.jarvis.data.AppLanguage
import java.time.LocalDate
import java.time.LocalTime
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class PhrasesTest {

    private val en = Phrases.forLanguage(AppLanguage.ENGLISH)
    private val hi = Phrases.forLanguage(AppLanguage.HINDI)

    @Test
    fun `english time and date`() {
        assertEquals("It's 4:35 PM.", en.timeNow(LocalTime.of(16, 35)))
        assertEquals("It's 12:00 AM.", en.timeNow(LocalTime.of(0, 0)))
        assertEquals("Today is Sunday, 11 October 2026.", en.dateToday(LocalDate.of(2026, 10, 11)))
    }

    @Test
    fun `hindi time names the part of the day`() {
        assertEquals("अभी शाम के 4 बजकर 35 मिनट हुए हैं।", hi.timeNow(LocalTime.of(16, 35)))
        assertEquals("अभी सुबह के 7 बजे हैं।", hi.timeNow(LocalTime.of(7, 0)))
        assertEquals("अभी दोपहर के 12 बजकर 5 मिनट हुए हैं।", hi.timeNow(LocalTime.of(12, 5)))
        assertEquals("अभी रात के 12 बजे हैं।", hi.timeNow(LocalTime.of(0, 0)))
        assertEquals("अभी रात के 11 बजकर 30 मिनट हुए हैं।", hi.timeNow(LocalTime.of(23, 30)))
    }

    @Test
    fun `hindi date`() {
        assertEquals("आज रविवार, 11 अक्टूबर 2026 है।", hi.dateToday(LocalDate.of(2026, 10, 11)))
        assertEquals("आज सोमवार, 1 जनवरी 2024 है।", hi.dateToday(LocalDate.of(2024, 1, 1)))
    }

    @Test
    fun `battery`() {
        assertEquals("Your battery is at 78 percent and it's charging.", en.battery(78, true))
        assertEquals("Your battery is at 78 percent.", en.battery(78, false))
        assertEquals("बैटरी 78 प्रतिशत है और फ़ोन चार्ज हो रहा है।", hi.battery(78, true))
        assertEquals("बैटरी 78 प्रतिशत है।", hi.battery(78, false))
    }

    @Test
    fun `every AI error has a friendly sentence in both languages`() {
        val errors = listOf(
            AiException.NoApiKey(), AiException.NoInternet(), AiException.Timeout(), AiException.InvalidApiKey("x"),
            AiException.PermissionDenied("x"), AiException.ModelNotFound("m", "x"), AiException.RateLimited("x"),
            AiException.QuotaOrBilling("x"), AiException.ServerError(500, "x"), AiException.Blocked("x"),
            AiException.EmptyReply(), AiException.BadRequest(400, "x"),
        )
        for (e in errors) {
            assertTrue(en.forAiError(e).isNotBlank())
            assertTrue(hi.forAiError(e).isNotBlank())
        }
        assertTrue(en.forAiError(AiException.NoInternet()).contains("internet"))
        assertTrue(en.forAiError(AiException.InvalidApiKey()).contains("API key"))
        assertTrue(hi.forAiError(AiException.ModelNotFound("gpt-9", "")).contains("gpt-9"))
    }

    @Test
    fun `notifications are read out in a natural way`() {
        val items = listOf(
            NotificationLine("WhatsApp", "Rahul", "Kal milte hain"),
            NotificationLine("Gmail", "Bank", ""),
        )
        assertEquals("You have 2 notifications. From WhatsApp: Rahul, Kal milte hain. From Gmail: Bank.", en.notificationsSummary(items))
        assertTrue(en.notificationsSummary(items.take(1)).startsWith("You have 1 notification."))
        assertTrue(hi.notificationsSummary(items).startsWith("आपके पास 2 नोटिफ़िकेशन हैं।"))
    }

    @Test
    fun `default replies exist for every action that opens something`() {
        val withTarget = listOf(
            JarvisAction.OPEN_APP, JarvisAction.CALL, JarvisAction.WHATSAPP, JarvisAction.YOUTUBE_SEARCH,
            JarvisAction.GOOGLE_SEARCH, JarvisAction.FLASHLIGHT_ON, JarvisAction.FLASHLIGHT_OFF, JarvisAction.SET_ALARM,
            JarvisAction.SET_TIMER, JarvisAction.VOLUME_UP, JarvisAction.VOLUME_DOWN, JarvisAction.OPEN_WIFI,
            JarvisAction.OPEN_BLUETOOTH,
        )
        for (action in withTarget) {
            assertTrue("$action en", en.defaultReply(JarvisReply("", action, "Rahul")).isNotBlank())
            assertTrue("$action hi", hi.defaultReply(JarvisReply("", action, "Rahul")).isNotBlank())
        }
        assertEquals("Calling Rahul.", en.defaultReply(JarvisReply("", JarvisAction.CALL, "Rahul")))
        assertEquals("", en.defaultReply(JarvisReply("", JarvisAction.NONE, "")))
        // A WhatsApp message after the pipe is not read out as part of the name.
        assertEquals("Opening WhatsApp chat with Rahul.", en.defaultReply(JarvisReply("", JarvisAction.WHATSAPP, "Rahul | hello")))
    }

    @Test
    fun `names are quoted in messages`() {
        assertTrue(en.contactNotFound("Rahul").contains("\"Rahul\""))
        assertTrue(en.contactAmbiguous(listOf("Rahul Sharma", "Rahul Verma")).contains("Rahul Sharma, Rahul Verma"))
        assertFalse(en.appNotFound("Foo").contains("null"))
    }
}

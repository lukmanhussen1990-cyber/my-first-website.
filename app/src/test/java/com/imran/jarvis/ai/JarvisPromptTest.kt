package com.imran.jarvis.ai

import com.imran.jarvis.data.AiProvider
import com.imran.jarvis.data.AppLanguage
import com.imran.jarvis.data.AppSettings
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class JarvisPromptTest {

    @Test
    fun `the prompt starts with the exact wording that was requested`() {
        val prompt = JarvisPrompt.build(AppLanguage.ENGLISH)
        assertTrue(
            prompt.startsWith(
                "You are JARVIS, a smart and friendly voice assistant made by Imran. " +
                    "Reply short (1–3 sentences) in simple Hindi/Hinglish if language is Hindi, " +
                    "or simple English if English. Always reply ONLY in this JSON format: ",
            ),
        )
        assertTrue(
            prompt.contains(
                "\"action\": \"none|open_app|call|whatsapp|youtube_search|google_search|flashlight_on|flashlight_off|" +
                    "set_alarm|set_timer|volume_up|volume_down|open_wifi|open_bluetooth|time|battery\"",
            ),
        )
    }

    @Test
    fun `the prompt names the language setting`() {
        assertTrue(JarvisPrompt.build(AppLanguage.HINDI).contains("Current language setting: Hindi."))
        assertTrue(JarvisPrompt.build(AppLanguage.ENGLISH).contains("Current language setting: English."))
    }

    @Test
    fun `every action the app understands is explained to the AI`() {
        val prompt = JarvisPrompt.build(AppLanguage.HINDI)
        JarvisAction.entries.filter { it != JarvisAction.NONE }.forEach {
            assertTrue("missing ${it.id}", prompt.contains(it.id))
        }
    }

    @Test
    fun `the prompt has no leftover template markers`() {
        val prompt = JarvisPrompt.build(AppLanguage.ENGLISH)
        assertFalse(prompt.contains("\$USER_NAME"))
        assertTrue(prompt.contains("The user's name is Imran."))
    }

    @Test
    fun `default models and the user's own choice`() {
        val settings = AppSettings()
        assertEquals("gemini-3.5-flash-lite", settings.model)
        assertEquals("gpt-6-luna", settings.modelFor(AiProvider.OPENAI))
        assertEquals("claude-haiku-5-5", settings.modelFor(AiProvider.CLAUDE))

        val custom = settings.copy(customModels = mapOf(AiProvider.CLAUDE to " claude-opus-5-5 ", AiProvider.OPENAI to " "))
        assertEquals("claude-opus-5-5", custom.modelFor(AiProvider.CLAUDE))
        assertEquals("gpt-6-luna", custom.modelFor(AiProvider.OPENAI)) // blank means default
    }

    @Test
    fun `always on is off until the user switches it on`() {
        assertFalse(AppSettings().alwaysOn)
        assertTrue(AppSettings().copy(alwaysOn = true).alwaysOn)
    }

    @Test
    fun `every provider has presets and the first one is the default`() {
        AiProvider.entries.forEach {
            assertEquals(AiModels.defaultFor(it), AiModels.presetsFor(it).first().id)
        }
    }
}

package com.imran.jarvis.data

import com.imran.jarvis.ai.AiModels

/** The AI companies JARVIS can talk to. The user picks one in Settings. */
enum class AiProvider(val displayName: String) {
    GEMINI("Gemini"),
    OPENAI("OpenAI"),
    CLAUDE("Claude"),
}

/** Language used for listening (speech-to-text), speaking (text-to-speech) and AI replies. */
enum class AppLanguage(val displayName: String, val speechTag: String) {
    HINDI("Hindi", "hi-IN"),
    ENGLISH("English", "en-IN"),
}

enum class VoiceGender(val displayName: String) {
    MALE("Male"),
    FEMALE("Female"),
}

/** Everything the user can change in Settings, except the API keys (those are encrypted separately). */
data class AppSettings(
    val provider: AiProvider = AiProvider.GEMINI,
    val language: AppLanguage = AppLanguage.HINDI,
    val voice: VoiceGender = VoiceGender.MALE,
    /** Model names typed or picked by the user. A missing/blank entry means "use the built-in default". */
    val customModels: Map<AiProvider, String> = emptyMap(),
    val callsEnabled: Boolean = true,
    val notificationsEnabled: Boolean = true,
    val openAppsEnabled: Boolean = true,
) {
    fun modelFor(provider: AiProvider): String =
        customModels[provider]?.trim()?.takeIf { it.isNotEmpty() } ?: AiModels.defaultFor(provider)

    val model: String get() = modelFor(provider)
}

enum class Role { USER, ASSISTANT }

data class ChatMessage(
    val id: Long,
    val role: Role,
    /** Text shown in the chat bubble. */
    val text: String,
    /** Text sent back to the AI as history for this message (for JARVIS: the JSON it produced). */
    val historyText: String = text,
    /** Error bubbles are shown to the user but never sent to the AI as history. */
    val isError: Boolean = false,
)

/** What JARVIS is doing right now. Drives the orb animation and the labels. */
enum class Phase { Idle, Listening, Thinking, Speaking }

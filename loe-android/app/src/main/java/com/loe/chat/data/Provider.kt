package com.loe.chat.data

/**
 * An AI provider the user can connect with their own API key.
 * Every provider except Anthropic speaks the OpenAI-compatible Chat Completions protocol.
 */
enum class Provider(
    val id: String,
    val displayName: String,
    val baseUrl: String,
    val keyUrl: String,
    val keyHint: String,
    val blurb: String,
) {
    OPENROUTER(
        id = "openrouter",
        displayName = "OpenRouter",
        baseUrl = "https://openrouter.ai/api/v1",
        keyUrl = "https://openrouter.ai/keys",
        keyHint = "sk-or-…",
        blurb = "One key for every bot on Loe: GPT, Claude, Gemini, Grok, DeepSeek, Perplexity and image bots.",
    ),
    ANTHROPIC(
        id = "anthropic",
        displayName = "Anthropic",
        baseUrl = "https://api.anthropic.com",
        keyUrl = "https://console.anthropic.com/settings/keys",
        keyHint = "sk-ant-…",
        blurb = "Claude bots (Opus, Fable, Sonnet, Haiku).",
    ),
    OPENAI(
        id = "openai",
        displayName = "OpenAI",
        baseUrl = "https://api.openai.com/v1",
        keyUrl = "https://platform.openai.com/api-keys",
        keyHint = "sk-…",
        blurb = "GPT bots and GPT-Image.",
    ),
    GOOGLE(
        id = "google",
        displayName = "Google Gemini",
        baseUrl = "https://generativelanguage.googleapis.com/v1beta/openai",
        keyUrl = "https://aistudio.google.com/apikey",
        keyHint = "AIza…",
        blurb = "Gemini and Nano-Banana bots. Google AI Studio has a free tier.",
    ),
    XAI(
        id = "xai",
        displayName = "xAI",
        baseUrl = "https://api.x.ai/v1",
        keyUrl = "https://console.x.ai",
        keyHint = "xai-…",
        blurb = "Grok bots.",
    ),
    DEEPSEEK(
        id = "deepseek",
        displayName = "DeepSeek",
        baseUrl = "https://api.deepseek.com/v1",
        keyUrl = "https://platform.deepseek.com/api_keys",
        keyHint = "sk-…",
        blurb = "DeepSeek bots.",
    ),
    POE(
        id = "poe",
        displayName = "Poe API",
        baseUrl = "https://api.poe.com/v1",
        keyUrl = "https://poe.com/api_key",
        keyHint = "Poe API key",
        blurb = "Use your Poe points with every bot, including video bots.",
    );

    companion object {
        fun fromId(id: String?): Provider? = entries.firstOrNull { it.id == id }
    }
}

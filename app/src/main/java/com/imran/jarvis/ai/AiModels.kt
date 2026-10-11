package com.imran.jarvis.ai

import com.imran.jarvis.data.AiProvider

/**
 * Which AI model each provider uses.
 *
 * JARVIS is a voice assistant, so every default is the provider's FAST and CHEAP tier: answers come
 * back quickly and cost a fraction of a cent. The user can pick a smarter model (or type any model
 * name) in Settings > AI Provider > Model - nothing here needs to be edited to do that.
 *
 * Model names change over time. If a provider retires one, Settings is where to fix it.
 */
object AiModels {

    data class Preset(val id: String, val label: String)

    fun defaultFor(provider: AiProvider): String = when (provider) {
        AiProvider.GEMINI -> "gemini-3.5-flash-lite"
        AiProvider.OPENAI -> "gpt-6-luna"
        AiProvider.CLAUDE -> "claude-haiku-5-5"
    }

    /** Suggestions shown in the Model drop-down in Settings (the first one is the default). */
    fun presetsFor(provider: AiProvider): List<Preset> = when (provider) {
        AiProvider.GEMINI -> listOf(
            Preset("gemini-3.5-flash-lite", "Gemini 3.5 Flash-Lite  -  fastest"),
            Preset("gemini-3.8-flash", "Gemini 3.8 Flash  -  smarter"),
        )
        AiProvider.OPENAI -> listOf(
            Preset("gpt-6-luna", "GPT-6 Luna  -  fastest"),
            Preset("gpt-6.1-sol", "GPT-6.1 Sol  -  balanced"),
            Preset("gpt-6-astra", "GPT-6 Astra  -  smartest"),
        )
        AiProvider.CLAUDE -> listOf(
            Preset("claude-haiku-5-5", "Claude Haiku 5.5  -  fastest"),
            Preset("claude-sonnet-5-5", "Claude Sonnet 5.5  -  balanced"),
            Preset("claude-opus-5-5", "Claude Opus 5.5  -  smartest"),
        )
    }
}

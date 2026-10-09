package com.loe.chat.data

enum class BotCategory(val label: String) {
    OFFICIAL("Official"),
    BUDGET("Budget"),
    SEARCH("Search"),
    IMAGE("Image"),
    VIDEO("Video"),
    CODING("Coding"),
    WRITING("Writing"),
    REASONING("Reasoning"),
    YOURS("Your bots"),
}

enum class BotKind { TEXT, IMAGE, VIDEO }

/** Visual style of a bot's rounded-square avatar (drawn in code, see ui/components/BotAvatar.kt). */
enum class AvatarStyle {
    LOE, LOE_SEARCH,
    OPENAI_SPACE, OPENAI_SUNSET, OPENAI_BLOSSOM, OPENAI_LAGOON, OPENAI_OCEAN, OPENAI_AURORA, OPENAI_IMAGE,
    CLAUDE_DARK, CLAUDE_CREAM, CLAUDE_WARM, CLAUDE_LIGHT,
    GEMINI_OUTLINE, GEMINI_FILLED, GEMINI_BANANA, GEMINI_BANANA_PRO, GEMINI_VEO, GEMINI_VEO_FAST,
    GROK, DEEPSEEK, DEEPSEEK_PRO, PERPLEXITY, PERPLEXITY_PRO,
    CUSTOM,
}

data class Bot(
    val id: String,
    val name: String,
    /** Creator handle without the @, e.g. "openai". */
    val creator: String,
    val description: String,
    val avatar: AvatarStyle,
    val categories: Set<BotCategory>,
    val kind: BotKind = BotKind.TEXT,
    /** Provider that serves this model directly with its own key. */
    val nativeProvider: Provider? = null,
    val nativeModel: String? = null,
    val openRouterModel: String? = null,
    val poeModel: String? = null,
    /** Compute points charged per message (a local spending guard, editable in Settings). */
    val points: Int,
    val contextLabel: String = "",
    val official: Boolean = true,
    /** Whether the model can read attached images. */
    val vision: Boolean = true,
    // Fields used by bots the user creates.
    val systemPrompt: String? = null,
    val greeting: String? = null,
    val baseBotId: String? = null,
    val color: Long = 0xFF5C5ADD,
    val emoji: String? = null,
    val createdAt: Long = 0,
) {
    val isCustom: Boolean get() = baseBotId != null
    val handle: String get() = "@$creator"
}

object Creators {
    private val names = mapOf(
        "loe" to "Loe",
        "openai" to "OpenAI",
        "anthropic" to "Anthropic",
        "google" to "Google",
        "xai" to "xAI",
        "deepseek" to "DeepSeek",
        "perplexity" to "Perplexity",
    )

    fun displayName(handle: String): String = names[handle] ?: handle

    val officialHandles: List<String> = names.keys.toList()
}

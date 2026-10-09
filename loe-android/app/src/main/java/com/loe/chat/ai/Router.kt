package com.loe.chat.ai

import com.loe.chat.data.AppSettings
import com.loe.chat.data.Bot
import com.loe.chat.data.BotCatalog
import com.loe.chat.data.Provider

/** Picks the provider, model and key a bot's message goes to, based on the keys the user connected. */
object Router {

    /** The official bot a custom bot is built on (or the bot itself). */
    fun baseOf(bot: Bot): Bot = bot.baseBotId?.let { BotCatalog.officialById(it) } ?: bot

    /** Every way this bot can be served, in order of preference: native key, OpenRouter, Poe. */
    fun candidates(bot: Bot): List<Pair<Provider, String>> {
        val base = baseOf(bot)
        if (base.id == BotCatalog.ASSISTANT_ID) return BotCatalog.assistantModels
        return buildList {
            if (base.nativeProvider != null && base.nativeModel != null) add(base.nativeProvider to base.nativeModel)
            base.openRouterModel?.let { add(Provider.OPENROUTER to it) }
            base.poeModel?.let { add(Provider.POE to it) }
        }
    }

    fun resolve(bot: Bot, settings: AppSettings): Route? {
        val base = baseOf(bot)
        for ((provider, model) in candidates(base)) {
            val key = settings.key(provider) ?: continue
            return Route(provider, settings.modelOverride(base.id, provider) ?: model, key)
        }
        return null
    }

    /** Providers that could serve this bot, used in "connect a key" hints. */
    fun providersFor(bot: Bot): List<Provider> = candidates(bot).map { it.first }.distinct()

    /** A cheap model on the same provider for naming chats, or null to name chats locally. */
    fun titleRoute(route: Route): Route? = BotCatalog.titleModels[route.provider]?.let { route.copy(model = it) }
}

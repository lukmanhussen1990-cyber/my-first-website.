package com.loe.chat.engine

import com.loe.chat.data.Bot
import com.loe.chat.data.BotCatalog
import com.loe.chat.data.ChatRepository
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn

/** Official bots plus the ones the user created. */
class BotRegistry(private val repo: ChatRepository, scope: CoroutineScope) {

    val customBots: StateFlow<List<Bot>> =
        repo.customBots().stateIn(scope, SharingStarted.Eagerly, emptyList())

    val all: StateFlow<List<Bot>> =
        customBots.map { BotCatalog.official + it }
            .stateIn(scope, SharingStarted.Eagerly, BotCatalog.official)

    /** Finds a bot by id; reads the database directly if custom bots haven't loaded yet. */
    fun get(id: String): Bot? =
        BotCatalog.officialById(id)
            ?: customBots.value.firstOrNull { it.id == id }
            ?: repo.customBotsNow().firstOrNull { it.id == id }

    fun getOrAssistant(id: String?): Bot = id?.let { get(it) } ?: BotCatalog.assistant

    fun byName(name: String): Bot? = all.value.firstOrNull { it.name.equals(name, ignoreCase = true) }
}

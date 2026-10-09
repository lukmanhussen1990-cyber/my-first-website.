package com.loe.chat.ai

import com.loe.chat.data.Provider
import java.util.concurrent.ConcurrentHashMap

/** Base URLs per provider. Tests point these at a local mock server; the app never changes them. */
object Endpoints {
    private val overrides = ConcurrentHashMap<Provider, String>()

    fun of(provider: Provider): String = overrides[provider] ?: provider.baseUrl

    fun override(provider: Provider, url: String?) {
        if (url == null) overrides.remove(provider) else overrides[provider] = url.trimEnd('/')
    }

    fun reset() = overrides.clear()
}

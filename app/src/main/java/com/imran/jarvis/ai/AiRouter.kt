package com.imran.jarvis.ai

import android.content.Context
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import com.imran.jarvis.data.AiProvider

/** Picks the right client for the provider chosen in Settings. */
class AiRouter(private val clients: Map<AiProvider, AiClient>) {

    suspend fun chat(provider: AiProvider, request: AiRequest): String =
        (clients[provider] ?: error("No client for $provider")).chat(request)

    companion object {
        fun create(http: HttpJson = HttpJson()): AiRouter = AiRouter(
            mapOf(
                AiProvider.GEMINI to GeminiClient(http),
                AiProvider.OPENAI to OpenAiClient(http),
                AiProvider.CLAUDE to ClaudeClient(http),
            ),
        )
    }
}

object NetworkChecker {
    /** Quick check before talking to the internet. When in doubt it says "online" and lets the request decide. */
    fun isOnline(context: Context): Boolean {
        val manager = context.getSystemService(ConnectivityManager::class.java) ?: return true
        val network = manager.activeNetwork ?: return false
        val capabilities = manager.getNetworkCapabilities(network) ?: return false
        return capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
    }
}

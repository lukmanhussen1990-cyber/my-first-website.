package com.loe.chat.ai

import com.loe.chat.data.BotKind
import com.loe.chat.data.ErrorCodes
import com.loe.chat.data.Provider

/** Which provider, model and key a request goes to. */
data class Route(val provider: Provider, val model: String, val apiKey: String) {
    override fun toString(): String = "Route(${provider.id}, $model)" // never print the key
}

class ImagePart(val mime: String, val base64: String)

data class ChatTurn(val fromUser: Boolean, val text: String, val images: List<ImagePart> = emptyList())

enum class Purpose { CHAT, TITLE }

data class ChatRequest(
    val route: Route,
    val system: String?,
    val turns: List<ChatTurn>,
    val kind: BotKind = BotKind.TEXT,
    val purpose: Purpose = Purpose.CHAT,
)

sealed interface StreamEvent {
    data class TextDelta(val text: String) : StreamEvent
    /** The model is reasoning before it answers. */
    data object Thinking : StreamEvent
    class ImageOut(val bytes: ByteArray, val mime: String) : StreamEvent
    data class Finished(val refused: Boolean = false, val truncated: Boolean = false) : StreamEvent
}

class ApiException(
    val status: Int,
    override val message: String,
    val code: String = ErrorCodes.OTHER,
) : Exception(message)

internal object ApiErrors {
    fun friendly(provider: Provider, status: Int, apiMessage: String?, model: String): ApiException {
        val detail = apiMessage?.trim()?.takeIf { it.isNotEmpty() }?.take(300)
        return when (status) {
            401 -> ApiException(
                status,
                "Your ${provider.displayName} API key was rejected. Check it in Settings → API keys.",
                ErrorCodes.AUTH,
            )
            402 -> ApiException(
                status,
                "Your ${provider.displayName} account is out of credits. Add credits with the provider, then try again.",
                ErrorCodes.AUTH,
            )
            403 -> ApiException(
                status,
                "Your ${provider.displayName} key can't use this bot." + (detail?.let { " ($it)" } ?: ""),
                ErrorCodes.AUTH,
            )
            404 -> ApiException(
                status,
                "${provider.displayName} couldn't find the model \"$model\". You can change the model in the bot's details.",
            )
            429 -> ApiException(status, "Too many requests to ${provider.displayName}. Wait a moment and try again." + (detail?.let { "\n\n$it" } ?: ""))
            500, 502, 503, 504, 529 -> ApiException(status, "${provider.displayName} is busy right now. Please try again.")
            else -> ApiException(status, detail ?: "${provider.displayName} returned an error ($status).")
        }
    }
}

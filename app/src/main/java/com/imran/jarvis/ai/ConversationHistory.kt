package com.imran.jarvis.ai

import com.imran.jarvis.data.ChatMessage
import com.imran.jarvis.data.Role

/** One message as the AI providers want it: who said it, and what. */
data class AiTurn(val role: Role, val text: String)

/** Prepares the chat history that is sent along with every question. */
object ConversationHistory {

    /** JARVIS remembers the last 10 messages of the conversation. */
    const val MAX_MESSAGES = 10

    /**
     * Takes the visible chat and returns what the AI should see:
     * - the last [MAX_MESSAGES] messages (error bubbles are skipped),
     * - starting with a user message (some providers reject a conversation that starts with the assistant),
     * - with consecutive messages from the same side merged (some providers require strict alternation).
     */
    fun buildTurns(messages: List<ChatMessage>): List<AiTurn> {
        val recent = messages
            .filter { !it.isError && it.historyText.isNotBlank() }
            .takeLast(MAX_MESSAGES)
            .dropWhile { it.role != Role.USER }

        val merged = ArrayList<AiTurn>(recent.size)
        for (message in recent) {
            val last = merged.lastOrNull()
            if (last != null && last.role == message.role) {
                merged[merged.lastIndex] = last.copy(text = last.text + "\n" + message.historyText)
            } else {
                merged += AiTurn(message.role, message.historyText)
            }
        }
        return merged
    }
}

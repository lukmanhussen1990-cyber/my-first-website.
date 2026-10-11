package com.imran.jarvis.ai

import com.imran.jarvis.data.ChatMessage
import com.imran.jarvis.data.Role
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class ConversationHistoryTest {

    private fun user(id: Long, text: String) = ChatMessage(id, Role.USER, text)
    private fun bot(id: Long, text: String, error: Boolean = false) =
        ChatMessage(id, Role.ASSISTANT, text, historyText = "{\"reply\":\"$text\"}", isError = error)

    @Test
    fun `keeps only the last 10 messages`() {
        val chat = (1L..30L).map { if (it % 2 == 1L) user(it, "q$it") else bot(it, "a$it") }
        val turns = ConversationHistory.buildTurns(chat)
        assertEquals(10, turns.size)
        assertEquals("q21", turns.first().text)
        assertEquals(Role.USER, turns.first().role)
    }

    @Test
    fun `starts with a user message even when the cut lands on JARVIS`() {
        // 11 messages: the last 10 would start with an assistant message, which is dropped.
        val chat = (1L..11L).map { if (it % 2 == 1L) user(it, "q$it") else bot(it, "a$it") }
        val turns = ConversationHistory.buildTurns(chat)
        assertEquals(Role.USER, turns.first().role)
        assertEquals(Role.USER, turns.last().role)
    }

    @Test
    fun `error bubbles are not sent to the AI`() {
        val chat = listOf(user(1, "hello"), bot(2, "no internet", error = true), user(3, "hello again"))
        val turns = ConversationHistory.buildTurns(chat)
        // The two user messages end up together, so the roles still alternate properly.
        assertEquals(1, turns.size)
        assertEquals("hello\nhello again", turns.single().text)
    }

    @Test
    fun `consecutive messages from the same side are merged`() {
        val chat = listOf(user(1, "a"), user(2, "b"), bot(3, "x"), bot(4, "y"), user(5, "c"))
        val turns = ConversationHistory.buildTurns(chat)
        assertEquals(listOf(Role.USER, Role.ASSISTANT, Role.USER), turns.map { it.role })
    }

    @Test
    fun `assistant history is the JSON, not the display text`() {
        val chat = listOf(user(1, "time?"), bot(2, "It is 5 PM"), user(3, "thanks"))
        val turns = ConversationHistory.buildTurns(chat)
        assertTrue(turns[1].text.startsWith("{"))
    }

    @Test
    fun `empty chat gives empty history`() {
        assertTrue(ConversationHistory.buildTurns(emptyList()).isEmpty())
    }
}

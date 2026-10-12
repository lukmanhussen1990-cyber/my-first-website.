package com.weplay.guesserai.data.ai

import com.fasterxml.jackson.databind.JsonNode
import com.fasterxml.jackson.databind.ObjectMapper
import com.weplay.guesserai.domain.FrameAnalysis
import com.weplay.guesserai.domain.Guess
import com.weplay.guesserai.domain.HintPattern
import com.weplay.guesserai.domain.PartialAnalysis
import com.weplay.guesserai.domain.ScreenState
import com.weplay.guesserai.domain.VisionException

/**
 * Tolerant parser for the model's JSON. Accepts code fences, leading prose, confidence as
 * "95", "95%", 0.95 or 95, and the legacy {guesses:[...]}-only shape. [parsePartial] reads
 * whatever is complete in a reply that is still streaming.
 */
object AnalysisParser {
    private val mapper = ObjectMapper()
    private const val SEEN_MAX_CHARS = 100
    private const val MAX_HINT_WORDS = 10
    private const val MAX_HINT_LETTERS = 60

    fun parse(text: String, modelUsed: String = ""): FrameAnalysis {
        val json = extractJsonObject(text) ?: throw VisionException.BadResponse("AI reply had no JSON")
        val root = runCatching { mapper.readTree(json) }.getOrElse {
            throw VisionException.BadResponse("AI reply was not valid JSON", it)
        }
        val guesses = root.path("guesses").mapNotNull(::guessOf)
        val box = boxOf(root.path("canvas_box"), minHeight = 0.1f)
        val hintBox = boxOf(root.path("hint_box"), minHeight = 0.01f)

        val state = screenStateOf(root.path("screen_state").asText(""))
            ?: if (root.path("is_drawing_game").asBoolean(true)) ScreenState.GUESSING else ScreenState.NOT_GAME
        return FrameAnalysis(
            isDrawingGame = state != ScreenState.NOT_GAME,
            screenState = state,
            revealedAnswer = root.path("revealed_answer").asText("").trim(),
            seen = seenOf(root.path("seen")),
            canvasEmpty = root.path("canvas_empty").asBoolean(false),
            detectedObject = root.path("detected_object").asText(guesses.firstOrNull()?.answer.orEmpty()),
            category = root.path("category").asText(""),
            emoji = root.path("emoji").asText("").take(8),
            hint = hintOf(root.path("hint")),
            canvasBox = box,
            hintBox = hintBox,
            guesses = guesses.sortedByDescending { it.confidence },
            modelUsed = modelUsed,
        )
    }

    /** Hint and every fully received guess object from an unfinished reply. */
    fun parsePartial(text: String): PartialAnalysis {
        val hint = objectAfterKey(text, "\"hint\"")?.let { runCatching { hintOf(mapper.readTree(it)) }.getOrNull() }
        val guesses = mutableListOf<Guess>()
        val key = text.indexOf("\"guesses\"")
        if (key >= 0) {
            var i = text.indexOf('[', key)
            while (i in 0 until text.length) {
                val next = text.indexOfAny(charArrayOf('{', ']'), i + 1)
                if (next < 0 || text[next] == ']') break
                val end = objectEnd(text, next)
                if (end < 0) break
                runCatching { guessOf(mapper.readTree(text.substring(next, end + 1))) }.getOrNull()?.let(guesses::add)
                i = end
            }
        }
        val state = Regex("\"screen_state\"\\s*:\\s*\"([a-z_]+)\"").find(text)?.groupValues?.get(1)?.let(::screenStateOf)
        return PartialAnalysis(
            hint = hint,
            guesses = guesses,
            isDrawingGame = state?.let { it != ScreenState.NOT_GAME } ?: boolAfterKey(text, "is_drawing_game"),
            canvasEmpty = boolAfterKey(text, "canvas_empty"),
            screenState = state,
        )
    }

    private fun screenStateOf(value: String): ScreenState? = when (value.lowercase()) {
        "guessing" -> ScreenState.GUESSING
        "word_revealed" -> ScreenState.WORD_REVEALED
        "round_over" -> ScreenState.ROUND_OVER
        "not_game" -> ScreenState.NOT_GAME
        else -> null
    }

    /** One short line: endpoints without the schema may ignore the 12-word rule or break it over lines. */
    private fun seenOf(node: JsonNode): String =
        node.asText("").replace(Regex("\\s+"), " ").trim().take(SEEN_MAX_CHARS)

    private fun boxOf(node: JsonNode, minHeight: Float): List<Float>? =
        node.map { it.asDouble(-1.0).toFloat() }
            .takeIf { b -> b.size == 4 && b.all { it in 0f..1f } && b[2] - b[0] > 0.1f && b[3] - b[1] > minHeight }

    private fun guessOf(g: JsonNode): Guess? {
        val answer = g.path("answer").asText("").trim()
        return if (answer.isEmpty()) null else Guess(answer, parseConfidence(g.path("confidence")), g.path("reason").asText(""))
    }

    private fun hintOf(node: JsonNode): HintPattern? {
        if (!node.isObject) return null
        val lengths = node.path("word_lengths").mapNotNull { n -> n.asInt(0).takeIf { it > 0 } }
        val words = node.path("word_count").asInt(0).takeIf { it > 0 } ?: lengths.size
        val letters = node.path("letter_count").asInt(0).takeIf { it > 0 } ?: lengths.sum()
        val clue = node.path("clue").asText("").trim().take(40)
        return HintPattern(words, letters, if (lengths.size == words && lengths.sum() == letters) lengths else emptyList(), clue)
            // No game hint is that long: such a reading is noise, and the overlay draws a blank per letter.
            .takeIf { it.isKnown && it.wordCount <= MAX_HINT_WORDS && it.letterCount <= MAX_HINT_LETTERS }
    }

    private fun objectAfterKey(text: String, key: String): String? {
        val k = text.indexOf(key)
        if (k < 0) return null
        val start = text.indexOf('{', k)
        if (start < 0) return null
        val end = objectEnd(text, start)
        return if (end < 0) null else text.substring(start, end + 1)
    }

    private fun boolAfterKey(text: String, key: String): Boolean? =
        Regex("\"$key\"\\s*:\\s*(true|false)").find(text)?.groupValues?.get(1)?.toBoolean()

    fun parseConfidence(node: JsonNode): Int {
        val raw = when {
            node.isNumber -> node.asDouble()
            node.isTextual -> node.asText().replace("%", "").trim().toDoubleOrNull() ?: 0.0
            else -> 0.0
        }
        val pct = if (raw in 0.0..1.0 && raw != 0.0 && !(node.isTextual && node.asText().contains('%'))) raw * 100 else raw
        return pct.toInt().coerceIn(0, 100)
    }

    /** First balanced {...} block in the text, ignoring braces inside strings. */
    fun extractJsonObject(text: String): String? {
        val start = text.indexOf('{')
        if (start < 0) return null
        val end = objectEnd(text, start)
        return if (end < 0) null else text.substring(start, end + 1)
    }

    /** Index of the brace closing the object that opens at [start], or -1 if it is not complete yet. */
    private fun objectEnd(text: String, start: Int): Int {
        var depth = 0
        var inString = false
        var escaped = false
        for (i in start until text.length) {
            val c = text[i]
            if (inString) {
                when {
                    escaped -> escaped = false
                    c == '\\' -> escaped = true
                    c == '"' -> inString = false
                }
                continue
            }
            when (c) {
                '"' -> inString = true
                '{' -> depth++
                '}' -> if (--depth == 0) return i
            }
        }
        return -1
    }
}

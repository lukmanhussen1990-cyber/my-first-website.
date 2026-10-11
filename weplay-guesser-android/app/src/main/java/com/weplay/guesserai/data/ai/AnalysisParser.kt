package com.weplay.guesserai.data.ai

import com.fasterxml.jackson.databind.JsonNode
import com.fasterxml.jackson.databind.ObjectMapper
import com.weplay.guesserai.domain.FrameAnalysis
import com.weplay.guesserai.domain.Guess
import com.weplay.guesserai.domain.HintPattern
import com.weplay.guesserai.domain.VisionException

/**
 * Tolerant parser for the model's JSON. Accepts code fences, leading prose, confidence as
 * "95", "95%", 0.95 or 95, and the legacy {guesses:[...]}-only shape.
 */
object AnalysisParser {
    private val mapper = ObjectMapper()

    fun parse(text: String): FrameAnalysis {
        val json = extractJsonObject(text) ?: throw VisionException.BadResponse("AI reply had no JSON")
        val root = runCatching { mapper.readTree(json) }.getOrElse {
            throw VisionException.BadResponse("AI reply was not valid JSON", it)
        }

        val guesses = root.path("guesses").mapNotNull { g ->
            val answer = g.path("answer").asText("").trim()
            if (answer.isEmpty()) null
            else Guess(answer, parseConfidence(g.path("confidence")), g.path("reason").asText(""))
        }

        val hintNode = root.path("hint")
        val hint = if (hintNode.isObject) {
            val lengths = hintNode.path("word_lengths").mapNotNull { n -> n.asInt(0).takeIf { it > 0 } }
            val words = hintNode.path("word_count").asInt(0).takeIf { it > 0 } ?: lengths.size
            val letters = hintNode.path("letter_count").asInt(0).takeIf { it > 0 } ?: lengths.sum()
            HintPattern(words, letters, if (lengths.size == words && lengths.sum() == letters) lengths else emptyList())
                .takeIf { it.isKnown }
        } else null

        val box = root.path("canvas_box").map { it.asDouble(-1.0).toFloat() }
            .takeIf { b -> b.size == 4 && b.all { it in 0f..1f } && b[2] - b[0] > 0.1f && b[3] - b[1] > 0.1f }

        return FrameAnalysis(
            isDrawingGame = root.path("is_drawing_game").asBoolean(true),
            canvasEmpty = root.path("canvas_empty").asBoolean(false),
            detectedObject = root.path("detected_object").asText(guesses.firstOrNull()?.answer.orEmpty()),
            category = root.path("category").asText(""),
            emoji = root.path("emoji").asText("").take(8),
            hint = hint,
            canvasBox = box,
            guesses = guesses.sortedByDescending { it.confidence },
        )
    }

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
                '}' -> if (--depth == 0) return text.substring(start, i + 1)
            }
        }
        return null
    }
}

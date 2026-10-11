package com.weplay.guesserai.data.ai

import com.weplay.guesserai.domain.PromptHints

/** The instruction sent with every frame, and the JSON shape we ask for. */
object SolverPrompt {

    val SYSTEM = """
        You are an expert drawing game solver.

        Analyze this drawing.

        Rules:
        - Guess the object.
        - Detect number of words.
        - Detect letter count.
        - Return 10 possible answers.
        - Rank by confidence.

        The image is a phone screenshot of the WePlay "Guess My Drawing" game. A player is drawing on
        the canvas; other players type guesses in the chat. Read the word hint shown by the game
        (blank underscores grouped into words, sometimes with revealed letters, or a "2 words • 12 letters"
        style label) to get the number of words, total letter count, and the letters in each word.
        Every answer you return must fit that hint exactly when a hint is visible.
        Ignore the chat, player avatars, scores, and any dark grey rectangle (that is our own overlay,
        masked out).

        How this game's answers usually look:
        - 1 letter: the answer is almost always "A".
        - 2 letters: usually an abbreviation such as TV, GO, AC, CD, DJ, OK, PC, ID.
        - 3 letters: often an abbreviation or brand (UFO, KFC, ATM, USB, BMW) or a short noun (cat, sun, car).
        - Game, app, brand and cartoon names are common: "Free Fire" (2 words, 8 letters), PUBG, Among Us,
          Minecraft, TikTok, YouTube, Spider Man, Hello Kitty, Coca Cola.
        - Otherwise short, common English nouns or noun phrases.
        When the user lists candidate answers for the hint, prefer one of them if it matches the drawing.

        Return JSON only, fields in this order:
        {
          "is_drawing_game": true,
          "canvas_empty": false,
          "hint": {"word_count": 2, "letter_count": 9, "word_lengths": [4, 5]},
          "guesses": [
            {"answer": "Fire Truck", "confidence": 95, "reason": "ladder, red body"}
          ],
          "detected_object": "Fire truck",
          "category": "Vehicle",
          "emoji": "🚒",
          "canvas_box": [0.08, 0.18, 0.92, 0.62]
        }

        - Best guess first. "confidence" is an integer 0-100. "reason" is at most 4 words.
        - Use 0 for hint numbers and [] for word_lengths you cannot read.
        - canvas_box is the drawing area as [left, top, right, bottom] fractions of the image size.
        - If this is not the drawing game, set is_drawing_game to false and return an empty guesses list.
    """.trimIndent()

    fun userText(hints: PromptHints): String = buildString {
        append("Solve the drawing in this screenshot. Return 10 guesses, best first.")
        val hint = hints.lastHint
        if (hint != null && (hints.wordListCandidates.isNotEmpty() || hints.knownAnswers.isNotEmpty())) {
            append("\n\nThe last frame's hint was ${hint.label()}.")
            if (hints.knownAnswers.isNotEmpty()) {
                append(" Answers confirmed in earlier rounds with this hint: ")
                append(hints.knownAnswers.joinToString(", "))
                append(".")
            }
            if (hints.wordListCandidates.isNotEmpty()) {
                append(" Common answers with this hint: ")
                append(hints.wordListCandidates.joinToString(", "))
                append(".")
            }
            append(" Use them only if the drawing fits; re-read the hint from the image in case it changed.")
        }
    }

    /** JSON schema for structured outputs (official Anthropic endpoint only). Hint and guesses first so they stream first. */
    val SCHEMA: Map<String, Any> = mapOf(
        "type" to "object",
        "additionalProperties" to false,
        "required" to listOf(
            "is_drawing_game", "canvas_empty", "hint", "guesses", "detected_object", "category", "emoji", "canvas_box",
        ),
        "properties" to linkedMapOf(
            "is_drawing_game" to mapOf("type" to "boolean"),
            "canvas_empty" to mapOf("type" to "boolean"),
            "hint" to mapOf(
                "type" to "object",
                "additionalProperties" to false,
                "required" to listOf("word_count", "letter_count", "word_lengths"),
                "properties" to linkedMapOf(
                    "word_count" to mapOf("type" to "integer"),
                    "letter_count" to mapOf("type" to "integer"),
                    "word_lengths" to mapOf("type" to "array", "items" to mapOf("type" to "integer")),
                ),
            ),
            "guesses" to mapOf(
                "type" to "array",
                "items" to mapOf(
                    "type" to "object",
                    "additionalProperties" to false,
                    "required" to listOf("answer", "confidence", "reason"),
                    "properties" to linkedMapOf(
                        "answer" to mapOf("type" to "string"),
                        "confidence" to mapOf("type" to "integer"),
                        "reason" to mapOf("type" to "string"),
                    ),
                ),
            ),
            "detected_object" to mapOf("type" to "string"),
            "category" to mapOf("type" to "string"),
            "emoji" to mapOf("type" to "string"),
            "canvas_box" to mapOf("type" to "array", "items" to mapOf("type" to "number")),
        ),
    )
}

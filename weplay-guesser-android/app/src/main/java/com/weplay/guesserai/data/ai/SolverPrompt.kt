package com.weplay.guesserai.data.ai

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
        masked out). Prefer short, common English nouns or noun phrases that a party game would use.

        Return JSON only, with this shape:
        {
          "is_drawing_game": true,
          "canvas_empty": false,
          "detected_object": "Fire truck",
          "category": "Vehicle",
          "emoji": "🚒",
          "hint": {"word_count": 2, "letter_count": 9, "word_lengths": [4, 5]},
          "canvas_box": [0.08, 0.18, 0.92, 0.62],
          "guesses": [
            {"answer": "Fire Truck", "confidence": 95, "reason": "red vehicle with ladder and hose"}
          ]
        }

        - "confidence" is an integer 0-100.
        - Use 0 for hint numbers and [] for word_lengths you cannot read.
        - canvas_box is the drawing area as [left, top, right, bottom] fractions of the image size.
        - If this is not the drawing game, set is_drawing_game to false and return an empty guesses list.
    """.trimIndent()

    fun userText(knownAnswers: List<String>): String = buildString {
        append("Solve the drawing in this screenshot. Return 10 guesses ranked by confidence.")
        if (knownAnswers.isNotEmpty()) {
            append("\n\nThe game reuses its word list. Answers confirmed in earlier rounds that fit the current hint ")
            append("(consider them if the drawing matches, otherwise ignore them): ")
            append(knownAnswers.joinToString(", "))
        }
    }

    /** JSON schema for structured outputs (sent only to the official Anthropic endpoint). */
    val SCHEMA: Map<String, Any> = mapOf(
        "type" to "object",
        "additionalProperties" to false,
        "required" to listOf(
            "is_drawing_game", "canvas_empty", "detected_object", "category", "emoji", "hint", "canvas_box", "guesses",
        ),
        "properties" to mapOf(
            "is_drawing_game" to mapOf("type" to "boolean"),
            "canvas_empty" to mapOf("type" to "boolean"),
            "detected_object" to mapOf("type" to "string"),
            "category" to mapOf("type" to "string"),
            "emoji" to mapOf("type" to "string"),
            "hint" to mapOf(
                "type" to "object",
                "additionalProperties" to false,
                "required" to listOf("word_count", "letter_count", "word_lengths"),
                "properties" to mapOf(
                    "word_count" to mapOf("type" to "integer"),
                    "letter_count" to mapOf("type" to "integer"),
                    "word_lengths" to mapOf("type" to "array", "items" to mapOf("type" to "integer")),
                ),
            ),
            "canvas_box" to mapOf("type" to "array", "items" to mapOf("type" to "number")),
            "guesses" to mapOf(
                "type" to "array",
                "items" to mapOf(
                    "type" to "object",
                    "additionalProperties" to false,
                    "required" to listOf("answer", "confidence", "reason"),
                    "properties" to mapOf(
                        "answer" to mapOf("type" to "string"),
                        "confidence" to mapOf("type" to "integer"),
                        "reason" to mapOf("type" to "string"),
                    ),
                ),
            ),
        ),
    )
}

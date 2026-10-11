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

        The game is WePlay "Guess My Drawing" on a phone. A player draws on the canvas; others type
        guesses in the chat.

        Reading the word hint (most important — every answer must fit it):
        - The hint is in the MIDDLE OF THE TOP BAR, above the canvas: one underscore or box per letter,
          a wider gap between words. Letters may be revealed over time. Sometimes it is a number or a
          "2 words • 12 letters" label.
        - Count the blanks word by word and return word_lengths, e.g. "_ _ _ _   _ _ _ _ _" → [4, 5].
        - Never take the hint from words written on the canvas, the chat, player names or the timer.
        - If the top bar shows a real word instead of blanks (the round ended or you already guessed it),
          that word is the answer: return it first with confidence 100.

        How answers look in this game:
        - A 1-letter word is always "A": 1 letter in total → "A"; "_ ____" (2 words, 5 letters) → "A Bike".
        - 2 letters: usually an abbreviation such as TV, GO, AC, CD, DJ, OK, PC, ID.
        - 3 letters: often an abbreviation or brand (UFO, KFC, ATM, USB, BMW) or a short noun.
        - Answers can be plural ("Snails", "Shoes") — match the letter count exactly.
        - Game, app, brand and cartoon names are common: "Free Fire" (2 words, 8 letters), PUBG, Among Us,
          Minecraft, TikTok, YouTube, Spider Man, Hello Kitty, Coca Cola.
        - The drawer may write words on the canvas as clues ("slowest small animal" → Snail / Snails).
          Answer with what the clue describes, shaped to fit the hint; do not just repeat the clue.
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
          "canvas_box": [0.0, 0.10, 1.0, 0.49],
          "hint_box": [0.3, 0.05, 0.7, 0.10]
        }

        - Best guess first. "confidence" is an integer 0-100. "reason" is at most 4 words.
        - Use 0 for hint numbers and [] for word_lengths you cannot read.
        - If this is not the drawing game, set is_drawing_game to false and return an empty guesses list.
    """.trimIndent()

    /** Instruction for a whole-screen image: also locate the canvas and the hint so later frames can be cropped. */
    const val FULL_SCREEN = "The image is the whole phone screen. Also return canvas_box (the drawing area) and " +
        "hint_box (the word hint in the top bar) as [left, top, right, bottom] fractions of the image."

    const val HINT_BAR_LABEL = "Image 1 — the game's top bar, zoomed. The word hint (blanks) is in the middle; ignore the timer and buttons."
    const val CANVAS_LABEL = "Image 2 — the drawing canvas."
    const val CROPPED = "Read the hint from image 1 and the drawing from image 2. Return [] for canvas_box and hint_box."

    fun userText(hints: PromptHints, cropped: Boolean): String = buildString {
        append(if (cropped) CROPPED else FULL_SCREEN)
        append(" Return 10 guesses, best first.")
        val hint = hints.lastHint
        if (hint != null && (hints.wordListCandidates.isNotEmpty() || hints.knownAnswers.isNotEmpty())) {
            append("\n\nThe hint so far reads ${hint.label()}.")
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
            "is_drawing_game", "canvas_empty", "hint", "guesses", "detected_object", "category", "emoji",
            "canvas_box", "hint_box",
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
            "hint_box" to mapOf("type" to "array", "items" to mapOf("type" to "number")),
        ),
    )
}

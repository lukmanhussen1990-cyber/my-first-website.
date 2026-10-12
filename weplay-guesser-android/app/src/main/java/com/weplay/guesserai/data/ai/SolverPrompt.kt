package com.weplay.guesserai.data.ai

import com.weplay.guesserai.domain.GuessEngine
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
        - Return 6 possible answers.
        - Rank by confidence.

        The game is WePlay "Guess My Drawing" on a phone. A player draws on the canvas; others type
        guesses in the chat.

        1. Decide screen_state:
        - "guessing": a word is being drawn; the top bar shows the hint.
        - "word_revealed": the top bar shows a real word instead of the hint (e.g. "halwa") because we
          already guessed it. Put that word in revealed_answer and return it as the first guess (100).
        - "round_over": a popup says "Word: fear" / "N players got it", or the chat says
          "Round over! Answer: fear". Put the answer in revealed_answer.
        - "not_game": anything else (lobby, menus, another app).
        revealed_answer is "" unless the game itself shows the answer.

        2. Read the hint (every answer must fit it):
        - It is the text in the MIDDLE OF THE TOP BAR, e.g. "4 letters|A state" or "2 words 9 letters|Organ":
          the word count (when more than one), the letter count, then after "|" a category clue. Long hints
          scroll sideways, so the start may be cut off ("ds 9 letters|Organ" = "2 words 9 letters|Organ").
          It may also show blanks/underscores per letter with gaps between words; count them word by word.
        - Put the clue ("A state") in hint.clue. Ignore the room ID line ("ID: IF5573806"), the timer and
          the buttons. Never take the hint from words written on the canvas or in the chat.
        - "N letters|clue" is never a revealed word.

        3. Look before you guess: in "seen", say in at most 12 words what is really on the canvas:
          shapes, colours, key details and any written letters, e.g. "red truck outline with ladder" or
          "text: halw_". Describe, do not guess. "" when nothing is drawn.

        4. Guess. How answers look in this game:
        - The clue is the strongest signal; every guess should belong to its category. "A state" → a
          feeling or condition (fear, anger, sleep), "A food" → a dish.
        - Sketches are rough and quick: pick what such a doodle most often means in drawing games
          (circle with rays → Sun), not a rare look-alike.
        - Letters on the canvas are the drawer's clue, decode them: partial spellings ("halw_" → Halwa),
          descriptions ("slowest small animal" → Snails), or a Hindi/Hinglish word whose English meaning
          is the answer ("DAR" / "डर" → Fear). Answer with what the clue means, shaped to fit the hint.
        - Write every answer exactly in the hint's shape — your answers are shown to the player as they are,
          nothing fixes them afterwards. Count: word_count words, letter_count letters in total (spaces do
          not count). Split or join words to match ("2 words 9 letters" → "Heart Beat", not "Heartbeat";
          "1 word" → "Firefly"), use plural or singular to match ("6 letters" → "Snails"), and add "A" when
          a 1-letter word is needed. Check each answer's letters before writing it.
        - A 1-letter word is always "A": 1 letter in total → "A"; "_ ____" (2 words, 5 letters) → "A Bike".
        - 2 letters: usually an abbreviation such as TV, GO, AC, CD, DJ, OK, PC, ID.
        - Answers can be plural ("Snails") and can be Indian words ("Halwa", "Samosa", "Diwali").
        - Game, app, brand and cartoon names are common: "Free Fire" (2 words, 8 letters), PUBG, Among Us.
        - Make the 6 guesses 6 different ideas (other things the doodle could be, other members of the
          category), not variants of one word. Example: a heart with a pulse line through it and
          "2 words 9 letters|Organ" → "Heart Beat", then "Heart Rate", "Love Heart", …
        When the user lists possible answers for the hint, use one only if the drawing matches it.

        Return JSON only, fields in this order:
        {
          "screen_state": "guessing",
          "revealed_answer": "",
          "canvas_empty": false,
          "hint": {"word_count": 1, "letter_count": 4, "word_lengths": [4], "clue": "A state"},
          "seen": "text: DAR, scared face",
          "guesses": [
            {"answer": "Fear", "confidence": 90, "reason": "DAR = fear in Hindi"}
          ],
          "detected_object": "Written word DAR",
          "category": "Feeling",
          "emoji": "😨",
          "canvas_box": [0.0, 0.10, 1.0, 0.49],
          "hint_box": [0.3, 0.05, 0.7, 0.10]
        }

        - Best guess first. "confidence" (integer 0-100) is your real certainty: below 50 even for the top
          guess while the drawing is unclear, 90+ only when it is unmistakable or spelled out.
          "reason" is at most 3 words. Keep every field short: the player is waiting for the answer.
        - Use 0 for hint numbers and [] for word_lengths you cannot read.
        - For "not_game", return an empty guesses list.
    """.trimIndent()

    /** Instruction for a whole-screen image: also locate the canvas and the hint so later frames can be cropped. */
    const val FULL_SCREEN = "The image is the whole phone screen. Also return canvas_box (the drawing area) and " +
        "hint_box (the word hint in the top bar) as [left, top, right, bottom] fractions of the image."

    const val HINT_BAR_LABEL = "Image 1 — the game's top bar, zoomed: the hint (\"4 letters|A state\") or, once guessed, the word itself. Ignore the room ID line."
    const val CANVAS_LABEL = "Image 2 — the drawing canvas."
    const val CROPPED = "Read the hint from image 1 and the drawing from image 2. Return [] for canvas_box and hint_box."

    /**
     * The per-frame instruction: which images these are, the answers worth considering for the hint
     * seen so far, and the answers the user already rejected this round.
     */
    fun userText(hints: PromptHints, cropped: Boolean): String = buildString {
        append(if (cropped) CROPPED else FULL_SCREEN)
        append(" Return 6 guesses, best first.")
        // A rejected answer must not be offered again as a candidate, and a confirmed one needs no second mention.
        val skip = hints.rejected.mapTo(HashSet()) { GuessEngine.normalize(it) }
        val known = hints.knownAnswers.filter { skip.add(GuessEngine.normalize(it)) }
        val possible = hints.wordListCandidates.filter { skip.add(GuessEngine.normalize(it)) }
        val hint = hints.lastHint
        if (hint != null && (known.isNotEmpty() || possible.isNotEmpty())) {
            append("\n\nThe hint so far reads ${hint.label()}")
            if (hint.clue.isNotBlank()) append(" (clue: ${hint.clue})")
            append("; re-read it from the image in case it changed.")
            if (known.isNotEmpty()) {
                append(" Answers confirmed in earlier rounds with this hint (use only if the drawing matches): ")
                append(known.joinToString(", "))
                append(".")
            }
            if (possible.isNotEmpty()) {
                append(" Possible answers for this hint (use only if the drawing matches): ")
                append(possible.joinToString(", "))
                append(".")
            }
        }
        if (hints.rejected.isNotEmpty()) {
            append("\n\nAlready tried and wrong this round: ")
            append(hints.rejected.joinToString(", "))
            append(". Do not suggest them again.")
        }
    }

    val SCREEN_STATES = listOf("guessing", "word_revealed", "round_over", "not_game")

    /**
     * JSON schema for structured outputs (official Anthropic endpoint only). State, hint and guesses
     * come first so they stream first; the short "seen" description just before the guesses makes the
     * model look at the strokes before naming them, which helps on rough sketches when thinking is off.
     */
    val SCHEMA: Map<String, Any> = mapOf(
        "type" to "object",
        "additionalProperties" to false,
        "required" to listOf(
            "screen_state", "revealed_answer", "canvas_empty", "hint", "seen", "guesses", "detected_object", "category",
            "emoji", "canvas_box", "hint_box",
        ),
        "properties" to linkedMapOf(
            "screen_state" to mapOf("type" to "string", "enum" to SCREEN_STATES),
            "revealed_answer" to mapOf("type" to "string"),
            "canvas_empty" to mapOf("type" to "boolean"),
            "hint" to mapOf(
                "type" to "object",
                "additionalProperties" to false,
                "required" to listOf("word_count", "letter_count", "word_lengths", "clue"),
                "properties" to linkedMapOf(
                    "word_count" to mapOf("type" to "integer"),
                    "letter_count" to mapOf("type" to "integer"),
                    "word_lengths" to mapOf("type" to "array", "items" to mapOf("type" to "integer")),
                    "clue" to mapOf("type" to "string"),
                ),
            ),
            "seen" to mapOf("type" to "string"),
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

package com.weplay.guesserai

import com.weplay.guesserai.domain.FrameAnalysis
import com.weplay.guesserai.domain.Guess
import com.weplay.guesserai.domain.GuessEngine
import com.weplay.guesserai.domain.HintPattern
import com.weplay.guesserai.domain.PartialAnalysis
import com.weplay.guesserai.domain.RoundTracker
import com.weplay.guesserai.domain.ScreenState
import org.junit.Assert.assertTrue
import org.junit.Assert.fail
import org.junit.Test
import kotlin.random.Random

/** Random games against the round logic: whatever the model says and the user taps, the rules hold. */
class RoundTrackerPropertyTest {
    private val words = listOf("Utah", "Ohio", "Halwa", "Kheer", "Heart Beat", "Free Fire", "A Bike", "TV", "Snails", "Lamp", "Crab", "Fear")
    private val clues = listOf("", "A state", "A food", "Organ", "Animal")

    private fun Random.hint(): HintPattern? = when (nextInt(6)) {
        0 -> null
        else -> HintPattern(1 + nextInt(3), 2 + nextInt(10), clue = clues[nextInt(clues.size)])
    }

    private fun Random.analysis(): FrameAnalysis {
        val state = ScreenState.entries[nextInt(ScreenState.entries.size)]
        return FrameAnalysis(
            isDrawingGame = state != ScreenState.NOT_GAME, canvasEmpty = nextInt(8) == 0,
            detectedObject = "", category = "", emoji = "", hint = hint(), canvasBox = null,
            guesses = List(nextInt(7)) { Guess(words[nextInt(words.size)], nextInt(101)) },
            screenState = state,
            revealedAnswer = if (nextInt(3) == 0) words[nextInt(words.size)].lowercase() else "",
        )
    }

    @Test fun `random games keep the round rules`() {
        val ctx = RoundTracker.Context()
        repeat(300) { game ->
            val rnd = Random(game)
            val t = RoundTracker()
            var seq = 0L
            var round = t.roundId
            val rejectedThisRound = mutableSetOf<String>()
            repeat(200) { step ->
                val where = "game $game step $step"
                val view = try {
                    when (rnd.nextInt(12)) {
                        0 -> t.next(ctx)?.let { rejectedThisRound += GuessEngine.normalize(it.rejected); it.view }
                        1 -> t.view(ctx).guesses.randomOrNull(rnd)?.let { t.markCorrect(it.answer, ctx).view }
                        2 -> t.adjustHint(rnd.nextInt(-1, 2), rnd.nextInt(-2, 3), ctx)
                        3 -> t.clearManualHint(ctx)
                        4 -> t.refresh(ctx)
                        5 -> t.partial(++seq, PartialAnalysis(rnd.hint(), List(rnd.nextInt(4)) { Guess(words[rnd.nextInt(words.size)], rnd.nextInt(101)) }, true, false), ctx)
                        else -> t.final(++seq, rnd.analysis(), ctx, deep = rnd.nextInt(5) == 0).view
                    }
                } catch (e: Throwable) {
                    fail("$where threw $e"); null
                }
                if (t.roundId != round) {
                    assertTrue("$where: round id went back", t.roundId > round)
                    round = t.roundId
                    rejectedThisRound.clear()
                }
                val v = view ?: t.view(ctx)
                val shown = v.guesses.map { GuessEngine.normalize(it.answer) }
                assertTrue("$where: a rejected answer came back: $shown vs $rejectedThisRound", shown.none { it in rejectedThisRound })
                assertTrue("$where: duplicates shown: $shown", shown.size == shown.toSet().size)
                val fit = v.guesses.map { it.matchesHint }
                assertTrue("$where: an answer that fits the hint is shown after one that does not: $fit", fit == fit.sortedDescending())
                assertTrue("$where: confidence out of range", v.guesses.all { it.confidence in 0..100 })
            }
        }
    }
}

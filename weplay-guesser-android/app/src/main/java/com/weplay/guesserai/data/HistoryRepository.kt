package com.weplay.guesserai.data

import android.content.Context
import com.weplay.guesserai.data.db.AnswerStatEntity
import com.weplay.guesserai.data.db.DrawingDao
import com.weplay.guesserai.data.db.DrawingRecord
import com.weplay.guesserai.domain.AnswerStats
import com.weplay.guesserai.domain.GuessEngine
import com.weplay.guesserai.domain.HintPattern
import com.weplay.guesserai.domain.RankedGuess
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.io.File

/** The learning system: stores confirmed rounds and per-answer statistics. */
class HistoryRepository(context: Context, private val dao: DrawingDao) {
    private val imageDir = File(context.filesDir, "drawings").apply { mkdirs() }

    val records: Flow<List<DrawingRecord>> = dao.observeAll()
    val count: Flow<Int> = dao.observeCount()

    suspend fun stats(): Map<String, AnswerStats> = withContext(Dispatchers.IO) {
        dao.allStats().associate { it.answer to AnswerStats(it.correct, it.rejected) }
    }

    /** Past correct answers with the same shape — fed to the model as likely candidates. */
    suspend fun knownAnswers(hint: HintPattern?, limit: Int = 25): List<String> = withContext(Dispatchers.IO) {
        if (hint == null || !hint.isKnown) emptyList()
        else dao.knownAnswers(hint.wordCount, hint.letterCount, limit).map { it.display }
    }

    suspend fun recordCorrect(
        answer: String,
        jpeg: ByteArray?,
        guesses: List<RankedGuess>,
        hint: HintPattern?,
        category: String,
    ) = withContext(Dispatchers.IO) {
        val now = System.currentTimeMillis()
        val path = jpeg?.let { bytes -> File(imageDir, "drawing_$now.jpg").also { it.writeBytes(bytes) }.absolutePath }
        val json = JSONArray().apply {
            guesses.forEach { put(JSONObject().put("answer", it.answer).put("confidence", it.confidence).put("reason", it.reason)) }
        }
        val key = GuessEngine.normalize(answer)
        dao.insert(
            DrawingRecord(
                timestamp = now,
                imagePath = path,
                correctAnswer = answer,
                aiGuessesJson = json.toString(),
                confidence = guesses.firstOrNull { GuessEngine.normalize(it.answer) == key }?.confidence ?: 0,
                wordCount = hint?.wordCount ?: GuessEngine.wordLengths(answer).size,
                letterCount = hint?.letterCount ?: GuessEngine.wordLengths(answer).sum(),
                category = category,
            )
        )
        bump(answer, correct = 1, rejected = 0)
    }

    suspend fun recordRejected(answer: String) = withContext(Dispatchers.IO) { bump(answer, 0, 1) }

    private suspend fun bump(answer: String, correct: Int, rejected: Int) {
        val key = GuessEngine.normalize(answer)
        val lengths = GuessEngine.wordLengths(answer)
        val old = dao.stat(key)
        dao.upsertStat(
            AnswerStatEntity(
                answer = key,
                display = GuessEngine.cleanAnswer(answer),
                correct = (old?.correct ?: 0) + correct,
                rejected = (old?.rejected ?: 0) + rejected,
                letterCount = lengths.sum(),
                wordCount = lengths.size,
                lastSeen = System.currentTimeMillis(),
            )
        )
    }

    suspend fun clear() = withContext(Dispatchers.IO) {
        dao.allImagePaths().forEach { File(it).delete() }
        dao.clear()
        dao.clearStats()
    }
}

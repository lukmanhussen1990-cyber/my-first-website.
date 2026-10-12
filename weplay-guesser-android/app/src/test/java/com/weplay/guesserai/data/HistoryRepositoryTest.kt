package com.weplay.guesserai.data

import android.content.Context
import android.database.sqlite.SQLiteException
import androidx.room.Room
import androidx.test.core.app.ApplicationProvider
import com.weplay.guesserai.data.db.AppDatabase
import com.weplay.guesserai.data.db.DrawingDao
import com.weplay.guesserai.data.db.DrawingRecord
import com.weplay.guesserai.domain.HintPattern
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.runTest
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import java.io.File
import java.util.concurrent.Executor

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [34])
class HistoryRepositoryTest {
    private val ctx: Context = ApplicationProvider.getApplicationContext()
    private val direct = Executor { it.run() }
    private val db = Room.inMemoryDatabaseBuilder(ctx, AppDatabase::class.java)
        .allowMainThreadQueries().setQueryExecutor(direct).setTransactionExecutor(direct).build()
    private val drawings = File(ctx.filesDir, "drawings")

    @After fun tearDown() = db.close()

    @Test fun `only the newest drawings keep their picture, every round stays learned`() = runTest {
        val repo = HistoryRepository(ctx, db.drawingDao(), io = StandardTestDispatcher(testScheduler))
        val rounds = HistoryRepository.MAX_IMAGES + 5
        repeat(rounds) { i ->
            repo.recordCorrect("Word $i", ByteArray(2_000), emptyList(), HintPattern(2, 5), "")
            Thread.sleep(1) // distinct file names (millisecond timestamps)
        }
        val records = db.drawingDao().observeAll().first()
        assertEquals(rounds, records.size)
        assertEquals(HistoryRepository.MAX_IMAGES, records.count { it.imagePath != null })
        assertEquals(HistoryRepository.MAX_IMAGES, drawings.listFiles()!!.size)
        // The 5 oldest lost their picture, not their place in the history or the stats.
        val oldest = records.sortedBy { it.timestamp }.take(5)
        assertTrue(oldest.all { it.imagePath == null })
        assertEquals(1, repo.stats()["word 0"]?.correct)
    }

    /** Android 10 and 11 ship SQLite 3.22 / 3.28: at most 999 variables in one statement. */
    private class OldSqliteDao(private val real: DrawingDao) : DrawingDao by real {
        override suspend fun forgetImages(ids: List<Long>) {
            if (ids.size > 999) throw SQLiteException("too many SQL variables (code 1 SQLITE_ERROR)")
            real.forgetImages(ids)
        }
    }

    @Test fun `upgrading with over a thousand saved pictures prunes them on Android 10 and 11 too`() = runTest {
        val dao = OldSqliteDao(db.drawingDao())
        // As 1.6.0 left it: a picture for every one of 1,500 rounds, never pruned.
        repeat(1_500) { i ->
            val file = File(drawings.apply { mkdirs() }, "drawing_old_$i.jpg").apply { writeBytes(ByteArray(8)) }
            db.drawingDao().insert(DrawingRecord(timestamp = i.toLong(), imagePath = file.absolutePath, correctAnswer = "Word $i", aiGuessesJson = "[]", confidence = 0, wordCount = 2, letterCount = 5, category = ""))
        }
        val repo = HistoryRepository(ctx, dao, io = StandardTestDispatcher(testScheduler))
        repo.recordCorrect("New", ByteArray(8), emptyList(), HintPattern(1, 3), "")
        val records = db.drawingDao().observeAll().first()
        assertEquals(1_501, records.size)
        assertEquals(HistoryRepository.MAX_IMAGES, records.count { it.imagePath != null })
        assertEquals(HistoryRepository.MAX_IMAGES, drawings.listFiles()!!.size)
    }

    @Test fun `clear removes every saved picture`() = runTest {
        val repo = HistoryRepository(ctx, db.drawingDao(), io = StandardTestDispatcher(testScheduler))
        repo.recordCorrect("Heart Beat", ByteArray(100), emptyList(), null, "")
        File(drawings, "drawing_orphan.jpg").writeBytes(ByteArray(10)) // a save that never reached the database
        repo.clear()
        assertFalse(drawings.listFiles()!!.isNotEmpty())
        assertEquals(0, db.drawingDao().observeCount().first())
    }
}

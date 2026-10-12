package com.weplay.guesserai.data

import android.content.Context
import androidx.room.Room
import androidx.test.core.app.ApplicationProvider
import com.weplay.guesserai.data.db.AppDatabase
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

    @Test fun `clear removes every saved picture`() = runTest {
        val repo = HistoryRepository(ctx, db.drawingDao(), io = StandardTestDispatcher(testScheduler))
        repo.recordCorrect("Heart Beat", ByteArray(100), emptyList(), null, "")
        File(drawings, "drawing_orphan.jpg").writeBytes(ByteArray(10)) // a save that never reached the database
        repo.clear()
        assertFalse(drawings.listFiles()!!.isNotEmpty())
        assertEquals(0, db.drawingDao().observeCount().first())
    }
}

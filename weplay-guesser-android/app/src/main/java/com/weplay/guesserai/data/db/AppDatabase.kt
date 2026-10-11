package com.weplay.guesserai.data.db

import android.content.Context
import androidx.room.Dao
import androidx.room.Database
import androidx.room.Entity
import androidx.room.Insert
import androidx.room.PrimaryKey
import androidx.room.Query
import androidx.room.Room
import androidx.room.RoomDatabase
import kotlinx.coroutines.flow.Flow

/** One confirmed round: what was drawn, what the AI thought, and what the answer really was. */
@Entity(tableName = "drawings")
data class DrawingRecord(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val timestamp: Long,
    /** Absolute path of the saved JPEG, or null when screenshot saving is off. */
    val imagePath: String?,
    val correctAnswer: String,
    /** JSON array of {answer, confidence, reason} as ranked at the time. */
    val aiGuessesJson: String,
    /** Confidence the AI had in the correct answer (0 if it never suggested it). */
    val confidence: Int,
    val wordCount: Int,
    val letterCount: Int,
    val category: String,
)

/** Running tallies per normalised answer — the "memory" the guess engine uses. */
@Entity(tableName = "answer_stats")
data class AnswerStatEntity(
    @PrimaryKey val answer: String,
    val display: String,
    val correct: Int,
    val rejected: Int,
    val letterCount: Int,
    val wordCount: Int,
    val lastSeen: Long,
)

@Dao
interface DrawingDao {
    @Insert
    suspend fun insert(record: DrawingRecord): Long

    @Query("SELECT * FROM drawings ORDER BY timestamp DESC")
    fun observeAll(): Flow<List<DrawingRecord>>

    @Query("SELECT COUNT(*) FROM drawings")
    fun observeCount(): Flow<Int>

    @Query("SELECT imagePath FROM drawings WHERE imagePath IS NOT NULL")
    suspend fun allImagePaths(): List<String>

    @Query("DELETE FROM drawings")
    suspend fun clear()

    @Query("SELECT * FROM answer_stats")
    suspend fun allStats(): List<AnswerStatEntity>

    @Query("SELECT * FROM answer_stats WHERE answer = :answer")
    suspend fun stat(answer: String): AnswerStatEntity?

    @Insert(onConflict = androidx.room.OnConflictStrategy.REPLACE)
    suspend fun upsertStat(stat: AnswerStatEntity)

    @Query(
        "SELECT * FROM answer_stats WHERE correct > 0 AND wordCount = :words AND letterCount = :letters " +
            "ORDER BY correct DESC, lastSeen DESC LIMIT :limit"
    )
    suspend fun knownAnswers(words: Int, letters: Int, limit: Int): List<AnswerStatEntity>

    @Query("DELETE FROM answer_stats")
    suspend fun clearStats()
}

@Database(entities = [DrawingRecord::class, AnswerStatEntity::class], version = 1, exportSchema = false)
abstract class AppDatabase : RoomDatabase() {
    abstract fun drawingDao(): DrawingDao

    companion object {
        fun create(context: Context): AppDatabase =
            Room.databaseBuilder(context, AppDatabase::class.java, "weplay_ai.db").build()
    }
}

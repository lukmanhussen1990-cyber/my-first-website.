package com.alarmhandler.app.data.db

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.Query
import kotlinx.coroutines.flow.Flow

@Dao
interface HistoryDao {

    @Query("SELECT * FROM alarm_history ORDER BY happened_at DESC LIMIT :limit")
    fun observeRecent(limit: Int = 200): Flow<List<AlarmHistoryEntry>>

    @Insert
    suspend fun insert(entry: AlarmHistoryEntry): Long

    @Query("DELETE FROM alarm_history")
    suspend fun clear()

    /** Keeps the table from growing without bound on a long-lived install. */
    @Query(
        "DELETE FROM alarm_history WHERE id NOT IN " +
            "(SELECT id FROM alarm_history ORDER BY happened_at DESC LIMIT :keep)"
    )
    suspend fun trimTo(keep: Int)
}

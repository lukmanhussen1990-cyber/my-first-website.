package com.alarmhandler.app.data.repo

import com.alarmhandler.app.data.db.AlarmHistoryEntry
import com.alarmhandler.app.data.db.HistoryAction
import com.alarmhandler.app.data.db.HistoryDao
import com.alarmhandler.app.data.model.Alarm
import kotlinx.coroutines.flow.Flow

class HistoryRepository(private val dao: HistoryDao) {

    val recent: Flow<List<AlarmHistoryEntry>> = dao.observeRecent()

    suspend fun record(
        alarm: Alarm,
        action: HistoryAction,
        scheduledAt: Long,
        happenedAt: Long = System.currentTimeMillis(),
    ) {
        dao.insert(
            AlarmHistoryEntry(
                alarmId = alarm.id,
                label = alarm.label,
                scheduledAt = scheduledAt,
                happenedAt = happenedAt,
                action = action,
                snoozeCount = alarm.snoozeCount,
            )
        )
        dao.trimTo(MAX_ENTRIES)
    }

    suspend fun clear() = dao.clear()

    private companion object {
        const val MAX_ENTRIES = 300
    }
}

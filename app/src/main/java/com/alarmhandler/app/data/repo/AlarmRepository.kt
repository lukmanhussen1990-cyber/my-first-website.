package com.alarmhandler.app.data.repo

import com.alarmhandler.app.alarm.AlarmScheduler
import com.alarmhandler.app.data.db.AlarmDao
import com.alarmhandler.app.data.model.Alarm
import kotlinx.coroutines.flow.Flow

/**
 * The single place alarms are written.
 *
 * Every mutation re-arms the system alarm for the row it touched, so the
 * database and [android.app.AlarmManager] can never disagree -- there is no
 * code path that saves an alarm without scheduling it.
 */
class AlarmRepository(
    private val dao: AlarmDao,
    private val scheduler: AlarmScheduler,
) {

    val alarms: Flow<List<Alarm>> = dao.observeAll()

    fun observe(id: Long): Flow<Alarm?> = dao.observeById(id)

    suspend fun getById(id: Long): Alarm? = dao.getById(id)

    suspend fun getAll(): List<Alarm> = dao.getAll()

    /** Inserts or updates [alarm] and returns its id. */
    suspend fun save(alarm: Alarm): Long {
        val clean = alarm.sanitized()
        val id = if (clean.id == 0L) {
            dao.insert(clean)
        } else {
            dao.update(clean)
            clean.id
        }
        val stored = dao.getById(id) ?: clean.copy(id = id)
        scheduler.cancel(id)
        scheduler.schedule(stored)
        return id
    }

    suspend fun setEnabled(id: Long, enabled: Boolean) {
        val alarm = dao.getById(id) ?: return
        // Switching an alarm off also clears any snooze it was holding.
        val updated = alarm.copy(
            enabled = enabled,
            snoozeCount = if (enabled) alarm.snoozeCount else 0,
            snoozeUntil = if (enabled) alarm.snoozeUntil else 0L,
        )
        dao.update(updated)
        scheduler.cancel(id)
        if (enabled) scheduler.schedule(updated)
    }

    suspend fun delete(alarm: Alarm) {
        scheduler.cancel(alarm.id)
        dao.deleteById(alarm.id)
    }

    /** Copies [alarm] as a new, switched-off-free duplicate placed right away. */
    suspend fun duplicate(alarm: Alarm): Long {
        val copy = alarm.copy(
            id = 0L,
            label = duplicateLabel(alarm.label),
            snoozeCount = 0,
            snoozeUntil = 0L,
            createdAt = System.currentTimeMillis(),
        )
        return save(copy)
    }

    private fun duplicateLabel(label: String): String = when {
        label.isBlank() -> ""
        label.length > Alarm.MAX_LABEL_LENGTH - 6 -> label
        else -> "$label (copy)"
    }

    /** Records a snooze and arms the follow-up ring. */
    suspend fun snooze(alarm: Alarm, untilMillis: Long) {
        val updated = alarm.copy(
            snoozeCount = alarm.snoozeCount + 1,
            snoozeUntil = untilMillis,
        )
        dao.update(updated)
        scheduler.scheduleSnooze(updated, untilMillis)
    }

    /**
     * Called when a ringing session ends. One-time alarms switch themselves
     * off; repeating alarms simply drop the snooze state and stay armed for
     * their next day.
     */
    suspend fun finishRinging(alarmId: Long) {
        val alarm = dao.getById(alarmId) ?: return
        scheduler.cancelSnooze(alarmId)
        val updated = alarm.copy(
            snoozeCount = 0,
            snoozeUntil = 0L,
            enabled = alarm.isRepeating && alarm.enabled,
        )
        dao.update(updated)
        scheduler.cancelMain(alarmId)
        if (updated.enabled) scheduler.schedule(updated)
    }

    /** Re-arms everything from the database. Safe to call repeatedly. */
    suspend fun rescheduleAll() {
        scheduler.rescheduleAll(dao.getAll())
    }

    suspend fun replaceAll(alarms: List<Alarm>) {
        dao.getAll().forEach { scheduler.cancel(it.id) }
        dao.deleteAll()
        alarms.forEach { save(it.copy(id = 0L)) }
    }
}

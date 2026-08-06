package com.alarmhandler.app.data.db

import androidx.room.ColumnInfo
import androidx.room.Entity
import androidx.room.PrimaryKey

/** What ended a ringing session. */
enum class HistoryAction(val id: String) {
    RANG("rang"),
    SNOOZED("snoozed"),
    DISMISSED("dismissed"),
    MISSED("missed"),
    SKIPPED("skipped"),
    ;

    companion object {
        fun fromId(id: String?): HistoryAction =
            entries.firstOrNull { it.id == id } ?: RANG
    }
}

/**
 * One line of the alarm history. The label and time are copied in rather than
 * joined so history survives the alarm being edited or deleted.
 */
@Entity(tableName = "alarm_history")
data class AlarmHistoryEntry(
    @PrimaryKey(autoGenerate = true)
    val id: Long = 0L,

    @ColumnInfo(name = "alarm_id")
    val alarmId: Long,

    @ColumnInfo(name = "label")
    val label: String,

    @ColumnInfo(name = "scheduled_at")
    val scheduledAt: Long,

    @ColumnInfo(name = "happened_at")
    val happenedAt: Long,

    @ColumnInfo(name = "action")
    val action: HistoryAction,

    @ColumnInfo(name = "snooze_count")
    val snoozeCount: Int = 0,
)

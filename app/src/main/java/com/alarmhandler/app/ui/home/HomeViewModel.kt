package com.alarmhandler.app.ui.home

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.initializer
import androidx.lifecycle.viewmodel.viewModelFactory
import com.alarmhandler.app.alarm.AlarmSchedule
import com.alarmhandler.app.data.ServiceLocator
import com.alarmhandler.app.data.model.Alarm
import com.alarmhandler.app.data.repo.AlarmRepository
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.flow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import java.time.ZonedDateTime

/** One alarm plus the moment it will next ring. */
data class AlarmRow(
    val alarm: Alarm,
    val nextTriggerMillis: Long?,
)

data class HomeUiState(
    val rows: List<AlarmRow> = emptyList(),
    val nextAlarm: AlarmRow? = null,
    val now: Long = System.currentTimeMillis(),
    val loaded: Boolean = false,
) {
    val hasAlarms: Boolean get() = rows.isNotEmpty()
    val anyEnabled: Boolean get() = rows.any { it.alarm.enabled }
}

/** A deleted alarm held briefly so the snackbar can put it back. */
data class PendingUndo(val alarm: Alarm)

class HomeViewModel(private val repository: AlarmRepository) : ViewModel() {

    // Recomputed on a slow tick: the countdown only shows whole minutes, so
    // waking every second would burn battery for nothing.
    private val ticker = flow {
        while (true) {
            emit(System.currentTimeMillis())
            delay(TICK_MS)
        }
    }

    private val _undo = MutableStateFlow<PendingUndo?>(null)
    val undo: StateFlow<PendingUndo?> = _undo

    private val _message = MutableStateFlow<String?>(null)
    val message: StateFlow<String?> = _message

    val state: StateFlow<HomeUiState> = combine(repository.alarms, ticker) { alarms, now ->
        val zoned = ZonedDateTime.now()
        val sorted = AlarmSchedule.sortedByNextTrigger(alarms, zoned)
        val rows = sorted.map { AlarmRow(it, AlarmSchedule.nextTriggerMillis(it, zoned)) }
        HomeUiState(
            rows = rows,
            nextAlarm = rows.firstOrNull { it.alarm.enabled && it.nextTriggerMillis != null },
            now = now,
            loaded = true,
        )
    }.stateIn(
        scope = viewModelScope,
        started = SharingStarted.WhileSubscribed(5_000),
        initialValue = HomeUiState(),
    )

    fun setEnabled(alarm: Alarm, enabled: Boolean) {
        viewModelScope.launch {
            repository.setEnabled(alarm.id, enabled)
        }
    }

    fun delete(alarm: Alarm) {
        viewModelScope.launch {
            repository.delete(alarm)
            _undo.value = PendingUndo(alarm)
        }
    }

    fun restoreDeleted() {
        val pending = _undo.value ?: return
        _undo.value = null
        viewModelScope.launch {
            // A fresh row is inserted: the original id may have been reused.
            repository.save(pending.alarm.copy(id = 0L))
        }
    }

    fun clearUndo() {
        _undo.value = null
    }

    fun duplicate(alarm: Alarm) {
        viewModelScope.launch {
            repository.duplicate(alarm)
            _message.value = "Alarm duplicated"
        }
    }

    fun clearMessage() {
        _message.value = null
    }

    companion object {
        private const val TICK_MS = 15_000L

        val Factory: ViewModelProvider.Factory = viewModelFactory {
            initializer { HomeViewModel(ServiceLocator.alarms) }
        }
    }
}

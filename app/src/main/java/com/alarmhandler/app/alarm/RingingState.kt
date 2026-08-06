package com.alarmhandler.app.alarm

import com.alarmhandler.app.data.model.Alarm
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

/**
 * The one ringing session, shared between [AlarmService] and the ringing
 * screen.
 *
 * A plain process-wide flow is used instead of service binding: the activity
 * can be created before, after or twice over relative to the service, and this
 * keeps both sides reading the same truth without any lifecycle juggling.
 */
object RingingState {

    /** Why the ringing screen is currently on screen. */
    enum class Phase { RINGING, SNOOZED, DISMISSED }

    data class Session(
        val alarm: Alarm,
        val startedAt: Long,
        val fromSnooze: Boolean,
        val phase: Phase = Phase.RINGING,
    )

    private val _session = MutableStateFlow<Session?>(null)
    val session: StateFlow<Session?> = _session.asStateFlow()

    val isRinging: Boolean
        get() = _session.value?.phase == Phase.RINGING

    fun start(alarm: Alarm, fromSnooze: Boolean) {
        _session.value = Session(
            alarm = alarm,
            startedAt = System.currentTimeMillis(),
            fromSnooze = fromSnooze,
        )
    }

    fun moveTo(phase: Phase) {
        _session.value = _session.value?.copy(phase = phase)
    }

    fun clear() {
        _session.value = null
    }
}

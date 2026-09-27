package com.imran.examcountdown.core

enum class FocusMode(val minutes: Int, val label: String) {
    FOCUS(25, "Focus"),
    BREAK(5, "Break");

    val durationMs: Long get() = minutes * MINUTE
}

enum class FocusPhase { READY, RUNNING, PAUSED, FINISHED }

/**
 * A moment seen on three clocks: the wall clock, time since boot (unaffected by clock
 * changes) and which boot of the phone this is.
 */
data class Moment(val wall: Long, val elapsed: Long, val boot: Int)

/**
 * Persisted timer state. A running timer stores when it ends rather than how much time is
 * left, so it stays correct while the app is in the background or not running at all.
 */
data class FocusState(
    val mode: FocusMode = FocusMode.FOCUS,
    val running: Boolean = false,
    val endWall: Long = 0L,
    val endElapsed: Long = 0L,
    val boot: Int = -1,
    /** Time left while not running. */
    val remaining: Long = FocusMode.FOCUS.durationMs,
    /** Set when a session has just run to zero, until the next action. */
    val finished: FocusMode? = null,
    val sessionsToday: Int = 0,
    /** Local epoch day that [sessionsToday] belongs to. */
    val sessionsDay: Long = -1L,
)

object FocusTimer {

    fun remaining(s: FocusState, now: Moment): Long {
        if (!s.running) return s.remaining
        // Same boot: trust the monotonic clock, which ignores changes to the phone's time.
        // After a reboot only the wall clock is left.
        val left = if (s.boot >= 0 && s.boot == now.boot) s.endElapsed - now.elapsed else s.endWall - now.wall
        return left.coerceIn(0L, s.mode.durationMs)
    }

    fun phase(s: FocusState, now: Moment): FocusPhase = when {
        s.running -> if (remaining(s, now) > 0) FocusPhase.RUNNING else FocusPhase.FINISHED
        s.finished != null -> FocusPhase.FINISHED
        s.remaining < s.mode.durationMs -> FocusPhase.PAUSED
        else -> FocusPhase.READY
    }

    /** Wall-clock time the running session ends, or null when not running. */
    fun endsAt(s: FocusState, now: Moment): Long? = if (s.running) now.wall + remaining(s, now) else null

    /** Start, or resume after a pause. After a finished session this starts a fresh one. */
    fun start(s: FocusState, now: Moment): FocusState {
        if (s.running) return s
        val left = if (s.finished != null || s.remaining <= 0) s.mode.durationMs else s.remaining
        return s.copy(
            running = true,
            endWall = now.wall + left,
            endElapsed = now.elapsed + left,
            boot = now.boot,
            finished = null,
        )
    }

    fun pause(s: FocusState, now: Moment): FocusState {
        if (!s.running) return s
        return s.copy(running = false, remaining = remaining(s, now), finished = null)
    }

    fun reset(s: FocusState): FocusState =
        s.copy(running = false, remaining = s.mode.durationMs, finished = null)

    /** Switches between focus and break, stopping any session in progress. */
    fun select(s: FocusState, mode: FocusMode): FocusState =
        s.copy(mode = mode, running = false, remaining = mode.durationMs, finished = null)

    fun startBreak(s: FocusState, now: Moment): FocusState = start(select(s, FocusMode.BREAK), now)

    fun startFocus(s: FocusState, now: Moment): FocusState = start(select(s, FocusMode.FOCUS), now)

    /**
     * Moves a running session that has reached zero into the finished state and counts
     * completed focus sessions for [today] (a local epoch day).
     */
    fun settle(s: FocusState, now: Moment, today: Long): FocusState {
        var state = if (s.sessionsDay != today) s.copy(sessionsToday = 0, sessionsDay = today) else s
        if (state.running && remaining(state, now) <= 0) {
            val count = if (state.mode == FocusMode.FOCUS) state.sessionsToday + 1 else state.sessionsToday
            state = state.copy(running = false, remaining = 0L, finished = state.mode, sessionsToday = count)
        }
        return state
    }
}

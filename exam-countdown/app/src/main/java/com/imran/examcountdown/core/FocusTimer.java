package com.imran.examcountdown.core;

import kotlin.Metadata;
import kotlin.jvm.internal.Intrinsics;
import kotlin.ranges.RangesKt;

public final class FocusTimer {
    public static final FocusTimer INSTANCE = new FocusTimer();

    private FocusTimer() {
    }

    public final long remaining(FocusState s, Moment now) {
        long endWall;
        long wall;
        Intrinsics.checkNotNullParameter(s, "s");
        Intrinsics.checkNotNullParameter(now, "now");
        if (s.getRunning()) {
            if (s.getBoot() < 0 || s.getBoot() != now.getBoot()) {
                endWall = s.getEndWall();
                wall = now.getWall();
            } else {
                endWall = s.getEndElapsed();
                wall = now.getElapsed();
            }
            return RangesKt.coerceIn(endWall - wall, 0L, s.getMode().getDurationMs());
        }
        return s.getRemaining();
    }

    public final FocusPhase phase(FocusState s, Moment now) {
        Intrinsics.checkNotNullParameter(s, "s");
        Intrinsics.checkNotNullParameter(now, "now");
        return s.getRunning() ? remaining(s, now) > 0 ? FocusPhase.RUNNING : FocusPhase.FINISHED : s.getFinished() != null ? FocusPhase.FINISHED : s.getRemaining() < s.getMode().getDurationMs() ? FocusPhase.PAUSED : FocusPhase.READY;
    }

    public final Long endsAt(FocusState s, Moment now) {
        Intrinsics.checkNotNullParameter(s, "s");
        Intrinsics.checkNotNullParameter(now, "now");
        if (s.getRunning()) {
            return Long.valueOf(now.getWall() + remaining(s, now));
        }
        return null;
    }

    public final FocusState start(FocusState s, Moment now) {
        Intrinsics.checkNotNullParameter(s, "s");
        Intrinsics.checkNotNullParameter(now, "now");
        if (s.getRunning()) {
            return s;
        }
        long durationMs = (s.getFinished() != null || s.getRemaining() <= 0) ? s.getMode().getDurationMs() : s.getRemaining();
        return FocusState.copy$default(s, null, true, now.getWall() + durationMs, now.getElapsed() + durationMs, now.getBoot(), 0L, null, 0, 0L, 417, null);
    }

    public final FocusState pause(FocusState s, Moment now) {
        Intrinsics.checkNotNullParameter(s, "s");
        Intrinsics.checkNotNullParameter(now, "now");
        return !s.getRunning() ? s : FocusState.copy$default(s, null, false, 0L, 0L, 0, remaining(s, now), null, 0, 0L, 413, null);
    }

    public final FocusState reset(FocusState s) {
        Intrinsics.checkNotNullParameter(s, "s");
        return FocusState.copy$default(s, null, false, 0L, 0L, 0, s.getMode().getDurationMs(), null, 0, 0L, 413, null);
    }

    public final FocusState select(FocusState s, FocusMode mode) {
        Intrinsics.checkNotNullParameter(s, "s");
        Intrinsics.checkNotNullParameter(mode, "mode");
        return FocusState.copy$default(s, mode, false, 0L, 0L, 0, mode.getDurationMs(), null, 0, 0L, 412, null);
    }

    public final FocusState startBreak(FocusState s, Moment now) {
        Intrinsics.checkNotNullParameter(s, "s");
        Intrinsics.checkNotNullParameter(now, "now");
        return start(select(s, FocusMode.BREAK), now);
    }

    public final FocusState startFocus(FocusState s, Moment now) {
        Intrinsics.checkNotNullParameter(s, "s");
        Intrinsics.checkNotNullParameter(now, "now");
        return start(select(s, FocusMode.FOCUS), now);
    }

    public final FocusState settle(FocusState focusState, Moment now, long j) {
        FocusState s = focusState;
        Intrinsics.checkNotNullParameter(s, "s");
        Intrinsics.checkNotNullParameter(now, "now");
        if (focusState.getSessionsDay() != j) {
            s = FocusState.copy$default(focusState, null, false, 0L, 0L, 0, 0L, null, 0, j, 127, null);
        }
        if (!s.getRunning() || remaining(s, now) > 0) {
            return s;
        }
        return FocusState.copy$default(s, null, false, 0L, 0L, 0, 0L, s.getMode(), s.getMode() == FocusMode.FOCUS ? s.getSessionsToday() + 1 : s.getSessionsToday(), 0L, 285, null);
    }
}

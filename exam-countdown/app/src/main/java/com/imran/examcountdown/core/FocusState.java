package com.imran.examcountdown.core;

import kotlin.Metadata;
import kotlin.jvm.internal.DefaultConstructorMarker;
import kotlin.jvm.internal.Intrinsics;
import kotlin.uuid.Uuid;

public final class FocusState {
    private final int boot;
    private final long endElapsed;
    private final long endWall;
    private final FocusMode finished;
    private final FocusMode mode;
    private final long remaining;
    private final boolean running;
    private final long sessionsDay;
    private final int sessionsToday;

    public FocusState() {
        this(null, false, 0L, 0L, 0, 0L, null, 0, 0L, 511, null);
    }

    public static FocusState copy$default(FocusState focusState, FocusMode focusMode, boolean z, long j, long j2, int i, long j3, FocusMode focusMode2, int i2, long j4, int i3, Object obj) {
        return focusState.copy((i3 & 1) != 0 ? focusState.mode : focusMode, (i3 & 2) != 0 ? focusState.running : z, (i3 & 4) != 0 ? focusState.endWall : j, (i3 & 8) != 0 ? focusState.endElapsed : j2, (i3 & 16) != 0 ? focusState.boot : i, (i3 & 32) != 0 ? focusState.remaining : j3, (i3 & 64) != 0 ? focusState.finished : focusMode2, (i3 & Uuid.SIZE_BITS) != 0 ? focusState.sessionsToday : i2, (i3 & 256) != 0 ? focusState.sessionsDay : j4);
    }

    public final FocusMode component1() {
        return this.mode;
    }

    public final boolean component2() {
        return this.running;
    }

    public final long component3() {
        return this.endWall;
    }

    public final long component4() {
        return this.endElapsed;
    }

    public final int component5() {
        return this.boot;
    }

    public final long component6() {
        return this.remaining;
    }

    public final FocusMode component7() {
        return this.finished;
    }

    public final int component8() {
        return this.sessionsToday;
    }

    public final long component9() {
        return this.sessionsDay;
    }

    public final FocusState copy(FocusMode mode, boolean z, long j, long j2, int i, long j3, FocusMode focusMode, int i2, long j4) {
        Intrinsics.checkNotNullParameter(mode, "mode");
        return new FocusState(mode, z, j, j2, i, j3, focusMode, i2, j4);
    }

    public boolean equals(Object obj) {
        if (this == obj) {
            return true;
        }
        if (obj instanceof FocusState) {
            FocusState focusState = (FocusState) obj;
            return this.mode == focusState.mode && this.running == focusState.running && this.endWall == focusState.endWall && this.endElapsed == focusState.endElapsed && this.boot == focusState.boot && this.remaining == focusState.remaining && this.finished == focusState.finished && this.sessionsToday == focusState.sessionsToday && this.sessionsDay == focusState.sessionsDay;
        }
        return false;
    }

    public int hashCode() {
        int hashCode = ((((((((((this.mode.hashCode() * 31) + Boolean.hashCode(this.running)) * 31) + Long.hashCode(this.endWall)) * 31) + Long.hashCode(this.endElapsed)) * 31) + Integer.hashCode(this.boot)) * 31) + Long.hashCode(this.remaining)) * 31;
        FocusMode focusMode = this.finished;
        return ((((hashCode + (focusMode == null ? 0 : focusMode.hashCode())) * 31) + Integer.hashCode(this.sessionsToday)) * 31) + Long.hashCode(this.sessionsDay);
    }

    public String toString() {
        return "FocusState(mode=" + this.mode + ", running=" + this.running + ", endWall=" + this.endWall + ", endElapsed=" + this.endElapsed + ", boot=" + this.boot + ", remaining=" + this.remaining + ", finished=" + this.finished + ", sessionsToday=" + this.sessionsToday + ", sessionsDay=" + this.sessionsDay + ')';
    }

    public FocusState(FocusMode mode, boolean z, long j, long j2, int i, long j3, FocusMode focusMode, int i2, long j4) {
        Intrinsics.checkNotNullParameter(mode, "mode");
        this.mode = mode;
        this.running = z;
        this.endWall = j;
        this.endElapsed = j2;
        this.boot = i;
        this.remaining = j3;
        this.finished = focusMode;
        this.sessionsToday = i2;
        this.sessionsDay = j4;
    }

    public FocusState(FocusMode focusMode, boolean z, long j, long j2, int i, long j3, FocusMode focusMode2, int i2, long j4, int i3, DefaultConstructorMarker defaultConstructorMarker) {
        this((i3 & 1) != 0 ? FocusMode.FOCUS : focusMode, (i3 & 2) != 0 ? false : z, (i3 & 4) != 0 ? 0L : j, (i3 & 8) == 0 ? j2 : 0L, (i3 & 16) != 0 ? -1 : i, (i3 & 32) != 0 ? FocusMode.FOCUS.getDurationMs() : j3, (i3 & 64) != 0 ? null : focusMode2, (i3 & Uuid.SIZE_BITS) == 0 ? i2 : 0, (i3 & 256) != 0 ? -1L : j4);
    }

    public final FocusMode getMode() {
        return this.mode;
    }

    public final boolean getRunning() {
        return this.running;
    }

    public final long getEndWall() {
        return this.endWall;
    }

    public final long getEndElapsed() {
        return this.endElapsed;
    }

    public final int getBoot() {
        return this.boot;
    }

    public final long getRemaining() {
        return this.remaining;
    }

    public final FocusMode getFinished() {
        return this.finished;
    }

    public final int getSessionsToday() {
        return this.sessionsToday;
    }

    public final long getSessionsDay() {
        return this.sessionsDay;
    }
}

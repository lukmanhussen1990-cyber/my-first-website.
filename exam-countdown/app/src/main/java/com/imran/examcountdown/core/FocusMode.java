package com.imran.examcountdown.core;

import kotlin.Metadata;
import kotlin.enums.EnumEntries;
import kotlin.enums.EnumEntriesKt;

public enum FocusMode {
    FOCUS(25, "Focus"),
    BREAK(5, "Break");

    private final String label;
    private final int minutes;

    public static EnumEntries<FocusMode> getEntries() {
        return EnumEntriesKt.enumEntries(values());
    }

    FocusMode(int i2, String str2) {
        this.minutes = i2;
        this.label = str2;
    }

    public final String getLabel() {
        return this.label;
    }

    public final int getMinutes() {
        return this.minutes;
    }

    public final long getDurationMs() {
        return this.minutes * ModelKt.MINUTE;
    }
}

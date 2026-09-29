package com.imran.examcountdown.core;

import kotlin.Metadata;
import kotlin.enums.EnumEntries;
import kotlin.enums.EnumEntriesKt;

public enum FocusPhase {
    READY,
    RUNNING,
    PAUSED,
    FINISHED;


    public static EnumEntries<FocusPhase> getEntries() {
        return EnumEntriesKt.enumEntries(values());
    }

    FocusPhase() {
    }
}

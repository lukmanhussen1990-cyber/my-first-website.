package com.imran.examcountdown.core;

import kotlin.Metadata;
import kotlin.enums.EnumEntries;
import kotlin.enums.EnumEntriesKt;

public enum DoneReason {
    DURATION_ENDED,
    MARKED_DONE,
    NEXT_STARTED,
    DATE_PASSED;


    public static EnumEntries<DoneReason> getEntries() {
        return EnumEntriesKt.enumEntries(values());
    }

    DoneReason() {
    }
}

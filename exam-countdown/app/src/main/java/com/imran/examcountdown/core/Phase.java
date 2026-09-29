package com.imran.examcountdown.core;

import kotlin.Metadata;
import kotlin.enums.EnumEntries;
import kotlin.enums.EnumEntriesKt;

public enum Phase {
    UPCOMING,
    LIVE,
    DONE;


    public static EnumEntries<Phase> getEntries() {
        return EnumEntriesKt.enumEntries(values());
    }

    Phase() {
    }
}

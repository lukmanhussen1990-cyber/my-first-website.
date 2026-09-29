package com.imran.examcountdown.core;

import kotlin.Metadata;
import kotlin.enums.EnumEntries;
import kotlin.enums.EnumEntriesKt;

public enum ReminderKind {
    DAY_BEFORE,
    HOUR_BEFORE;


    public static EnumEntries<ReminderKind> getEntries() {
        return EnumEntriesKt.enumEntries(values());
    }

    ReminderKind() {
    }
}

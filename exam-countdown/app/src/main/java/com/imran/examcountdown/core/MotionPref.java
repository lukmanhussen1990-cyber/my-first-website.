package com.imran.examcountdown.core;

import kotlin.Metadata;
import kotlin.enums.EnumEntries;
import kotlin.enums.EnumEntriesKt;

public enum MotionPref {
    SYSTEM("System"),
    REDUCED("Reduced"),
    FULL("Full");

    private final String label;

    public static EnumEntries<MotionPref> getEntries() {
        return EnumEntriesKt.enumEntries(values());
    }

    MotionPref(String str2) {
        this.label = str2;
    }

    public final String getLabel() {
        return this.label;
    }
}

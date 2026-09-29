package com.imran.examcountdown.core;

import kotlin.Metadata;
import kotlin.enums.EnumEntries;
import kotlin.enums.EnumEntriesKt;

public enum ThemeMode {
    SYSTEM("System"),
    LIGHT("Light"),
    DARK("Dark");

    private final String label;

    public static EnumEntries<ThemeMode> getEntries() {
        return EnumEntriesKt.enumEntries(values());
    }

    ThemeMode(String str2) {
        this.label = str2;
    }

    public final String getLabel() {
        return this.label;
    }
}

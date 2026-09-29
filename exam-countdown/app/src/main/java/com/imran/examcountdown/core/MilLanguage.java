package com.imran.examcountdown.core;

import kotlin.Metadata;
import kotlin.enums.EnumEntries;
import kotlin.enums.EnumEntriesKt;

public enum MilLanguage {
    BENGALI("Bengali", "বাংলা"),
    HINDI("Hindi", "हिन्दी");

    private final String label;
    private final String nativeLabel;

    public static EnumEntries<MilLanguage> getEntries() {
        return EnumEntriesKt.enumEntries(values());
    }

    MilLanguage(String str2, String str3) {
        this.label = str2;
        this.nativeLabel = str3;
    }

    public final String getLabel() {
        return this.label;
    }

    public final String getNativeLabel() {
        return this.nativeLabel;
    }
}

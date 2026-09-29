package com.imran.examcountdown.core;

import kotlin.Metadata;
import kotlin.enums.EnumEntries;
import kotlin.enums.EnumEntriesKt;

public enum Elective {
    ADVANCED_MATHEMATICS("Advanced Mathematics", "Adv. Maths"),
    COMPUTER_SCIENCE("Computer Science", "Comp. Sci."),
    ARABIC("Arabic", "Arabic");

    private final String label;
    private final String shortLabel;

    public static EnumEntries<Elective> getEntries() {
        return EnumEntriesKt.enumEntries(values());
    }

    Elective(String str2, String str3) {
        this.label = str2;
        this.shortLabel = str3;
    }

    public final String getLabel() {
        return this.label;
    }

    public final String getShortLabel() {
        return this.shortLabel;
    }
}

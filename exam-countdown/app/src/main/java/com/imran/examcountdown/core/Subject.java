package com.imran.examcountdown.core;

import kotlin.Metadata;
import kotlin.enums.EnumEntries;
import kotlin.enums.EnumEntriesKt;

public enum Subject {
    MIL("MIL (Bengali / Hindi)"),
    ENGLISH_1("English-I"),
    SOCIAL_SCIENCE("Social Science"),
    GENERAL_SCIENCE("General Science"),
    GENERAL_MATHEMATICS("General Mathematics"),
    ENGLISH_2("English-II"),
    MORAL_SCIENCE("Moral Science"),
    ELECTIVE("Elective (Advanced Mathematics / Computer Science / Arabic)");

    private final String officialName;

    public static EnumEntries<Subject> getEntries() {
        return EnumEntriesKt.enumEntries(values());
    }

    Subject(String str2) {
        this.officialName = str2;
    }

    public final String getOfficialName() {
        return this.officialName;
    }
}

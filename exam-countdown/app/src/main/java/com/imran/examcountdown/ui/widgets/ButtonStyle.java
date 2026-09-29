package com.imran.examcountdown.ui.widgets;

import kotlin.Metadata;
import kotlin.enums.EnumEntries;
import kotlin.enums.EnumEntriesKt;

public enum ButtonStyle {
    PRIMARY,
    SECONDARY,
    GHOST,
    DANGER;


    public static EnumEntries<ButtonStyle> getEntries() {
        return EnumEntriesKt.enumEntries(values());
    }

    ButtonStyle() {
    }
}

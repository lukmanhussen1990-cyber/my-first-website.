package com.imran.examcountdown.core;

import kotlin.Metadata;
import kotlin.enums.EnumEntries;
import kotlin.enums.EnumEntriesKt;

public enum AvatarFrame {
    DEFAULT("Default", false),
    GOLD_ORBIT("Gold Orbit", true),
    EMERALD_WAVE("Emerald Wave", true),
    TWIN_COMETS("Twin Comets", true),
    GOLD_SHIMMER("Gold Shimmer", true),
    NONE("No Frame", false);

    private final boolean animated;
    private final String label;

    public static EnumEntries<AvatarFrame> getEntries() {
        return EnumEntriesKt.enumEntries(values());
    }

    AvatarFrame(String str2, boolean z) {
        this.label = str2;
        this.animated = z;
    }

    public final boolean getAnimated() {
        return this.animated;
    }

    public final String getLabel() {
        return this.label;
    }
}

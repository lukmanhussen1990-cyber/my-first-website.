package com.imran.examcountdown.ui;

import kotlin.Metadata;

public final class Colors {
    private final int bg;
    private final int danger;
    private final boolean dark;
    private final int gold;
    private final int goldSoft;
    private final int goldText;
    private final int green;
    private final int greenSoft;
    private final int greenText;
    private final int onGreen;
    private final int ripple;
    private final int separator;
    private final int surface;
    private final int surfaceAlt;
    private final int text;
    private final int text2;
    private final int text3;
    private final int track;

    public Colors(boolean z, int i, int i2, int i3, int i4, int i5, int i6, int i7, int i8, int i9, int i10, int i11, int i12, int i13, int i14, int i15, int i16, int i17) {
        this.dark = z;
        this.bg = i;
        this.surface = i2;
        this.surfaceAlt = i3;
        this.separator = i4;
        this.track = i5;
        this.text = i6;
        this.text2 = i7;
        this.text3 = i8;
        this.green = i9;
        this.onGreen = i10;
        this.greenSoft = i11;
        this.greenText = i12;
        this.gold = i13;
        this.goldText = i14;
        this.goldSoft = i15;
        this.danger = i16;
        this.ripple = i17;
    }

    public final boolean getDark() {
        return this.dark;
    }

    public final int getBg() {
        return this.bg;
    }

    public final int getSurface() {
        return this.surface;
    }

    public final int getSurfaceAlt() {
        return this.surfaceAlt;
    }

    public final int getSeparator() {
        return this.separator;
    }

    public final int getTrack() {
        return this.track;
    }

    public final int getText() {
        return this.text;
    }

    public final int getText2() {
        return this.text2;
    }

    public final int getText3() {
        return this.text3;
    }

    public final int getGreen() {
        return this.green;
    }

    public final int getOnGreen() {
        return this.onGreen;
    }

    public final int getGreenSoft() {
        return this.greenSoft;
    }

    public final int getGreenText() {
        return this.greenText;
    }

    public final int getGold() {
        return this.gold;
    }

    public final int getGoldText() {
        return this.goldText;
    }

    public final int getGoldSoft() {
        return this.goldSoft;
    }

    public final int getDanger() {
        return this.danger;
    }

    public final int getRipple() {
        return this.ripple;
    }
}

package com.imran.examcountdown.ui;

import android.animation.TimeInterpolator;
import kotlin.Metadata;
import kotlin.jvm.internal.DefaultConstructorMarker;

public final class Spring implements TimeInterpolator {
    private final float damping;
    public static final Companion Companion = new Companion(null);
    private static final Spring gentle = new Spring(0.78f);
    private static final Spring bouncy = new Spring(0.5f);
    private static final Spring soft = new Spring(0.66f);

    public Spring() {
        this(0.0f, 1, null);
    }

    public Spring(float f) {
        this.damping = f;
    }

    public Spring(float f, int i, DefaultConstructorMarker defaultConstructorMarker) {
        this((i & 1) != 0 ? 0.7f : f);
    }

    public static final Spring access$getBouncy$cp() {
        return bouncy;
    }

    public static final Spring access$getGentle$cp() {
        return gentle;
    }

    public static final Spring access$getSoft$cp() {
        return soft;
    }

    @Override
    public float getInterpolation(float f) {
        return FxKt.spring(f, this.damping);
    }

    public static final class Companion {
        public Companion(DefaultConstructorMarker defaultConstructorMarker) {
            this();
        }

        private Companion() {
        }

        public final Spring getGentle() {
            return Spring.access$getGentle$cp();
        }

        public final Spring getBouncy() {
            return Spring.access$getBouncy$cp();
        }

        public final Spring getSoft() {
            return Spring.access$getSoft$cp();
        }
    }
}

package com.imran.examcountdown.ui;

import android.animation.TimeInterpolator;
import android.view.animation.PathInterpolator;
import kotlin.Metadata;

public final class Ease {
    public static final Ease INSTANCE = new Ease();
    private static final TimeInterpolator out = new PathInterpolator(0.05f, 0.7f, 0.1f, 1.0f);
    private static final TimeInterpolator exit = new PathInterpolator(0.3f, 0.0f, 0.8f, 0.15f);
    private static final TimeInterpolator inOut = new PathInterpolator(0.2f, 0.0f, 0.0f, 1.0f);

    public final float cubicIn(float f) {
        return f * f * f;
    }

    public final float cubicInOut(float f) {
        if (f < 0.5f) {
            return 4.0f * f * f * f;
        }
        float f2 = (f * (-2.0f)) + 2.0f;
        return 1.0f - (((f2 * f2) * f2) / 2.0f);
    }

    public final float cubicOut(float f) {
        float f2 = 1.0f - f;
        return 1.0f - ((f2 * f2) * f2);
    }

    public final float quintOut(float f) {
        float f2 = 1.0f - f;
        return 1.0f - ((((f2 * f2) * f2) * f2) * f2);
    }

    private Ease() {
    }

    public final TimeInterpolator getOut() {
        return out;
    }

    public final TimeInterpolator getExit() {
        return exit;
    }

    public final TimeInterpolator getInOut() {
        return inOut;
    }
}

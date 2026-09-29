package com.imran.examcountdown.ui;

import android.os.Build;
import android.view.View;
import kotlin.Metadata;
import kotlin.jvm.internal.Intrinsics;

public final class Haptics {
    public static final Haptics INSTANCE = new Haptics();
    private static volatile boolean enabled = true;

    private Haptics() {
    }

    public final boolean getEnabled() {
        return enabled;
    }

    public final void setEnabled(boolean z) {
        enabled = z;
    }

    public final void tap(View view) {
        Intrinsics.checkNotNullParameter(view, "view");
        if (enabled) {
            view.performHapticFeedback(6);
        }
    }

    public final void confirm(View view) {
        Intrinsics.checkNotNullParameter(view, "view");
        if (enabled) {
            view.performHapticFeedback(Build.VERSION.SDK_INT >= 30 ? 16 : 1);
        }
    }
}

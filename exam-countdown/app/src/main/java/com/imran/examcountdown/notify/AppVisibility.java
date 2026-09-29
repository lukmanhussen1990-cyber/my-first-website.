package com.imran.examcountdown.notify;

import kotlin.Metadata;

public final class AppVisibility {
    public static final AppVisibility INSTANCE = new AppVisibility();
    private static volatile boolean resumed;

    private AppVisibility() {
    }

    public final boolean getResumed() {
        return resumed;
    }

    public final void setResumed(boolean z) {
        resumed = z;
    }
}

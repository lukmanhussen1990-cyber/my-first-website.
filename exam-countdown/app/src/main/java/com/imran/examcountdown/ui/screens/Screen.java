package com.imran.examcountdown.ui.screens;

import android.content.Context;
import android.view.View;
import com.imran.examcountdown.MainActivity;
import com.imran.examcountdown.core.Season;
import kotlin.Metadata;
import kotlin.jvm.internal.Intrinsics;

public abstract class Screen {
    private final MainActivity host;

    public void applyInsets(int i, int i2) {
    }

    public abstract View getRoot();

    public void onDataChanged() {
    }

    public void onHide() {
    }

    public void onMotionChanged() {
    }

    public void onShow(boolean z) {
    }

    public void tick(Season season) {
        Intrinsics.checkNotNullParameter(season, "season");
    }

    public Screen(MainActivity host) {
        Intrinsics.checkNotNullParameter(host, "host");
        this.host = host;
    }

    public final MainActivity getHost() {
        return this.host;
    }

    public final Context getCtx() {
        return this.host;
    }

    public long nextTickDelay(long j) {
        long j2 = 1000;
        return j2 - (j % j2);
    }
}

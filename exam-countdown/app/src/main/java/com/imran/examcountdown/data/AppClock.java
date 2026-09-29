package com.imran.examcountdown.data;

import android.content.Context;
import android.os.SystemClock;
import android.provider.Settings;
import com.imran.examcountdown.core.Moment;
import java.time.Instant;
import java.time.ZoneId;
import kotlin.Metadata;
import kotlin.jvm.internal.Intrinsics;

public final class AppClock {
    public static final AppClock INSTANCE = new AppClock();
    private static volatile Long pinnedWall;

    private AppClock() {
    }

    public final Long getPinnedWall() {
        return pinnedWall;
    }

    public final void setPinnedWall(Long l) {
        pinnedWall = l;
    }

    public final long now() {
        Long l = pinnedWall;
        return l != null ? l.longValue() : System.currentTimeMillis();
    }

    public final Moment moment(Context context) {
        Intrinsics.checkNotNullParameter(context, "context");
        return new Moment(now(), SystemClock.elapsedRealtime(), bootCount(context));
    }

    public final long localEpochDay() {
        return Instant.ofEpochMilli(now()).atZone(ZoneId.systemDefault()).toLocalDate().toEpochDay();
    }

    private final int bootCount(Context context) {
        try {
            return Settings.Global.getInt(context.getContentResolver(), "boot_count", -1);
        } catch (RuntimeException unused) {
            return -1;
        }
    }
}

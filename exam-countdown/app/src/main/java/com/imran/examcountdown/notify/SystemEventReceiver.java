package com.imran.examcountdown.notify;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import kotlin.Metadata;
import kotlin.jvm.internal.Intrinsics;

public final class SystemEventReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        Intrinsics.checkNotNullParameter(context, "context");
        Intrinsics.checkNotNullParameter(intent, "intent");
        String action = intent.getAction();
        if (action != null) {
            switch (action.hashCode()) {
                case 502473491:
                    if (!action.equals("android.intent.action.TIMEZONE_CHANGED")) {
                        return;
                    }
                    break;
                case 505380757:
                    if (!action.equals("android.intent.action.TIME_SET")) {
                        return;
                    }
                    break;
                case 798292259:
                    if (!action.equals("android.intent.action.BOOT_COMPLETED")) {
                        return;
                    }
                    break;
                case 1737074039:
                    if (!action.equals("android.intent.action.MY_PACKAGE_REPLACED")) {
                        return;
                    }
                    break;
                default:
                    return;
            }
            ReminderScheduler.INSTANCE.onWake(context);
        }
    }
}

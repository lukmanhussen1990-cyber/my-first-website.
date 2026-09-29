package com.imran.examcountdown;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import kotlin.Metadata;
import kotlin.jvm.internal.Intrinsics;

public final class MainActivity$powerReceiver$1 extends BroadcastReceiver {
    final MainActivity this$0;

    public MainActivity$powerReceiver$1(MainActivity mainActivity) {
        this.this$0 = mainActivity;
    }

    @Override
    public void onReceive(Context context, Intent intent) {
        Intrinsics.checkNotNullParameter(context, "context");
        Intrinsics.checkNotNullParameter(intent, "intent");
        this.this$0.applyMotion();
    }
}

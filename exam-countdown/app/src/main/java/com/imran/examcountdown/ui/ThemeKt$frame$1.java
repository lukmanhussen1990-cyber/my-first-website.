package com.imran.examcountdown.ui;

import android.widget.FrameLayout;
import kotlin.Metadata;
import kotlin.Unit;
import kotlin.jvm.functions.Function1;
import kotlin.jvm.internal.Intrinsics;

public final class ThemeKt$frame$1 implements Function1<FrameLayout, Unit> {
    public static final ThemeKt$frame$1 INSTANCE = new ThemeKt$frame$1();

    public final void invoke2(FrameLayout frameLayout) {
        Intrinsics.checkNotNullParameter(frameLayout, "<this>");
    }

    @Override
    public Unit invoke(FrameLayout frameLayout) {
        invoke2(frameLayout);
        return Unit.INSTANCE;
    }
}

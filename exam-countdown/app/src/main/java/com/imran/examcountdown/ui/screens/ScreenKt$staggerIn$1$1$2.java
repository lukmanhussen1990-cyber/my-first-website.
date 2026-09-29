package com.imran.examcountdown.ui.screens;

import android.animation.Animator;
import android.animation.AnimatorListenerAdapter;
import android.view.View;
import kotlin.Metadata;
import kotlin.jvm.internal.Intrinsics;

public final class ScreenKt$staggerIn$1$1$2 extends AnimatorListenerAdapter {
    final View $v;

    public ScreenKt$staggerIn$1$1$2(View view) {
        this.$v = view;
    }

    @Override
    public void onAnimationEnd(Animator animation) {
        Intrinsics.checkNotNullParameter(animation, "animation");
        ScreenKt.access$settle(this.$v);
        ScreenKt.access$getEntrances$p().remove(this.$v);
    }
}

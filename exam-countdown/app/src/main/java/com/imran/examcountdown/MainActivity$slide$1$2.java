package com.imran.examcountdown;

import android.animation.Animator;
import android.animation.AnimatorListenerAdapter;
import android.view.View;
import kotlin.Metadata;
import kotlin.jvm.internal.Intrinsics;

public final class MainActivity$slide$1$2 extends AnimatorListenerAdapter {
    final View $incoming;
    final View $outgoing;
    final MainActivity this$0;

    public MainActivity$slide$1$2(View view, MainActivity mainActivity, View view2) {
        this.$outgoing = view;
        this.this$0 = mainActivity;
        this.$incoming = view2;
    }

    @Override
    public void onAnimationEnd(Animator animation) {
        Intrinsics.checkNotNullParameter(animation, "animation");
        this.$outgoing.setVisibility(8);
        MainActivity.access$rest(this.this$0, this.$outgoing);
        MainActivity.access$rest(this.this$0, this.$incoming);
        MainActivity.access$setTransition$p(this.this$0, null);
    }
}

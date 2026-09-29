package com.imran.examcountdown;

import android.animation.Animator;
import android.animation.AnimatorListenerAdapter;
import android.widget.FrameLayout;
import com.imran.examcountdown.ui.widgets.GoldRipple;
import kotlin.Metadata;
import kotlin.jvm.internal.Intrinsics;

public final class MainActivity$ripple$1$2 extends AnimatorListenerAdapter {
    final GoldRipple $drawable;
    final MainActivity this$0;

    public MainActivity$ripple$1$2(MainActivity mainActivity, GoldRipple goldRipple) {
        this.this$0 = mainActivity;
        this.$drawable = goldRipple;
    }

    @Override
    public void onAnimationEnd(Animator animation) {
        Intrinsics.checkNotNullParameter(animation, "animation");
        FrameLayout access$getRoot$p = MainActivity.access$getRoot$p(this.this$0);
        if (access$getRoot$p == null) {
            Intrinsics.throwUninitializedPropertyAccessException("root");
            access$getRoot$p = null;
        }
        access$getRoot$p.getOverlay().remove(this.$drawable);
    }
}

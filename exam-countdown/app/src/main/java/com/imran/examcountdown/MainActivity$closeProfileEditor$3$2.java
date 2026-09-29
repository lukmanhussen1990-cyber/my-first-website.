package com.imran.examcountdown;

import android.animation.Animator;
import android.animation.AnimatorListenerAdapter;
import android.widget.FrameLayout;
import com.imran.examcountdown.ui.screens.ProfileEditor;
import com.imran.examcountdown.ui.widgets.AvatarView;
import kotlin.Metadata;
import kotlin.jvm.internal.Intrinsics;

public final class MainActivity$closeProfileEditor$3$2 extends AnimatorListenerAdapter {
    final ProfileEditor $e;
    final AvatarView $fly;
    final AvatarView $target;
    final MainActivity this$0;

    public MainActivity$closeProfileEditor$3$2(MainActivity mainActivity, ProfileEditor profileEditor, AvatarView avatarView, AvatarView avatarView2) {
        this.this$0 = mainActivity;
        this.$e = profileEditor;
        this.$fly = avatarView;
        this.$target = avatarView2;
    }

    @Override
    public void onAnimationEnd(Animator animation) {
        Intrinsics.checkNotNullParameter(animation, "animation");
        FrameLayout access$getRoot$p = MainActivity.access$getRoot$p(this.this$0);
        if (access$getRoot$p == null) {
            Intrinsics.throwUninitializedPropertyAccessException("root");
            access$getRoot$p = null;
        }
        access$getRoot$p.removeView(this.$e.getRoot());
        FrameLayout access$getRoot$p2 = MainActivity.access$getRoot$p(this.this$0);
        if (access$getRoot$p2 == null) {
            Intrinsics.throwUninitializedPropertyAccessException("root");
            access$getRoot$p2 = null;
        }
        access$getRoot$p2.getOverlay().remove(this.$fly);
        if (MainActivity.access$getFlying$p(this.this$0) == this.$fly) {
            MainActivity.access$setFlying$p(this.this$0, null);
        }
        this.$target.setVisibility(0);
        MainActivity.access$setProfileMotion$p(this.this$0, null);
    }
}

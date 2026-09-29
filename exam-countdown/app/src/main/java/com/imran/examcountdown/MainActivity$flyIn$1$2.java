package com.imran.examcountdown;

import android.animation.Animator;
import android.animation.AnimatorListenerAdapter;
import android.widget.FrameLayout;
import com.imran.examcountdown.ui.screens.ProfileEditor;
import com.imran.examcountdown.ui.widgets.AvatarView;
import kotlin.Metadata;
import kotlin.jvm.internal.Intrinsics;

public final class MainActivity$flyIn$1$2 extends AnimatorListenerAdapter {
    final ProfileEditor $e;
    final AvatarView $fly;
    final AvatarView $source;
    final MainActivity this$0;

    public MainActivity$flyIn$1$2(MainActivity mainActivity, AvatarView avatarView, ProfileEditor profileEditor, AvatarView avatarView2) {
        this.this$0 = mainActivity;
        this.$fly = avatarView;
        this.$e = profileEditor;
        this.$source = avatarView2;
    }

    @Override
    public void onAnimationEnd(Animator animation) {
        Intrinsics.checkNotNullParameter(animation, "animation");
        FrameLayout access$getRoot$p = MainActivity.access$getRoot$p(this.this$0);
        if (access$getRoot$p == null) {
            Intrinsics.throwUninitializedPropertyAccessException("root");
            access$getRoot$p = null;
        }
        access$getRoot$p.getOverlay().remove(this.$fly);
        if (MainActivity.access$getFlying$p(this.this$0) == this.$fly) {
            MainActivity.access$setFlying$p(this.this$0, null);
        }
        this.$e.getAvatar().setVisibility(0);
        this.$source.setVisibility(0);
        this.$e.setBackdrop(1.0f);
        this.$e.revealControls();
        MainActivity.access$setProfileMotion$p(this.this$0, null);
    }
}

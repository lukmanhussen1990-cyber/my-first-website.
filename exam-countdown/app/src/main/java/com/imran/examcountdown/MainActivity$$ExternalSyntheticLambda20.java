package com.imran.examcountdown;

import android.animation.ValueAnimator;
import android.graphics.Rect;
import com.imran.examcountdown.ui.screens.ProfileEditor;
import com.imran.examcountdown.ui.widgets.AvatarView;

public final class MainActivity$$ExternalSyntheticLambda20 implements ValueAnimator.AnimatorUpdateListener {
    public final MainActivity f$0;
    public final AvatarView f$1;
    public final Rect f$2;
    public final Rect f$3;
    public final Rect f$4;
    public final ProfileEditor f$5;

    public MainActivity$$ExternalSyntheticLambda20(MainActivity mainActivity, AvatarView avatarView, Rect rect, Rect rect2, Rect rect3, ProfileEditor profileEditor) {
        this.f$0 = mainActivity;
        this.f$1 = avatarView;
        this.f$2 = rect;
        this.f$3 = rect2;
        this.f$4 = rect3;
        this.f$5 = profileEditor;
    }

    @Override
    public final void onAnimationUpdate(ValueAnimator valueAnimator) {
        MainActivity.$r8$lambda$nfn9aXN55zm9bQ0bYJNvvjbZ8Os(this.f$0, this.f$1, this.f$2, this.f$3, this.f$4, this.f$5, valueAnimator);
    }
}

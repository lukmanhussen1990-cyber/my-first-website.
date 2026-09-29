package com.imran.examcountdown;

import android.animation.ValueAnimator;
import android.graphics.Rect;
import com.imran.examcountdown.ui.screens.ProfileEditor;
import com.imran.examcountdown.ui.widgets.AvatarView;

public final class MainActivity$$ExternalSyntheticLambda13 implements ValueAnimator.AnimatorUpdateListener {
    public final MainActivity f$0;
    public final AvatarView f$1;
    public final Rect f$2;
    public final Rect f$3;
    public final ProfileEditor f$4;

    public MainActivity$$ExternalSyntheticLambda13(MainActivity mainActivity, AvatarView avatarView, Rect rect, Rect rect2, ProfileEditor profileEditor) {
        this.f$0 = mainActivity;
        this.f$1 = avatarView;
        this.f$2 = rect;
        this.f$3 = rect2;
        this.f$4 = profileEditor;
    }

    @Override
    public final void onAnimationUpdate(ValueAnimator valueAnimator) {
        MainActivity.$r8$lambda$VAZyuoFKQr5AGbpus3iH8Uip6Gg(this.f$0, this.f$1, this.f$2, this.f$3, this.f$4, valueAnimator);
    }
}

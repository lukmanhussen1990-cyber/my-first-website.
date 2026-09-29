package com.imran.examcountdown.ui.widgets;

import android.animation.ValueAnimator;

public final class SegmentedControl$$ExternalSyntheticLambda0 implements ValueAnimator.AnimatorUpdateListener {
    public final SegmentedControl f$0;
    public final float f$1;
    public final float f$2;

    public SegmentedControl$$ExternalSyntheticLambda0(SegmentedControl segmentedControl, float f, float f2) {
        this.f$0 = segmentedControl;
        this.f$1 = f;
        this.f$2 = f2;
    }

    @Override
    public final void onAnimationUpdate(ValueAnimator valueAnimator) {
        SegmentedControl.$r8$lambda$k6UpmLcDTEBNzpjC7qTZpBCsKTE(this.f$0, this.f$1, this.f$2, valueAnimator);
    }
}

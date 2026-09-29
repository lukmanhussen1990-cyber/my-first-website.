package com.imran.examcountdown.ui;

import android.animation.ValueAnimator;
import android.graphics.Color;
import android.view.View;
import kotlin.Metadata;
import kotlin.jvm.internal.Intrinsics;
import kotlin.ranges.RangesKt;

public final class FxKt {
    public static void $r8$lambda$Ndo_JRXGgVRZZglLWk_eD5_Yt7A(View view, ValueAnimator valueAnimator) {
        fadeTo$lambda$1$lambda$0(view, valueAnimator);
    }

    public static final float lerp(float f, float f2, float f3) {
        return f + ((f2 - f) * f3);
    }

    public static final float spring(float f, float f2) {
        float cos;
        if (f <= 0.0f) {
            return 0.0f;
        }
        if (f >= 1.0f) {
            return 1.0f;
        }
        float coerceIn = RangesKt.coerceIn(f2, 0.05f, 1.0f);
        float f3 = 7.0f / coerceIn;
        float exp = (float) Math.exp((-coerceIn) * f3 * f);
        if (coerceIn >= 0.999f) {
            cos = exp * ((f3 * f) + 1.0f);
        } else {
            float sqrt = ((float) Math.sqrt(1.0f - (coerceIn * coerceIn))) * f3;
            double d = f * sqrt;
            cos = exp * (((float) Math.cos(d)) + (((coerceIn * f3) / sqrt) * ((float) Math.sin(d))));
        }
        return 1.0f - cos;
    }

    public static final float window(float f, float f2, float f3) {
        return RangesKt.coerceIn((f - f2) / f3, 0.0f, 1.0f);
    }

    public static final int lerpColor(int i, int i2, float f) {
        float coerceIn = RangesKt.coerceIn(f, 0.0f, 1.0f);
        return Color.argb((int) (Color.alpha(i) + ((Color.alpha(i2) - Color.alpha(i)) * coerceIn)), (int) (Color.red(i) + ((Color.red(i2) - Color.red(i)) * coerceIn)), (int) (Color.green(i) + ((Color.green(i2) - Color.green(i)) * coerceIn)), (int) (Color.blue(i) + ((Color.blue(i2) - Color.blue(i)) * coerceIn)));
    }

    public static ValueAnimator fadeTo$default(View view, float f, long j, long j2, int i, Object obj) {
        if ((i & 4) != 0) {
            j2 = 0;
        }
        return fadeTo(view, f, j, j2);
    }

    public static final ValueAnimator fadeTo(View view, float f, long j, long j2) {
        Intrinsics.checkNotNullParameter(view, "<this>");
        ValueAnimator ofFloat = ValueAnimator.ofFloat(view.getAlpha(), f);
        ofFloat.setDuration(j);
        ofFloat.setStartDelay(j2);
        ofFloat.setInterpolator(Ease.INSTANCE.getOut());
        ofFloat.addUpdateListener(new FxKt$$ExternalSyntheticLambda0(view));
        ofFloat.start();
        Intrinsics.checkNotNullExpressionValue(ofFloat, "apply(...)");
        return ofFloat;
    }

    private static final void fadeTo$lambda$1$lambda$0(View view, ValueAnimator it) {
        Intrinsics.checkNotNullParameter(it, "it");
        Object animatedValue = it.getAnimatedValue();
        Intrinsics.checkNotNull(animatedValue, "null cannot be cast to non-null type kotlin.Float");
        view.setAlpha(((Float) animatedValue).floatValue());
    }
}

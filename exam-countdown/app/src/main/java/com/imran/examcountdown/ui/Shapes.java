package com.imran.examcountdown.ui;

import android.content.Context;
import android.content.res.ColorStateList;
import android.graphics.drawable.Drawable;
import android.graphics.drawable.GradientDrawable;
import android.graphics.drawable.RippleDrawable;
import kotlin.Metadata;
import kotlin.jvm.internal.Intrinsics;
import kotlin.ranges.RangesKt;

public final class Shapes {
    public static final Shapes INSTANCE = new Shapes();

    private Shapes() {
    }

    public static GradientDrawable rounded$default(Shapes shapes, Context context, Number number, int i, int i2, Number number2, int i3, Object obj) {
        if ((i3 & 8) != 0) {
            i2 = 0;
        }
        int i4 = i2;
        if ((i3 & 16) != 0) {
            number2 = (Number) 1;
        }
        return shapes.rounded(context, number, i, i4, number2);
    }

    public final GradientDrawable rounded(Context context, Number radiusDp, int i, int i2, Number strokeDp) {
        Intrinsics.checkNotNullParameter(context, "context");
        Intrinsics.checkNotNullParameter(radiusDp, "radiusDp");
        Intrinsics.checkNotNullParameter(strokeDp, "strokeDp");
        GradientDrawable gradientDrawable = new GradientDrawable();
        gradientDrawable.setShape(0);
        gradientDrawable.setCornerRadius(ThemeKt.dpf(context, radiusDp));
        gradientDrawable.setColor(i);
        if (i2 != 0) {
            gradientDrawable.setStroke(RangesKt.coerceAtLeast(ThemeKt.dp(context, strokeDp), 1), i2);
        }
        return gradientDrawable;
    }

    public static GradientDrawable oval$default(Shapes shapes, int i, int i2, int i3, int i4, Object obj) {
        if ((i4 & 2) != 0) {
            i2 = 0;
        }
        if ((i4 & 4) != 0) {
            i3 = 0;
        }
        return shapes.oval(i, i2, i3);
    }

    public final GradientDrawable oval(int i, int i2, int i3) {
        GradientDrawable gradientDrawable = new GradientDrawable();
        gradientDrawable.setShape(1);
        gradientDrawable.setColor(i);
        if (i2 != 0) {
            gradientDrawable.setStroke(i3, i2);
        }
        return gradientDrawable;
    }

    public final RippleDrawable ripple(Context context, Drawable drawable, Number radiusDp) {
        Intrinsics.checkNotNullParameter(context, "context");
        Intrinsics.checkNotNullParameter(radiusDp, "radiusDp");
        return new RippleDrawable(ColorStateList.valueOf(Ui.INSTANCE.getC().getRipple()), drawable, rounded$default(this, context, radiusDp, Ui.INSTANCE.getC().getText(), 0, null, 24, null));
    }
}

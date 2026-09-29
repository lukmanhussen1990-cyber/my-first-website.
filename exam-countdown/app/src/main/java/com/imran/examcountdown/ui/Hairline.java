package com.imran.examcountdown.ui;

import android.content.Context;
import android.view.View;
import kotlin.Metadata;
import kotlin.jvm.internal.Intrinsics;
import kotlin.ranges.RangesKt;

public final class Hairline extends View {
    private final int thickness;

    /* JADX WARN: 'super' call moved to the top of the method (can break code semantics) */
    public Hairline(Context context) {
        super(context);
        Intrinsics.checkNotNullParameter(context, "context");
        this.thickness = RangesKt.coerceAtLeast(1, (int) (context.getResources().getDisplayMetrics().density * 0.75f));
        setBackgroundColor(Ui.INSTANCE.getC().getSeparator());
        setImportantForAccessibility(2);
    }

    @Override
    protected void onMeasure(int i, int i2) {
        setMeasuredDimension(View.MeasureSpec.getSize(i), this.thickness);
    }
}

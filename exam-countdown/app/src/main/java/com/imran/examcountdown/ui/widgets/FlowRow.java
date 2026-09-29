package com.imran.examcountdown.ui.widgets;

import android.content.Context;
import android.view.View;
import android.view.ViewGroup;
import com.imran.examcountdown.ui.ThemeKt;
import kotlin.Metadata;
import kotlin.jvm.internal.IntCompanionObject;
import kotlin.jvm.internal.Intrinsics;

public final class FlowRow extends ViewGroup {
    private int horizontalGap;
    private int verticalGap;

    /* JADX WARN: 'super' call moved to the top of the method (can break code semantics) */
    public FlowRow(Context context) {
        super(context);
        Intrinsics.checkNotNullParameter(context, "context");
        this.horizontalGap = ThemeKt.dp(context, (Number) 16);
        this.verticalGap = ThemeKt.dp(context, (Number) 6);
    }

    public final int getHorizontalGap() {
        return this.horizontalGap;
    }

    public final void setHorizontalGap(int i) {
        this.horizontalGap = i;
    }

    public final int getVerticalGap() {
        return this.verticalGap;
    }

    public final void setVerticalGap(int i) {
        this.verticalGap = i;
    }

    @Override
    protected void onMeasure(int i, int i2) {
        int size = (View.MeasureSpec.getSize(i) - getPaddingLeft()) - getPaddingRight();
        int childCount = getChildCount();
        int i3 = 0;
        int i4 = 0;
        int i5 = 0;
        int i6 = 0;
        for (int i7 = 0; i7 < childCount; i7++) {
            View childAt = getChildAt(i7);
            if (childAt.getVisibility() != 8) {
                measureChild(childAt, View.MeasureSpec.makeMeasureSpec(size, IntCompanionObject.MIN_VALUE), i2);
                int measuredWidth = childAt.getMeasuredWidth();
                if (i6 > 0 && i6 + measuredWidth > size) {
                    i3 += i4 + this.verticalGap;
                    i4 = 0;
                    i6 = 0;
                }
                int i8 = this.horizontalGap;
                i6 += measuredWidth + i8;
                i5 = Math.max(i5, i6 - i8);
                i4 = Math.max(i4, childAt.getMeasuredHeight());
            }
        }
        setMeasuredDimension(ViewGroup.resolveSize(i5 + getPaddingLeft() + getPaddingRight(), i), ViewGroup.resolveSize(i3 + i4 + getPaddingTop() + getPaddingBottom(), i2));
    }

    @Override
    protected void onLayout(boolean z, int i, int i2, int i3, int i4) {
        int paddingLeft = ((i3 - i) - getPaddingLeft()) - getPaddingRight();
        int childCount = getChildCount();
        int i5 = 0;
        int i6 = 0;
        int i7 = 0;
        for (int i8 = 0; i8 < childCount; i8++) {
            View childAt = getChildAt(i8);
            if (childAt.getVisibility() != 8) {
                int measuredWidth = childAt.getMeasuredWidth();
                if (i5 > 0 && i5 + measuredWidth > paddingLeft) {
                    i6 += i7 + this.verticalGap;
                    i5 = 0;
                    i7 = 0;
                }
                childAt.layout(getPaddingLeft() + i5, getPaddingTop() + i6, getPaddingLeft() + i5 + measuredWidth, getPaddingTop() + i6 + childAt.getMeasuredHeight());
                i5 += measuredWidth + this.horizontalGap;
                i7 = Math.max(i7, childAt.getMeasuredHeight());
            }
        }
    }
}

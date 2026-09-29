package com.imran.examcountdown.ui.widgets;

import android.content.Context;
import android.view.View;
import android.view.ViewGroup;
import java.util.ArrayList;
import java.util.Iterator;
import java.util.List;
import kotlin.Metadata;
import kotlin.collections.CollectionsKt;
import kotlin.collections.IntIterator;
import kotlin.jvm.internal.Intrinsics;
import kotlin.ranges.IntRange;
import kotlin.ranges.RangesKt;

public final class ButtonRow extends ViewGroup {
    private final int gap;
    private boolean stacked;

    /* JADX WARN: 'super' call moved to the top of the method (can break code semantics) */
    public ButtonRow(Context context, int i) {
        super(context);
        Intrinsics.checkNotNullParameter(context, "context");
        this.gap = i;
    }

    public final boolean getStacked() {
        return this.stacked;
    }

    private final List<View> shown() {
        IntRange until = RangesKt.until(0, getChildCount());
        ArrayList arrayList = new ArrayList(CollectionsKt.collectionSizeOrDefault(until, 10));
        Iterator<Integer> it = until.iterator();
        while (it.hasNext()) {
            arrayList.add(getChildAt(((IntIterator) it).nextInt()));
        }
        ArrayList arrayList2 = new ArrayList();
        for (Object obj : arrayList) {
            if (((View) obj).getVisibility() != 8) {
                arrayList2.add(obj);
            }
        }
        return arrayList2;
    }

    @Override
    protected void onMeasure(int i, int i2) {
        int size = (View.MeasureSpec.getSize(i) - getPaddingLeft()) - getPaddingRight();
        List<View> shown = shown();
        int makeMeasureSpec = View.MeasureSpec.makeMeasureSpec(0, 0);
        int coerceAtLeast = this.gap * RangesKt.coerceAtLeast(shown.size() - 1, 0);
        int i3 = 0;
        for (View view : shown) {
            view.measure(makeMeasureSpec, makeMeasureSpec);
            coerceAtLeast += view.getMeasuredWidth();
            i3 = Math.max(i3, view.getMeasuredHeight());
        }
        boolean z = coerceAtLeast > size;
        this.stacked = z;
        if (z) {
            int coerceAtLeast2 = this.gap * RangesKt.coerceAtLeast(shown.size() - 1, 0);
            int makeMeasureSpec2 = View.MeasureSpec.makeMeasureSpec(size, 1073741824);
            i3 = coerceAtLeast2;
            for (View view2 : shown) {
                view2.measure(makeMeasureSpec2, makeMeasureSpec);
                i3 += view2.getMeasuredHeight();
            }
        }
        setMeasuredDimension(ViewGroup.resolveSize(size + getPaddingLeft() + getPaddingRight(), i), i3 + getPaddingTop() + getPaddingBottom());
    }

    @Override
    protected void onLayout(boolean z, int i, int i2, int i3, int i4) {
        List<View> shown = shown();
        if (this.stacked) {
            int paddingTop = getPaddingTop();
            for (View view : shown) {
                view.layout(getPaddingLeft(), paddingTop, getPaddingLeft() + view.getMeasuredWidth(), view.getMeasuredHeight() + paddingTop);
                paddingTop += view.getMeasuredHeight() + this.gap;
            }
            return;
        }
        int i5 = 0;
        for (View view2 : shown) {
            i5 += view2.getMeasuredWidth();
        }
        int paddingLeft = getPaddingLeft() + (((((i3 - i) - getPaddingLeft()) - getPaddingRight()) - (i5 + (this.gap * RangesKt.coerceAtLeast(shown.size() - 1, 0)))) / 2);
        int paddingTop2 = ((i4 - i2) - getPaddingTop()) - getPaddingBottom();
        for (View view3 : shown) {
            int paddingTop3 = getPaddingTop() + ((paddingTop2 - view3.getMeasuredHeight()) / 2);
            view3.layout(paddingLeft, paddingTop3, view3.getMeasuredWidth() + paddingLeft, view3.getMeasuredHeight() + paddingTop3);
            paddingLeft += view3.getMeasuredWidth() + this.gap;
        }
    }
}

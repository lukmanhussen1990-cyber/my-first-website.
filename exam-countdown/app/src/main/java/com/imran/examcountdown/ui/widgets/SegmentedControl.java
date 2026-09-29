package com.imran.examcountdown.ui.widgets;

import android.animation.ValueAnimator;
import android.content.Context;
import android.view.View;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.TextView;
import com.imran.examcountdown.ui.Colors;
import com.imran.examcountdown.ui.Ease;
import com.imran.examcountdown.ui.Fonts;
import com.imran.examcountdown.ui.FxKt;
import com.imran.examcountdown.ui.Haptics;
import com.imran.examcountdown.ui.Shapes;
import com.imran.examcountdown.ui.ThemeKt;
import com.imran.examcountdown.ui.Ui;
import java.util.ArrayList;
import java.util.List;
import kotlin.Metadata;
import kotlin.Unit;
import kotlin.collections.CollectionsKt;
import kotlin.jvm.functions.Function1;
import kotlin.jvm.internal.Intrinsics;

public final class SegmentedControl extends FrameLayout {
    private boolean animateChanges;
    private final View indicator;
    private final List<String> labels;
    private Function1<? super Integer, Unit> onSelect;
    private final List<TextView> options;
    private final LinearLayout row;
    private int selected;
    private ValueAnimator slide;

    public static void m99$r8$lambda$dAN7klD7Xzym24CaU7h4GZ5LrQ(SegmentedControl segmentedControl) {
        onLayout$lambda$9(segmentedControl);
    }

    public static void $r8$lambda$k6UpmLcDTEBNzpjC7qTZpBCsKTE(SegmentedControl segmentedControl, float f, float f2, ValueAnimator valueAnimator) {
        place$lambda$8$lambda$7(segmentedControl, f, f2, valueAnimator);
    }

    public SegmentedControl(Context context, List<String> labels) {
        super(context);
        Intrinsics.checkNotNullParameter(context, "context");
        Intrinsics.checkNotNullParameter(labels, "labels");
        this.labels = labels;
        this.selected = -1;
        this.animateChanges = true;
        View view = new View(context);
        view.setBackground(Shapes.rounded$default(Shapes.INSTANCE, context, (Number) 10, Ui.INSTANCE.getC().getSurface(), Ui.INSTANCE.getC().getSeparator(), null, 16, null));
        view.setVisibility(4);
        view.setElevation(0.0f);
        this.indicator = view;
        LinearLayout linearLayout = new LinearLayout(context);
        linearLayout.setOrientation(0);
        this.row = linearLayout;
        setBackground(Shapes.rounded$default(Shapes.INSTANCE, context, (Number) 12, Ui.INSTANCE.getC().getSurfaceAlt(), 0, null, 24, null));
        SegmentedControl segmentedControl = this;
        setPadding(ThemeKt.dp(segmentedControl, (Number) 3), ThemeKt.dp(segmentedControl, (Number) 3), ThemeKt.dp(segmentedControl, (Number) 3), ThemeKt.dp(segmentedControl, (Number) 3));
        addView(view, new FrameLayout.LayoutParams(0, -1));
        List<String> list = labels;
        ArrayList arrayList = new ArrayList(CollectionsKt.collectionSizeOrDefault(list, 10));
        int i = 0;
        for (Object obj : list) {
            int i2 = i + 1;
            if (i < 0) {
                CollectionsKt.throwIndexOverflow();
            }
            TextView text = ThemeKt.text(context, (String) obj, 14.5f, Ui.INSTANCE.getC().getText2(), Fonts.INSTANCE.getSansMedium(), new SegmentedControl$$ExternalSyntheticLambda3(this, i));
            this.row.addView(text, new LinearLayout.LayoutParams(0, -2, 1.0f));
            arrayList.add(text);
            i = i2;
        }
        this.options = arrayList;
        addView(this.row, new FrameLayout.LayoutParams(-1, -2));
    }

    public final int getSelected() {
        return this.selected;
    }

    public final Function1<? super Integer, Unit> getOnSelect() {
        return this.onSelect;
    }

    public final void setOnSelect(Function1<? super Integer, Unit> function1) {
        this.onSelect = function1;
    }

    public final boolean getAnimateChanges() {
        return this.animateChanges;
    }

    public final void setAnimateChanges(boolean z) {
        this.animateChanges = z;
    }

    public static final Unit lambda$5$lambda$3(SegmentedControl segmentedControl, int i, TextView text) {
        Intrinsics.checkNotNullParameter(text, "$this$text");
        text.setGravity(17);
        text.setMaxLines(2);
        TextView textView = text;
        text.setPadding(ThemeKt.dp(textView, (Number) 6), ThemeKt.dp(textView, (Number) 6), ThemeKt.dp(textView, (Number) 6), ThemeKt.dp(textView, (Number) 6));
        text.setMinHeight(ThemeKt.dp(textView, (Number) 40));
        text.setOnClickListener(new SegmentedControl$$ExternalSyntheticLambda2(segmentedControl, i));
        return Unit.INSTANCE;
    }

    public static final void lambda$5$lambda$3$lambda$2(SegmentedControl segmentedControl, int i, View view) {
        Haptics haptics = Haptics.INSTANCE;
        Intrinsics.checkNotNull(view);
        haptics.tap(view);
        segmentedControl.select(i, true, true);
    }

    public static void select$default(SegmentedControl segmentedControl, int i, boolean z, boolean z2, int i2, Object obj) {
        if ((i2 & 2) != 0) {
            z = false;
        }
        if ((i2 & 4) != 0) {
            z2 = false;
        }
        segmentedControl.select(i, z, z2);
    }

    public final void select(int i, boolean z, boolean z2) {
        Function1<? super Integer, Unit> function1;
        boolean z4 = i != this.selected;
        this.selected = i;
        int i2 = 0;
        for (Object obj : this.options) {
            int i3 = i2 + 1;
            if (i2 < 0) {
                CollectionsKt.throwIndexOverflow();
            }
            TextView textView = (TextView) obj;
            Colors c = Ui.INSTANCE.getC();
            textView.setTextColor(i2 == i ? c.getGreenText() : c.getText2());
            Fonts fonts = Fonts.INSTANCE;
            textView.setTypeface(i2 == i ? fonts.getSansSemibold() : fonts.getSansMedium());
            textView.setSelected(i2 == i);
            i2 = i3;
        }
        place(z && this.animateChanges && z4 && this.indicator.getVisibility() == 0);
        if (z2 && z4 && (function1 = this.onSelect) != null) {
            function1.invoke(Integer.valueOf(i));
        }
    }

    private final void place(boolean z) {
        if (this.selected < 0 || this.row.getWidth() == 0) {
            if (this.selected < 0) {
                this.indicator.setVisibility(4);
                return;
            }
            return;
        }
        int width = this.row.getWidth() / this.labels.size();
        if (this.indicator.getLayoutParams().width != width || this.indicator.getLayoutParams().height != this.row.getHeight()) {
            this.indicator.setLayoutParams(new FrameLayout.LayoutParams(width, this.row.getHeight()));
        }
        this.indicator.setVisibility(0);
        float f = this.selected * width;
        ValueAnimator valueAnimator = this.slide;
        if (valueAnimator != null) {
            valueAnimator.cancel();
        }
        if (z) {
            float translationX = this.indicator.getTranslationX();
            ValueAnimator ofFloat = ValueAnimator.ofFloat(0.0f, 1.0f);
            ofFloat.setDuration(240L);
            ofFloat.setInterpolator(Ease.INSTANCE.getInOut());
            ofFloat.addUpdateListener(new SegmentedControl$$ExternalSyntheticLambda0(this, translationX, f));
            ofFloat.start();
            this.slide = ofFloat;
            return;
        }
        this.indicator.setTranslationX(f);
    }

    private static final void place$lambda$8$lambda$7(SegmentedControl segmentedControl, float f, float f2, ValueAnimator it) {
        Intrinsics.checkNotNullParameter(it, "it");
        View view = segmentedControl.indicator;
        Object animatedValue = it.getAnimatedValue();
        Intrinsics.checkNotNull(animatedValue, "null cannot be cast to non-null type kotlin.Float");
        view.setTranslationX(FxKt.lerp(f, f2, ((Float) animatedValue).floatValue()));
    }

    @Override
    protected void onLayout(boolean z, int i, int i2, int i3, int i4) {
        super.onLayout(z, i, i2, i3, i4);
        if (!z || this.selected < 0) {
            return;
        }
        post(new SegmentedControl$$ExternalSyntheticLambda1(this));
    }

    private static final void onLayout$lambda$9(SegmentedControl segmentedControl) {
        segmentedControl.place(false);
    }
}

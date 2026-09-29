package com.imran.examcountdown.ui.widgets;

import android.content.Context;
import android.view.View;
import android.widget.LinearLayout;
import android.widget.TextView;
import com.imran.examcountdown.core.Countdown;
import com.imran.examcountdown.ui.ThemeKt;
import com.imran.examcountdown.ui.Ui;
import java.util.List;
import kotlin.Metadata;
import kotlin.collections.CollectionsKt;
import kotlin.jvm.internal.Intrinsics;
import kotlin.ranges.RangesKt;

public final class CountdownView extends LinearLayout {
    private final List<Unit> all;
    private boolean animateChanges;
    private final Unit days;
    private final Unit hours;
    private int lastWidth;
    private float maxSizePx;
    private final Unit minutes;
    private final Unit seconds;
    private boolean showDays;

    public static kotlin.Unit $r8$lambda$spDjujCxWTnZ5om3KJY97vvx52k(LinearLayout linearLayout, LinearLayout.LayoutParams layoutParams) {
        return unit$lambda$5$lambda$4(linearLayout, layoutParams);
    }

    public CountdownView(Context context) {
        super(context);
        Intrinsics.checkNotNullParameter(context, "context");
        Unit unit = unit("Days");
        this.days = unit;
        Unit unit2 = unit("Hours");
        this.hours = unit2;
        Unit unit3 = unit("Min");
        this.minutes = unit3;
        Unit unit4 = unit("Sec");
        this.seconds = unit4;
        int i = 0;
        List<Unit> listOf = CollectionsKt.listOf(new Unit[]{unit, unit2, unit3, unit4});
        this.all = listOf;
        this.maxSizePx = ThemeKt.dp(context, (Number) 64);
        this.lastWidth = -1;
        this.showDays = true;
        this.animateChanges = true;
        setOrientation(0);
        setGravity(8388691);
        for (Object obj : listOf) {
            int i2 = i + 1;
            if (i < 0) {
                CollectionsKt.throwIndexOverflow();
            }
            Unit unit5 = (Unit) obj;
            addView(unit5.getColumn(), ThemeKt.lp$default(-2, -2, 0.0f, new CountdownView$$ExternalSyntheticLambda0(i, this), 4, null));
            unit5.getNumber().setCountsDown(true);
            i = i2;
        }
        this.seconds.getNumber().setColor(Ui.INSTANCE.getC().getText2());
        setImportantForAccessibility(1);
    }

    private static final class Unit {
        private final LinearLayout column;
        private final TextView label;
        private final RollingNumberView number;

        public Unit(RollingNumberView number, TextView label, LinearLayout column) {
            Intrinsics.checkNotNullParameter(number, "number");
            Intrinsics.checkNotNullParameter(label, "label");
            Intrinsics.checkNotNullParameter(column, "column");
            this.number = number;
            this.label = label;
            this.column = column;
        }

        public final LinearLayout getColumn() {
            return this.column;
        }

        public final TextView getLabel() {
            return this.label;
        }

        public final RollingNumberView getNumber() {
            return this.number;
        }
    }

    public final boolean getAnimateChanges() {
        return this.animateChanges;
    }

    public final void setAnimateChanges(boolean z) {
        this.animateChanges = z;
        for (Unit unit : this.all) {
            unit.getNumber().setAnimateChanges(z);
        }
    }

    public static final kotlin.Unit lambda$2$lambda$1(int i, CountdownView countdownView, LinearLayout.LayoutParams lp) {
        Intrinsics.checkNotNullParameter(lp, "$this$lp");
        if (i > 0) {
            lp.setMarginStart(ThemeKt.dp(countdownView, (Number) 18));
        }
        return kotlin.Unit.INSTANCE;
    }

    private final Unit unit(String str) {
        Context context = getContext();
        Intrinsics.checkNotNullExpressionValue(context, "getContext(...)");
        RollingNumberView rollingNumberView = new RollingNumberView(context);
        rollingNumberView.setColor(Ui.INSTANCE.getC().getText());
        Context context2 = getContext();
        Intrinsics.checkNotNullExpressionValue(context2, "getContext(...)");
        TextView label = ThemeKt.label(context2, str, Ui.INSTANCE.getC().getText3(), 11.0f);
        LinearLayout linearLayout = new LinearLayout(getContext());
        linearLayout.setOrientation(1);
        linearLayout.setGravity(8388611);
        linearLayout.addView(rollingNumberView, ThemeKt.lp$default(-2, -2, 0.0f, null, 12, null));
        linearLayout.addView(label, ThemeKt.lp$default(-2, -2, 0.0f, new CountdownView$$ExternalSyntheticLambda1(linearLayout), 4, null));
        return new Unit(rollingNumberView, label, linearLayout);
    }

    private static final kotlin.Unit unit$lambda$5$lambda$4(LinearLayout linearLayout, LinearLayout.LayoutParams lp) {
        Intrinsics.checkNotNullParameter(lp, "$this$lp");
        lp.topMargin = ThemeKt.dp(linearLayout, (Number) 2);
        return kotlin.Unit.INSTANCE;
    }

    public final void set(Countdown cd) {
        Intrinsics.checkNotNullParameter(cd, "cd");
        boolean z = cd.getDays() > 0;
        if (z != this.showDays) {
            this.showDays = z;
            this.days.getColumn().setVisibility(z ? 0 : 8);
            this.lastWidth = -1;
            requestLayout();
        }
        int length = this.days.getNumber().getValue().length();
        this.days.getNumber().setMinDigits(cd.getDays() >= 100 ? 3 : cd.getDays() >= 10 ? 2 : 1);
        RollingNumberView.setValue$default(this.days.getNumber(), cd.getDays(), false, 2, null);
        if (this.days.getNumber().getValue().length() != length) {
            this.lastWidth = -1;
            requestLayout();
        }
        ThemeKt.update(this.days.getLabel(), cd.getDays() == 1 ? "DAY" : "DAYS");
        RollingNumberView.setValue$default(this.hours.getNumber(), cd.getHours(), false, 2, null);
        ThemeKt.update(this.hours.getLabel(), cd.getHours() == 1 ? "HOUR" : "HOURS");
        RollingNumberView.setValue$default(this.minutes.getNumber(), cd.getMinutes(), false, 2, null);
        RollingNumberView.setValue$default(this.seconds.getNumber(), cd.getSeconds(), false, 2, null);
        setContentDescription(cd.spoken());
    }

    @Override
    protected void onMeasure(int i, int i2) {
        int size = View.MeasureSpec.getSize(i);
        if (size > 0 && size != this.lastWidth) {
            this.lastWidth = size;
            fitTo(size);
        }
        super.onMeasure(i, i2);
    }

    private final void fitTo(int i) {
        CountdownView countdownView = this;
        float coerceAtLeast = RangesKt.coerceAtLeast(RangesKt.coerceAtMost((i - (ThemeKt.dp(countdownView, (Number) 18) * (this.showDays ? 3 : 2))) / ((((this.showDays ? this.days.getNumber().getValue().length() : 0) + 4) * 0.56f) + ((2 * 0.56f) * 0.5f)), this.maxSizePx), ThemeKt.dp(countdownView, (Number) 24));
        float f = 0.06f * coerceAtLeast;
        for (Unit unit : CollectionsKt.listOf(new Unit[]{this.days, this.hours, this.minutes})) {
            unit.getNumber().setTextSizePx(coerceAtLeast);
            unit.getNumber().setVerticalGapPx(f);
        }
        this.seconds.getNumber().setTextSizePx(coerceAtLeast * 0.5f);
        this.seconds.getNumber().setVerticalGapPx(f);
    }
}

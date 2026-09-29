package com.imran.examcountdown.ui.widgets;

import android.animation.ValueAnimator;
import android.content.Context;
import android.content.res.ColorStateList;
import android.graphics.Canvas;
import android.graphics.Paint;
import android.graphics.RectF;
import android.text.TextPaint;
import android.util.TypedValue;
import android.view.View;
import android.view.animation.LinearInterpolator;
import android.widget.FrameLayout;
import android.widget.ImageView;
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
import kotlin.ranges.RangesKt;

public final class NavBar extends LinearLayout {
    private boolean animateChanges;
    private ValueAnimator animator;
    private ValueAnimator colorAnimator;
    private final RectF from;
    private final ArrayList<ImageView> icons;
    private final ArrayList<LinearLayout> items;
    private boolean movingRight;
    private final Function1<? super Integer, Unit> onSelect;
    private final RectF pill;
    private final Paint pillPaint;
    private boolean pillShown;
    private final ArrayList<FrameLayout> pills;
    private float progress;
    private final IndicatorRow row;
    private int selected;
    private final ArrayList<TextView> texts;
    private final RectF to;

    public static void $r8$lambda$0fOQZ2WkHJkGV2iJKflLlauDRSg(NavBar navBar, ValueAnimator valueAnimator) {
        select$lambda$10$lambda$9(navBar, valueAnimator);
    }

    public static void $r8$lambda$1RDoK46PR1EA81uZyXzlRTNMcqQ(NavBar navBar, int i, int i2, ValueAnimator valueAnimator) {
        select$lambda$8$lambda$7(navBar, i, i2, valueAnimator);
    }

    public static void m97$r8$lambda$6LvToxr4aJupKFbC0viBD4ALk(TextView textView, float f) {
        fitWidth$lambda$12(textView, f);
    }

    public static final RectF access$getPill$p(NavBar navBar) {
        return navBar.pill;
    }

    public static final Paint access$getPillPaint$p(NavBar navBar) {
        return navBar.pillPaint;
    }

    public static final boolean access$getPillShown$p(NavBar navBar) {
        return navBar.pillShown;
    }

    public NavBar(Context context, List<String> labels, List<Integer> iconRes, Function1<? super Integer, Unit> onSelect) {
        super(context);
        Intrinsics.checkNotNullParameter(context, "context");
        Intrinsics.checkNotNullParameter(labels, "labels");
        Intrinsics.checkNotNullParameter(iconRes, "iconRes");
        Intrinsics.checkNotNullParameter(onSelect, "onSelect");
        this.onSelect = onSelect;
        this.selected = -1;
        this.animateChanges = true;
        this.pills = new ArrayList<>();
        this.icons = new ArrayList<>();
        this.texts = new ArrayList<>();
        this.items = new ArrayList<>();
        IndicatorRow indicatorRow = new IndicatorRow(this, context);
        this.row = indicatorRow;
        this.pill = new RectF();
        this.from = new RectF();
        this.to = new RectF();
        this.movingRight = true;
        this.progress = 1.0f;
        this.pillPaint = new Paint(1);
        setOrientation(1);
        setBackgroundColor(Ui.INSTANCE.getC().getSurface());
        addView(ThemeKt.separator(context));
        indicatorRow.setOrientation(0);
        int i = 0;
        for (Object obj : labels) {
            int i2 = i + 1;
            if (i < 0) {
                CollectionsKt.throwIndexOverflow();
            }
            ImageView imageView = new ImageView(context);
            imageView.setImageResource(iconRes.get(i).intValue());
            imageView.setImportantForAccessibility(2);
            FrameLayout frameLayout = new FrameLayout(context);
            FrameLayout frameLayout2 = frameLayout;
            frameLayout.addView(imageView, new FrameLayout.LayoutParams(ThemeKt.dp(frameLayout2, (Number) 24), ThemeKt.dp(frameLayout2, (Number) 24), 17));
            String str = (String) obj;
            TextView text = ThemeKt.text(context, str, 12.5f, Ui.INSTANCE.getC().getText2(), Fonts.INSTANCE.getSansMedium(), new NavBar$$ExternalSyntheticLambda2());
            LinearLayout linearLayout = new LinearLayout(context);
            linearLayout.setOrientation(1);
            linearLayout.setGravity(17);
            LinearLayout linearLayout2 = linearLayout;
            linearLayout.setMinimumHeight(ThemeKt.dp(linearLayout2, (Number) 64));
            linearLayout.setPadding(0, ThemeKt.dp(linearLayout2, (Number) 8), 0, ThemeKt.dp(linearLayout2, (Number) 8));
            linearLayout.setBackground(Shapes.INSTANCE.ripple(context, null, (Number) 0));
            linearLayout.setContentDescription(str);
            linearLayout.addView(frameLayout2, ThemeKt.lp$default(ThemeKt.dp(linearLayout2, (Number) 60), ThemeKt.dp(linearLayout2, (Number) 32), 0.0f, null, 12, null));
            linearLayout.addView(text, ThemeKt.lp$default(-1, -2, 0.0f, new NavBar$$ExternalSyntheticLambda3(linearLayout), 4, null));
            linearLayout.setOnClickListener(new NavBar$$ExternalSyntheticLambda4(i, this));
            this.pills.add(frameLayout);
            this.icons.add(imageView);
            this.texts.add(text);
            this.items.add(linearLayout);
            this.row.addView(linearLayout2, new LinearLayout.LayoutParams(0, -2, 1.0f));
            i = i2;
        }
        addView(this.row, ThemeKt.lp$default(0, 0, 0.0f, null, 15, null));
    }

    public final int getSelected() {
        return this.selected;
    }

    public final boolean getAnimateChanges() {
        return this.animateChanges;
    }

    public final void setAnimateChanges(boolean z) {
        this.animateChanges = z;
    }

    public static final Unit lambda$6$lambda$2(TextView text) {
        Intrinsics.checkNotNullParameter(text, "$this$text");
        text.setGravity(17);
        text.setMaxLines(1);
        return Unit.INSTANCE;
    }

    public static final Unit lambda$6$lambda$5$lambda$3(LinearLayout linearLayout, LinearLayout.LayoutParams lp) {
        Intrinsics.checkNotNullParameter(lp, "$this$lp");
        lp.topMargin = ThemeKt.dp(linearLayout, (Number) 4);
        return Unit.INSTANCE;
    }

    public static final void lambda$6$lambda$5$lambda$4(int i, NavBar navBar, View view) {
        if (i != navBar.selected) {
            Haptics haptics = Haptics.INSTANCE;
            Intrinsics.checkNotNull(view);
            haptics.tap(view);
        } else {
            navBar.nudge(i);
        }
        navBar.onSelect.invoke(Integer.valueOf(i));
    }

    public final void setBottomInset(int i) {
        if (this.row.getPaddingBottom() != i) {
            this.row.setPadding(0, 0, 0, i);
        }
    }

    public final void select(int i, boolean z) {
        int i2 = this.selected;
        this.selected = i;
        boolean z2 = z && this.animateChanges && i2 != i && i2 >= 0 && i >= 0 && i < this.pills.size() && this.pillShown;
        int size = this.items.size();
        int i3 = 0;
        while (true) {
            if (i3 >= size) {
                break;
            }
            boolean z3 = i3 == i;
            TextView textView = this.texts.get(i3);
            Fonts fonts = Fonts.INSTANCE;
            textView.setTypeface(z3 ? fonts.getSansSemibold() : fonts.getSansMedium());
            this.items.get(i3).setSelected(z3);
            if (!z2) {
                paintItem(i3, z3 ? 1.0f : 0.0f);
            }
            i3++;
        }
        if (!z2) {
            ValueAnimator valueAnimator = this.animator;
            if (valueAnimator != null) {
                valueAnimator.cancel();
            }
            this.progress = 1.0f;
            placePill(i);
            return;
        }
        ValueAnimator valueAnimator2 = this.colorAnimator;
        if (valueAnimator2 != null) {
            valueAnimator2.cancel();
        }
        ValueAnimator ofFloat = ValueAnimator.ofFloat(0.0f, 1.0f);
        ofFloat.setDuration(200L);
        ofFloat.addUpdateListener(new NavBar$$ExternalSyntheticLambda0(this, i, i2));
        ofFloat.start();
        this.colorAnimator = ofFloat;
        this.from.set(this.pill);
        pillRect(i, this.to);
        this.movingRight = this.to.centerX() >= this.from.centerX();
        ValueAnimator valueAnimator3 = this.animator;
        if (valueAnimator3 != null) {
            valueAnimator3.cancel();
        }
        ValueAnimator ofFloat2 = ValueAnimator.ofFloat(0.0f, 1.0f);
        ofFloat2.setDuration(280L);
        ofFloat2.setInterpolator(new LinearInterpolator());
        ofFloat2.addUpdateListener(new NavBar$$ExternalSyntheticLambda1(this));
        ofFloat2.start();
        this.animator = ofFloat2;
        ImageView imageView = this.icons.get(i);
        Intrinsics.checkNotNullExpressionValue(imageView, "get(...)");
        ImageView imageView2 = imageView;
        imageView2.setScaleX(0.88f);
        imageView2.setScaleY(0.88f);
        imageView2.animate().scaleX(1.0f).scaleY(1.0f).setInterpolator(Ease.INSTANCE.getOut()).setDuration(220L).start();
    }

    private static final void select$lambda$8$lambda$7(NavBar navBar, int i, int i2, ValueAnimator it) {
        Intrinsics.checkNotNullParameter(it, "it");
        Object animatedValue = it.getAnimatedValue();
        Intrinsics.checkNotNull(animatedValue, "null cannot be cast to non-null type kotlin.Float");
        float floatValue = ((Float) animatedValue).floatValue();
        navBar.paintItem(i, floatValue);
        if (i2 < 0 || i2 >= navBar.items.size()) {
            return;
        }
        navBar.paintItem(i2, 1.0f - floatValue);
    }

    private static final void select$lambda$10$lambda$9(NavBar navBar, ValueAnimator it) {
        Intrinsics.checkNotNullParameter(it, "it");
        Object animatedValue = it.getAnimatedValue();
        Intrinsics.checkNotNull(animatedValue, "null cannot be cast to non-null type kotlin.Float");
        navBar.progress = ((Float) animatedValue).floatValue();
        navBar.updatePill();
    }

    private final void nudge(int i) {
        if (!this.animateChanges || i < 0 || i >= this.icons.size()) {
            return;
        }
        ImageView imageView = this.icons.get(i);
        Intrinsics.checkNotNullExpressionValue(imageView, "get(...)");
        ImageView imageView2 = imageView;
        imageView2.animate().cancel();
        imageView2.setScaleX(0.9f);
        imageView2.setScaleY(0.9f);
        imageView2.animate().scaleX(1.0f).scaleY(1.0f).setInterpolator(Ease.INSTANCE.getOut()).setDuration(200L).start();
    }

    private final void paintItem(int i, float f) {
        Colors c = Ui.INSTANCE.getC();
        int lerpColor = FxKt.lerpColor(c.getText2(), c.getGreenText(), f);
        this.icons.get(i).setImageTintList(ColorStateList.valueOf(lerpColor));
        this.texts.get(i).setTextColor(lerpColor);
    }

    private final void pillRect(int i, RectF rectF) {
        LinearLayout linearLayout = this.items.get(i);
        Intrinsics.checkNotNullExpressionValue(linearLayout, "get(...)");
        LinearLayout linearLayout2 = linearLayout;
        FrameLayout frameLayout = this.pills.get(i);
        Intrinsics.checkNotNullExpressionValue(frameLayout, "get(...)");
        FrameLayout frameLayout2 = frameLayout;
        rectF.set(linearLayout2.getLeft() + frameLayout2.getLeft(), linearLayout2.getTop() + frameLayout2.getTop(), linearLayout2.getLeft() + frameLayout2.getRight(), linearLayout2.getTop() + frameLayout2.getBottom());
    }

    private final void placePill(int i) {
        if (i < 0 || i >= this.items.size() || this.items.get(i).getWidth() == 0) {
            this.pillShown = false;
            this.row.invalidate();
            return;
        }
        pillRect(i, this.pill);
        this.pillShown = true;
        this.row.invalidate();
    }

    private final void updatePill() {
        float f;
        float f2;
        float cubicInOut = Ease.INSTANCE.cubicInOut(RangesKt.coerceAtMost(this.progress * 1.12f, 1.0f));
        float cubicInOut2 = Ease.INSTANCE.cubicInOut(RangesKt.coerceIn((this.progress - 0.1f) / 0.9f, 0.0f, 1.0f));
        if (this.movingRight) {
            f = FxKt.lerp(this.from.left, this.to.left, cubicInOut2);
            f2 = FxKt.lerp(this.from.right, this.to.right, cubicInOut);
        } else {
            float lerp = FxKt.lerp(this.from.left, this.to.left, cubicInOut);
            float lerp2 = FxKt.lerp(this.from.right, this.to.right, cubicInOut2);
            f = lerp;
            f2 = lerp2;
        }
        this.pill.set(Math.min(f, f2), this.to.top, Math.max(f, f2), this.to.bottom);
        this.row.invalidate();
    }

    @Override
    protected void onLayout(boolean z, int i, int i2, int i3, int i4) {
        super.onLayout(z, i, i2, i3, i4);
        if (z) {
            for (TextView textView : this.texts) {
                fitWidth(textView);
            }
        }
        ValueAnimator valueAnimator = this.animator;
        if (valueAnimator != null && valueAnimator.isRunning()) {
            pillRect(this.selected, this.to);
            return;
        }
        int i5 = this.selected;
        if (i5 >= 0) {
            placePill(i5);
        }
    }

    private final void fitWidth(TextView textView) {
        int width = textView.getWidth() - ThemeKt.dp(this, (Number) 4);
        if (width <= 0) {
            return;
        }
        TextPaint paint = textView.getPaint();
        float applyDimension = TypedValue.applyDimension(2, 12.5f, getResources().getDisplayMetrics());
        paint.setTextSize(applyDimension);
        float measureText = paint.measureText(textView.getText().toString());
        float applyDimension2 = TypedValue.applyDimension(1, 9.0f, getResources().getDisplayMetrics());
        float f = width;
        if (measureText > f) {
            applyDimension = RangesKt.coerceAtLeast((applyDimension * f) / measureText, applyDimension2);
        }
        if (textView.getTextSize() == applyDimension) {
            return;
        }
        textView.post(new NavBar$$ExternalSyntheticLambda5(textView, applyDimension));
    }

    private static final void fitWidth$lambda$12(TextView textView, float f) {
        textView.setTextSize(0, f);
    }

    private static final class IndicatorRow extends LinearLayout {
        final NavBar this$0;

            public IndicatorRow(NavBar navBar, Context context) {
            super(context);
            Intrinsics.checkNotNullParameter(context, "context");
            this.this$0 = navBar;
        }

        @Override
        protected void dispatchDraw(Canvas canvas) {
            Intrinsics.checkNotNullParameter(canvas, "canvas");
            if (NavBar.access$getPillShown$p(this.this$0)) {
                NavBar.access$getPillPaint$p(this.this$0).setColor(Ui.INSTANCE.getC().getGreenSoft());
                float coerceAtMost = RangesKt.coerceAtMost(ThemeKt.dpf(this, (Number) 16), NavBar.access$getPill$p(this.this$0).height() / 2.0f);
                canvas.drawRoundRect(NavBar.access$getPill$p(this.this$0), coerceAtMost, coerceAtMost, NavBar.access$getPillPaint$p(this.this$0));
            }
            super.dispatchDraw(canvas);
        }
    }
}

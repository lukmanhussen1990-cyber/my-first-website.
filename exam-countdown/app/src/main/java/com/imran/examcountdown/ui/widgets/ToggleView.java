package com.imran.examcountdown.ui.widgets;

import android.animation.ValueAnimator;
import android.content.Context;
import android.graphics.Canvas;
import android.graphics.Paint;
import android.graphics.RectF;
import android.view.View;
import android.view.accessibility.AccessibilityNodeInfo;
import android.widget.Switch;
import com.imran.examcountdown.ui.Colors;
import com.imran.examcountdown.ui.Ease;
import com.imran.examcountdown.ui.FxKt;
import com.imran.examcountdown.ui.Haptics;
import com.imran.examcountdown.ui.ThemeKt;
import com.imran.examcountdown.ui.Ui;
import kotlin.Metadata;
import kotlin.Unit;
import kotlin.jvm.functions.Function1;
import kotlin.jvm.internal.Intrinsics;
import kotlin.ranges.RangesKt;

public final class ToggleView extends View {
    private boolean animateChanges;
    private ValueAnimator animator;
    private boolean isChecked;
    private float knob;
    private final Paint knobPaint;
    private Function1<? super Boolean, Unit> onChange;
    private final Paint outline;
    private final RectF rect;
    private final Paint track;

    public static void $r8$lambda$BzWUh1JXZdN4SX8GGalM1RYGgQ8(ToggleView toggleView, float f, float f2, ValueAnimator valueAnimator) {
        setChecked$lambda$2$lambda$1(toggleView, f, f2, valueAnimator);
    }

    /* JADX WARN: 'super' call moved to the top of the method (can break code semantics) */
    public ToggleView(Context context) {
        super(context);
        Intrinsics.checkNotNullParameter(context, "context");
        this.animateChanges = true;
        this.rect = new RectF();
        this.track = new Paint(1);
        Paint paint = new Paint(1);
        paint.setStyle(Paint.Style.STROKE);
        paint.setStrokeWidth(ThemeKt.dpf(this, Float.valueOf(1.5f)));
        this.outline = paint;
        this.knobPaint = new Paint(1);
        setClickable(true);
        setFocusable(true);
    }

    public final boolean isChecked() {
        return this.isChecked;
    }

    public final Function1<Boolean, Unit> getOnChange() {
        return this.onChange;
    }

    public final void setOnChange(Function1<? super Boolean, Unit> function1) {
        this.onChange = function1;
    }

    public final boolean getAnimateChanges() {
        return this.animateChanges;
    }

    public final void setAnimateChanges(boolean z) {
        this.animateChanges = z;
    }

    public static void setChecked$default(ToggleView toggleView, boolean z, boolean z2, int i, Object obj) {
        if ((i & 2) != 0) {
            z2 = false;
        }
        toggleView.setChecked(z, z2);
    }

    public final void setChecked(boolean z, boolean z2) {
        if (z == this.isChecked && this.animator == null) {
            return;
        }
        this.isChecked = z;
        ValueAnimator valueAnimator = this.animator;
        if (valueAnimator != null) {
            valueAnimator.cancel();
        }
        float f = z ? 1.0f : 0.0f;
        if (z2 && this.animateChanges && isAttachedToWindow()) {
            float f2 = this.knob;
            ValueAnimator ofFloat = ValueAnimator.ofFloat(0.0f, 1.0f);
            ofFloat.setDuration(220L);
            ofFloat.setInterpolator(Ease.INSTANCE.getInOut());
            ofFloat.addUpdateListener(new ToggleView$$ExternalSyntheticLambda0(this, f2, f));
            ofFloat.start();
            this.animator = ofFloat;
            return;
        }
        this.animator = null;
        this.knob = f;
        invalidate();
    }

    private static final void setChecked$lambda$2$lambda$1(ToggleView toggleView, float f, float f2, ValueAnimator it) {
        Intrinsics.checkNotNullParameter(it, "it");
        Object animatedValue = it.getAnimatedValue();
        Intrinsics.checkNotNull(animatedValue, "null cannot be cast to non-null type kotlin.Float");
        toggleView.knob = FxKt.lerp(f, f2, ((Float) animatedValue).floatValue());
        toggleView.invalidate();
    }

    @Override
    public boolean performClick() {
        setChecked(!this.isChecked, true);
        Haptics.INSTANCE.tap(this);
        Function1<? super Boolean, Unit> function1 = this.onChange;
        if (function1 != null) {
            function1.invoke(Boolean.valueOf(this.isChecked));
        }
        return super.performClick();
    }

    @Override
    protected void onMeasure(int i, int i2) {
        ToggleView toggleView = this;
        setMeasuredDimension(ThemeKt.dp(toggleView, (Number) 50), ThemeKt.dp(toggleView, (Number) 30));
    }

    @Override
    protected void onDraw(Canvas canvas) {
        Intrinsics.checkNotNullParameter(canvas, "canvas");
        Colors c = Ui.INSTANCE.getC();
        float height = getHeight();
        float coerceIn = RangesKt.coerceIn(this.knob, 0.0f, 1.0f);
        float f = 2;
        float strokeWidth = this.outline.getStrokeWidth() / f;
        this.rect.set(strokeWidth, strokeWidth, getWidth() - strokeWidth, height - strokeWidth);
        this.track.setColor(FxKt.lerpColor(c.getSurfaceAlt(), c.getGreen(), coerceIn));
        float f2 = height / f;
        canvas.drawRoundRect(this.rect, f2, f2, this.track);
        if (coerceIn < 1.0f) {
            this.outline.setColor(Ui.INSTANCE.withAlpha(c.getText3(), 1.0f - coerceIn));
            canvas.drawRoundRect(this.rect, f2, f2, this.outline);
        }
        ToggleView toggleView = this;
        float dpf = ThemeKt.dpf(toggleView, (Number) 8) + (ThemeKt.dpf(toggleView, (Number) 3) * coerceIn);
        this.knobPaint.setColor(FxKt.lerpColor(c.getText3(), c.getOnGreen(), coerceIn));
        canvas.drawCircle(((getWidth() - height) * coerceIn) + f2, f2, dpf, this.knobPaint);
    }

    @Override
    public CharSequence getAccessibilityClassName() {
        String name = Switch.class.getName();
        Intrinsics.checkNotNullExpressionValue(name, "getName(...)");
        return name;
    }

    @Override
    public void onInitializeAccessibilityNodeInfo(AccessibilityNodeInfo info) {
        Intrinsics.checkNotNullParameter(info, "info");
        super.onInitializeAccessibilityNodeInfo(info);
        info.setCheckable(true);
        info.setChecked(this.isChecked);
    }
}

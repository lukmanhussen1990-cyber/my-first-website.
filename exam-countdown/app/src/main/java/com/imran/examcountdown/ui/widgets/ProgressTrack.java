package com.imran.examcountdown.ui.widgets;

import android.animation.ValueAnimator;
import android.content.Context;
import android.graphics.Canvas;
import android.graphics.LinearGradient;
import android.graphics.Matrix;
import android.graphics.Paint;
import android.graphics.RadialGradient;
import android.graphics.RectF;
import android.graphics.Shader;
import android.view.View;
import com.imran.examcountdown.ui.Ease;
import com.imran.examcountdown.ui.ThemeKt;
import com.imran.examcountdown.ui.Ui;
import kotlin.Metadata;
import kotlin.jvm.internal.Intrinsics;
import kotlin.ranges.RangesKt;

public final class ProgressTrack extends View {
    private ValueAnimator animator;
    private final Paint fill;
    private int fillColor;
    private final Paint glow;
    private RadialGradient glowShader;
    private final float lineHeight;
    private final RectF rect;
    private float shimmer;
    private final Paint shine;
    private final Matrix shineMatrix;
    private final LinearGradient shineShader;
    private float shown;
    private float target;
    private final Paint track;

    public static void $r8$lambda$_qhRtZ6defCYaLps_jG7NWGLyIQ(ProgressTrack progressTrack, ValueAnimator valueAnimator) {
        set$lambda$1$lambda$0(progressTrack, valueAnimator);
    }

    /* JADX WARN: 'super' call moved to the top of the method (can break code semantics) */
    public ProgressTrack(Context context) {
        super(context);
        Intrinsics.checkNotNullParameter(context, "context");
        this.fillColor = Ui.INSTANCE.getC().getGold();
        this.shimmer = -1.0f;
        this.rect = new RectF();
        this.track = new Paint(1);
        this.fill = new Paint(1);
        this.glow = new Paint(1);
        Paint paint = new Paint(1);
        this.shine = paint;
        this.shineMatrix = new Matrix();
        ProgressTrack progressTrack = this;
        this.lineHeight = ThemeKt.dpf(progressTrack, (Number) 4);
        LinearGradient linearGradient = new LinearGradient(-ThemeKt.dpf(progressTrack, (Number) 28), 0.0f, ThemeKt.dpf(progressTrack, (Number) 28), 0.0f, new int[]{16777215, -1711276033, 16777215}, (float[]) null, Shader.TileMode.CLAMP);
        this.shineShader = linearGradient;
        setImportantForAccessibility(2);
        paint.setShader(linearGradient);
    }

    public final int getFillColor() {
        return this.fillColor;
    }

    public final void setFillColor(int i) {
        this.fillColor = i;
        this.glowShader = null;
        invalidate();
    }

    public final float getShimmer() {
        return this.shimmer;
    }

    public final void setShimmer(float f) {
        if (this.shimmer == f) {
            return;
        }
        this.shimmer = f;
        if (this.shown > 0.0f) {
            invalidate();
        }
    }

    public final float getFraction() {
        return this.target;
    }

    public final void set(float f, boolean z) {
        float coerceIn = RangesKt.coerceIn(f, 0.0f, 1.0f);
        this.target = coerceIn;
        if (z && isAttachedToWindow() && Math.abs(coerceIn - this.shown) > 0.002f) {
            ValueAnimator valueAnimator = this.animator;
            if (valueAnimator != null) {
                valueAnimator.cancel();
            }
            ValueAnimator ofFloat = ValueAnimator.ofFloat(this.shown, coerceIn);
            ofFloat.setDuration(300L);
            ofFloat.setInterpolator(Ease.INSTANCE.getInOut());
            ofFloat.addUpdateListener(new ProgressTrack$$ExternalSyntheticLambda0(this));
            ofFloat.start();
            this.animator = ofFloat;
            return;
        }
        ValueAnimator valueAnimator2 = this.animator;
        if (valueAnimator2 == null || !valueAnimator2.isRunning()) {
            this.shown = coerceIn;
            invalidate();
        }
    }

    private static final void set$lambda$1$lambda$0(ProgressTrack progressTrack, ValueAnimator it) {
        Intrinsics.checkNotNullParameter(it, "it");
        Object animatedValue = it.getAnimatedValue();
        Intrinsics.checkNotNull(animatedValue, "null cannot be cast to non-null type kotlin.Float");
        progressTrack.shown = RangesKt.coerceIn(((Float) animatedValue).floatValue(), 0.0f, 1.0f);
        progressTrack.invalidate();
    }

    @Override
    protected void onMeasure(int i, int i2) {
        ProgressTrack progressTrack = this;
        setMeasuredDimension(View.resolveSize(ThemeKt.dp(progressTrack, (Number) 200), i), View.resolveSize(ThemeKt.dp(progressTrack, (Number) 4), i2));
    }

    @Override
    protected void onDraw(Canvas canvas) {
        Intrinsics.checkNotNullParameter(canvas, "canvas");
        float min = Math.min(this.lineHeight, getHeight());
        float height = (getHeight() - min) / 2.0f;
        float f = min / 2.0f;
        this.rect.set(0.0f, height, getWidth(), height + min);
        this.track.setColor(Ui.INSTANCE.getC().getTrack());
        canvas.drawRoundRect(this.rect, f, f, this.track);
        if (this.shown <= 0.0f) {
            return;
        }
        float coerceAtLeast = RangesKt.coerceAtLeast(getWidth() * this.shown, min);
        this.rect.right = coerceAtLeast;
        this.fill.setColor(this.fillColor);
        canvas.drawRoundRect(this.rect, f, f, this.fill);
        if (this.shimmer >= 0.0f) {
            ProgressTrack progressTrack = this;
            if (coerceAtLeast > ThemeKt.dpf(progressTrack, (Number) 24)) {
                canvas.save();
                canvas.clipRect(this.rect);
                this.shineMatrix.setTranslate((-ThemeKt.dpf(progressTrack, (Number) 28)) + ((ThemeKt.dpf(progressTrack, (Number) 56) + coerceAtLeast) * this.shimmer), 0.0f);
                this.shineShader.setLocalMatrix(this.shineMatrix);
                this.shine.setAlpha(Ui.INSTANCE.getC().getDark() ? 110 : 150);
                canvas.drawRect(this.rect, this.shine);
                canvas.restore();
            }
        }
        float height2 = (getHeight() - min) / 2.0f;
        if (height2 >= ThemeKt.dpf(this, (Number) 3)) {
            float f2 = height2 + f;
            RadialGradient radialGradient = this.glowShader;
            if (radialGradient == null) {
                radialGradient = new RadialGradient(0.0f, 0.0f, 1.0f, Ui.INSTANCE.withAlpha(this.fillColor, 0.55f), Ui.INSTANCE.withAlpha(this.fillColor, 0.0f), Shader.TileMode.CLAMP);
                this.glowShader = radialGradient;
            }
            this.glow.setShader(radialGradient);
            canvas.save();
            float f3 = coerceAtLeast - f;
            canvas.translate(f3, getHeight() / 2.0f);
            canvas.scale(1.6f * f2, f2);
            canvas.drawCircle(0.0f, 0.0f, 1.0f, this.glow);
            canvas.restore();
            this.fill.setColor(Ui.INSTANCE.withAlpha(Ui.INSTANCE.getC().getDark() ? Ui.INSTANCE.getC().getOnGreen() : -1, 0.9f));
            canvas.drawCircle(f3, getHeight() / 2.0f, f * 0.55f, this.fill);
        }
    }
}

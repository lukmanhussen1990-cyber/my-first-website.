package com.imran.examcountdown.ui.widgets;

import android.graphics.Canvas;
import android.graphics.ColorFilter;
import android.graphics.Paint;
import android.graphics.drawable.Drawable;
import com.imran.examcountdown.ui.Ease;
import com.imran.examcountdown.ui.Ui;
import kotlin.Deprecated;
import kotlin.Metadata;
import kotlin.jvm.internal.Intrinsics;

public final class GoldRipple extends Drawable {
    private final int color;
    private final float cx;
    private final float cy;
    private final float from;
    private final Paint paint;
    private float progress;
    private final float reach;
    private final float strokePx;

    @Override
    @Deprecated(message = "Deprecated in Java")
    public int getOpacity() {
        return -3;
    }

    @Override
    public void setAlpha(int i) {
    }

    @Override
    public void setColorFilter(ColorFilter colorFilter) {
    }

    public GoldRipple(float f, float f2, float f3, float f4, int i, float f5) {
        this.cx = f;
        this.cy = f2;
        this.from = f3;
        this.reach = f4;
        this.color = i;
        this.strokePx = f5;
        Paint paint = new Paint(1);
        paint.setStyle(Paint.Style.STROKE);
        this.paint = paint;
        float f6 = f3 + f4 + f5;
        setBounds((int) (f - f6), (int) (f2 - f6), ((int) (f + f6)) + 1, ((int) (f2 + f6)) + 1);
    }

    public final float getProgress() {
        return this.progress;
    }

    public final void setProgress(float f) {
        this.progress = f;
        invalidateSelf();
    }

    @Override
    public void draw(Canvas canvas) {
        Intrinsics.checkNotNullParameter(canvas, "canvas");
        float f = this.progress;
        if (f <= 0.0f || f >= 1.0f) {
            return;
        }
        this.paint.setStrokeWidth(this.strokePx * (1.0f - (f * 0.5f)));
        this.paint.setColor(Ui.INSTANCE.withAlpha(this.color, ((float) Math.pow(1.0f - this.progress, 1.3f)) * 0.9f));
        canvas.drawCircle(this.cx, this.cy, this.from + (this.reach * Ease.INSTANCE.cubicOut(this.progress)), this.paint);
    }
}

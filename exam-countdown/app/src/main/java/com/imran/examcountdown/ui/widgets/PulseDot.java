package com.imran.examcountdown.ui.widgets;

import android.content.Context;
import android.graphics.Canvas;
import android.graphics.Paint;
import android.view.View;
import com.imran.examcountdown.ui.Ease;
import com.imran.examcountdown.ui.ThemeKt;
import com.imran.examcountdown.ui.Ui;
import kotlin.Metadata;
import kotlin.jvm.internal.Intrinsics;

public final class PulseDot extends View {
    private final int color;
    private final Paint dot;
    private float phase;
    private final Paint ring;

    /* JADX WARN: 'super' call moved to the top of the method (can break code semantics) */
    public PulseDot(Context context, int i) {
        super(context);
        Intrinsics.checkNotNullParameter(context, "context");
        this.color = i;
        this.phase = -1.0f;
        this.dot = new Paint(1);
        Paint paint = new Paint(1);
        paint.setStyle(Paint.Style.STROKE);
        this.ring = paint;
        setImportantForAccessibility(2);
    }

    public final float getPhase() {
        return this.phase;
    }

    public final void setPhase(float f) {
        if (this.phase == f) {
            return;
        }
        this.phase = f;
        invalidate();
    }

    @Override
    protected void onDraw(Canvas canvas) {
        Intrinsics.checkNotNullParameter(canvas, "canvas");
        float width = getWidth() / 2.0f;
        float height = getHeight() / 2.0f;
        PulseDot pulseDot = this;
        float dpf = ThemeKt.dpf(pulseDot, (Number) 4);
        float min = Math.min(width, height) - ThemeKt.dpf(pulseDot, (Number) 1);
        if (this.phase >= 0.0f) {
            for (int i = 0; i < 2; i++) {
                float f = (this.phase + (i * 0.5f)) % 1.0f;
                float cubicOut = Ease.INSTANCE.cubicOut(f);
                float f2 = 1.0f - f;
                this.ring.setStrokeWidth((ThemeKt.dpf(pulseDot, Float.valueOf(1.6f)) * f2) + ThemeKt.dpf(pulseDot, Float.valueOf(0.4f)));
                this.ring.setColor(Ui.INSTANCE.withAlpha(this.color, f2 * 0.7f));
                canvas.drawCircle(width, height, ((min - dpf) * cubicOut) + dpf, this.ring);
            }
        }
        this.dot.setColor(this.color);
        float f3 = this.phase;
        canvas.drawCircle(width, height, dpf * (f3 >= 0.0f ? 1.0f + (((float) Math.sin(f3 * 6.283f)) * 0.12f) : 1.0f), this.dot);
    }
}

package com.imran.examcountdown.ui.widgets;

import android.content.Context;
import android.graphics.Canvas;
import android.graphics.LinearGradient;
import android.graphics.Matrix;
import android.graphics.Paint;
import android.graphics.Path;
import android.graphics.RectF;
import android.graphics.Shader;
import android.widget.LinearLayout;
import com.imran.examcountdown.ui.Ease;
import com.imran.examcountdown.ui.FxKt;
import com.imran.examcountdown.ui.ThemeKt;
import kotlin.Metadata;
import kotlin.jvm.internal.DefaultConstructorMarker;
import kotlin.jvm.internal.Intrinsics;

public final class SheenCard extends LinearLayout {
    public static final Companion Companion = new Companion(null);
    private static final float SWEEP = 0.32f;
    private final RectF box;
    private final Path clip;
    private boolean lastDrawn;
    private final Matrix matrix;
    private final Paint paint;
    private final float radiusDp;
    private final LinearGradient shader;
    private float sheen;

    /* JADX WARN: 'super' call moved to the top of the method (can break code semantics) */
    public SheenCard(Context context, float f) {
        super(context);
        Intrinsics.checkNotNullParameter(context, "context");
        this.radiusDp = f;
        this.sheen = -1.0f;
        this.clip = new Path();
        this.box = new RectF();
        Paint paint = new Paint(1);
        this.paint = paint;
        this.matrix = new Matrix();
        SheenCard sheenCard = this;
        LinearGradient linearGradient = new LinearGradient(-ThemeKt.dpf(sheenCard, (Number) 60), 0.0f, ThemeKt.dpf(sheenCard, (Number) 60), 0.0f, new int[]{16777215, 788529151, 16777215}, (float[]) null, Shader.TileMode.CLAMP);
        this.shader = linearGradient;
        paint.setShader(linearGradient);
    }

    public final float getSheen() {
        return this.sheen;
    }

    public final void setSheen(float f) {
        if (this.sheen == f) {
            return;
        }
        this.sheen = f;
        if ((0.0f > f || f > SWEEP) && (f == -1.0f || !this.lastDrawn)) {
            return;
        }
        invalidate();
    }

    @Override
    protected void dispatchDraw(Canvas canvas) {
        Intrinsics.checkNotNullParameter(canvas, "canvas");
        float f = this.sheen;
        float window = f >= 0.0f ? FxKt.window(f, 0.0f, SWEEP) : 0.0f;
        boolean z = window > 0.0f && window < 1.0f;
        this.lastDrawn = z;
        if (z) {
            float width = getWidth();
            float height = getHeight();
            this.box.set(0.0f, 0.0f, width, height);
            this.clip.reset();
            SheenCard sheenCard = this;
            this.clip.addRoundRect(this.box, ThemeKt.dpf(sheenCard, Float.valueOf(this.radiusDp)), ThemeKt.dpf(sheenCard, Float.valueOf(this.radiusDp)), Path.Direction.CW);
            canvas.save();
            canvas.clipPath(this.clip);
            this.matrix.setTranslate((-ThemeKt.dpf(sheenCard, (Number) 60)) + ((ThemeKt.dpf(sheenCard, (Number) 120) + width) * Ease.INSTANCE.cubicInOut(window)), 0.0f);
            this.matrix.postRotate(-20.0f, width / 2.0f, height / 2.0f);
            this.shader.setLocalMatrix(this.matrix);
            canvas.drawRect(this.box, this.paint);
            canvas.restore();
        }
        super.dispatchDraw(canvas);
    }

    public static final class Companion {
        public Companion(DefaultConstructorMarker defaultConstructorMarker) {
            this();
        }

        private Companion() {
        }
    }
}

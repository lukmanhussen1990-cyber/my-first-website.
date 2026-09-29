package com.imran.examcountdown.ui.widgets;

import android.content.Context;
import android.graphics.Canvas;
import android.graphics.Paint;
import android.graphics.RadialGradient;
import android.graphics.Shader;
import android.view.View;
import com.imran.examcountdown.core.ModelKt;
import com.imran.examcountdown.ui.Colors;
import com.imran.examcountdown.ui.ThemeKt;
import com.imran.examcountdown.ui.Ui;
import java.util.List;
import kotlin.Metadata;
import kotlin.collections.CollectionsKt;
import kotlin.jvm.internal.Intrinsics;

public final class AuroraView extends View {
    private final Colors c;
    private final Paint glowPaint;
    private final List<Glow> glows;
    private boolean moving;
    private int scroll;
    private float seconds;

    public AuroraView(Context context) {
        super(context);
        Intrinsics.checkNotNullParameter(context, "context");
        Colors c = Ui.INSTANCE.getC();
        this.c = c;
        Glow[] glowArr = new Glow[3];
        glowArr[0] = new Glow(0.92f, 0.1f, 0.85f, Ui.INSTANCE.withAlpha(c.getGold(), c.getDark() ? 0.11f : 0.15f), 34.0f, 17.0f, 0.0f);
        glowArr[1] = new Glow(0.04f, 0.3f, 0.95f, Ui.INSTANCE.withAlpha(c.getDark() ? c.getGreen() : c.getGreenText(), c.getDark() ? 0.3f : 0.07f), 42.0f, 23.0f, 2.1f);
        glowArr[2] = new Glow(0.62f, 0.56f, 0.7f, Ui.INSTANCE.withAlpha(c.getGold(), c.getDark() ? 0.06f : 0.08f), 28.0f, 29.0f, 4.2f);
        this.glows = CollectionsKt.listOf(glowArr);
        this.glowPaint = new Paint(1);
        setImportantForAccessibility(2);
    }

    private static final class Glow {
        private final int color;
        private final float fx;
        private final float fy;
        private final float orbitDp;
        private final float period;
        private final float phase;
        private RadialGradient shader;
        private final float size;

        public Glow(float f, float f2, float f3, int i, float f4, float f5, float f6) {
            this.fx = f;
            this.fy = f2;
            this.size = f3;
            this.color = i;
            this.orbitDp = f4;
            this.period = f5;
            this.phase = f6;
        }

        public final float getFx() {
            return this.fx;
        }

        public final float getFy() {
            return this.fy;
        }

        public final float getSize() {
            return this.size;
        }

        public final int getColor() {
            return this.color;
        }

        public final float getOrbitDp() {
            return this.orbitDp;
        }

        public final float getPeriod() {
            return this.period;
        }

        public final float getPhase() {
            return this.phase;
        }

        public final RadialGradient getShader() {
            return this.shader;
        }

        public final void setShader(RadialGradient radialGradient) {
            this.shader = radialGradient;
        }
    }

    public final boolean getMoving() {
        return this.moving;
    }

    public final void setMoving(boolean z) {
        if (this.moving == z) {
            return;
        }
        this.moving = z;
        invalidate();
    }

    public final int getScroll() {
        return this.scroll;
    }

    public final void setScroll(int i) {
        if (this.scroll == i) {
            return;
        }
        this.scroll = i;
        invalidate();
    }

    public final void frame(long j) {
        if (this.moving) {
            this.seconds = ((float) (j % ModelKt.HOUR)) / 1000.0f;
            invalidate();
        }
    }

    @Override
    protected void onSizeChanged(int i, int i2, int i3, int i4) {
        for (Glow glow : this.glows) {
            glow.setShader(new RadialGradient(0.0f, 0.0f, 1.0f, new int[]{glow.getColor(), Ui.INSTANCE.withAlpha(glow.getColor(), 0.0f)}, (float[]) null, Shader.TileMode.CLAMP));
        }
    }

    @Override
    protected void onDraw(Canvas canvas) {
        Intrinsics.checkNotNullParameter(canvas, "canvas");
        float width = getWidth();
        float height = getHeight();
        if (width == 0.0f) {
            return;
        }
        float f = this.moving ? this.seconds : 0.0f;
        float f2 = (-this.scroll) * 0.35f;
        for (Glow glow : this.glows) {
            float period = ((f / glow.getPeriod()) * 6.283f) + glow.getPhase();
            AuroraView auroraView = this;
            float size = glow.getSize() * width * ((((float) Math.sin(period * 1.3f)) * 0.06f) + 1.0f);
            this.glowPaint.setShader(glow.getShader());
            canvas.save();
            canvas.translate((glow.getFx() * width) + (((float) Math.cos(period)) * ThemeKt.dpf(auroraView, Float.valueOf(glow.getOrbitDp()))), (glow.getFy() * height) + (((float) Math.sin(0.8f * period)) * ThemeKt.dpf(auroraView, Float.valueOf(glow.getOrbitDp()))) + f2);
            canvas.scale(size, size);
            canvas.drawCircle(0.0f, 0.0f, 1.0f, this.glowPaint);
            canvas.restore();
        }
    }
}

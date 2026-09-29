package com.imran.examcountdown.ui.widgets;

import android.animation.ValueAnimator;
import android.content.Context;
import android.graphics.Canvas;
import android.graphics.LinearGradient;
import android.graphics.Matrix;
import android.graphics.Paint;
import android.graphics.RectF;
import android.graphics.Shader;
import android.view.View;
import android.view.animation.LinearInterpolator;
import com.imran.examcountdown.ui.Colors;
import com.imran.examcountdown.ui.Ease;
import com.imran.examcountdown.ui.FxKt;
import com.imran.examcountdown.ui.ThemeKt;
import com.imran.examcountdown.ui.Ui;
import java.util.Collection;
import java.util.List;
import kotlin.Metadata;
import kotlin.NoWhenBranchMatchedException;
import kotlin.collections.CollectionsKt;
import kotlin.enums.EnumEntries;
import kotlin.enums.EnumEntriesKt;
import kotlin.jvm.internal.DefaultConstructorMarker;
import kotlin.jvm.internal.Intrinsics;

public final class SeasonProgressView extends View {
    public static final Companion Companion = new Companion(null);
    private static final float REVEAL_MS = 800.0f;
    private static final float STAGGER_MS = 50.0f;
    private final float gap;
    private final Paint glint;
    private final Matrix glintMatrix;
    private final LinearGradient glintShader;
    private final Paint paint;
    private float pulse;
    private final RectF rect;
    private float revealMs;
    private List<? extends Segment> segments;
    private final Paint stroke;

    public class WhenMappings {
        public static final int[] $EnumSwitchMapping$0;

        static {
            int[] iArr = new int[Segment.values().length];
            try {
                iArr[Segment.DONE.ordinal()] = 1;
            } catch (NoSuchFieldError unused) {
            }
            try {
                iArr[Segment.LIVE.ordinal()] = 2;
            } catch (NoSuchFieldError unused2) {
            }
            try {
                iArr[Segment.TODAY.ordinal()] = 3;
            } catch (NoSuchFieldError unused3) {
            }
            try {
                iArr[Segment.UPCOMING.ordinal()] = 4;
            } catch (NoSuchFieldError unused4) {
            }
            $EnumSwitchMapping$0 = iArr;
        }
    }

    public static void m98$r8$lambda$IH6SPzHVsTOlXbMlFzaW2f_9HI(SeasonProgressView seasonProgressView, ValueAnimator valueAnimator) {
        playReveal$lambda$3$lambda$2(seasonProgressView, valueAnimator);
    }

    /* JADX WARN: 'super' call moved to the top of the method (can break code semantics) */
    public SeasonProgressView(Context context) {
        super(context);
        Intrinsics.checkNotNullParameter(context, "context");
        this.segments = CollectionsKt.emptyList();
        this.pulse = -1.0f;
        this.revealMs = REVEAL_MS;
        this.rect = new RectF();
        SeasonProgressView seasonProgressView = this;
        this.gap = ThemeKt.dpf(seasonProgressView, (Number) 4);
        this.paint = new Paint(1);
        Paint paint = new Paint(1);
        paint.setStyle(Paint.Style.STROKE);
        paint.setStrokeWidth(ThemeKt.dpf(seasonProgressView, Float.valueOf(1.5f)));
        this.stroke = paint;
        Paint paint2 = new Paint(1);
        this.glint = paint2;
        this.glintMatrix = new Matrix();
        LinearGradient linearGradient = new LinearGradient(-ThemeKt.dpf(seasonProgressView, (Number) 14), 0.0f, ThemeKt.dpf(seasonProgressView, (Number) 14), 0.0f, new int[]{16777215, -1275068417, 16777215}, (float[]) null, Shader.TileMode.CLAMP);
        this.glintShader = linearGradient;
        setImportantForAccessibility(2);
        paint2.setShader(linearGradient);
    }

    public enum Segment {
        DONE,
        LIVE,
        TODAY,
        UPCOMING;


        public static EnumEntries<Segment> getEntries() {
            return EnumEntriesKt.enumEntries(values());
        }

        Segment() {
        }
    }

    public final List<Segment> getSegments() {
        return this.segments;
    }

    public final void setSegments(List<? extends Segment> value) {
        Intrinsics.checkNotNullParameter(value, "value");
        if (Intrinsics.areEqual(this.segments, value)) {
            return;
        }
        this.segments = value;
        invalidate();
    }

    public final float getPulse() {
        return this.pulse;
    }

    /* JADX WARN: Removed duplicated region for block: B:13:0x0025  */
    /*
        Code decompiled incorrectly, please refer to instructions dump.
    */
    public final void setPulse(float f) {
        if (this.pulse == f) {
            return;
        }
        this.pulse = f;
        List<? extends Segment> list = this.segments;
        if ((list instanceof Collection) && list.isEmpty()) {
            return;
        }
        for (Segment segment : list) {
            if (segment == Segment.LIVE || segment == Segment.TODAY) {
                invalidate();
                return;
            }
            while (r3.hasNext()) {
            }
        }
    }

    public final void playReveal() {
        ValueAnimator ofFloat = ValueAnimator.ofFloat(0.0f, REVEAL_MS);
        ofFloat.setDuration(800L);
        ofFloat.setInterpolator(new LinearInterpolator());
        ofFloat.addUpdateListener(new SeasonProgressView$$ExternalSyntheticLambda0(this));
        ofFloat.start();
    }

    private static final void playReveal$lambda$3$lambda$2(SeasonProgressView seasonProgressView, ValueAnimator it) {
        Intrinsics.checkNotNullParameter(it, "it");
        Object animatedValue = it.getAnimatedValue();
        Intrinsics.checkNotNull(animatedValue, "null cannot be cast to non-null type kotlin.Float");
        seasonProgressView.revealMs = ((Float) animatedValue).floatValue();
        seasonProgressView.invalidate();
    }

    @Override
    protected void onMeasure(int i, int i2) {
        SeasonProgressView seasonProgressView = this;
        setMeasuredDimension(View.resolveSize(ThemeKt.dp(seasonProgressView, (Number) 200), i), View.resolveSize(ThemeKt.dp(seasonProgressView, (Number) 6), i2));
    }

    @Override
    protected void onDraw(Canvas canvas) {
        float f;
        Intrinsics.checkNotNullParameter(canvas, "canvas");
        int size = this.segments.size();
        if (size == 0) {
            return;
        }
        Colors c = Ui.INSTANCE.getC();
        float height = getHeight();
        float width = (getWidth() - (this.gap * (size - 1))) / size;
        float f2 = height / 2.0f;
        float sin = this.pulse >= 0.0f ? (((float) Math.sin(f * 6.283f)) * 0.5f) + 0.5f : 0.0f;
        for (int i = 0; i < size; i++) {
            float f3 = i;
            float f4 = (this.gap + width) * f3;
            this.rect.set(f4, 0.0f, f4 + width, height);
            this.paint.setColor(c.getTrack());
            canvas.drawRoundRect(this.rect, f2, f2, this.paint);
            float f5 = this.revealMs - (f3 * STAGGER_MS);
            int i2 = WhenMappings.$EnumSwitchMapping$0[this.segments.get(i).ordinal()];
            if (i2 == 1) {
                float cubicOut = Ease.INSTANCE.cubicOut(FxKt.window(f5, 0.0f, 300.0f));
                if (cubicOut > 0.0f) {
                    this.rect.right = (cubicOut * width) + f4;
                    this.paint.setColor(c.getGreen());
                    canvas.drawRoundRect(this.rect, f2, f2, this.paint);
                    float window = FxKt.window(f5, 160.0f, 320.0f);
                    if (window > 0.0f && window < 1.0f) {
                        canvas.save();
                        canvas.clipRect(this.rect);
                        SeasonProgressView seasonProgressView = this;
                        this.glintMatrix.setTranslate((f4 - ThemeKt.dpf(seasonProgressView, (Number) 14)) + ((ThemeKt.dpf(seasonProgressView, (Number) 28) + width) * window), 0.0f);
                        this.glintShader.setLocalMatrix(this.glintMatrix);
                        canvas.drawRect(this.rect, this.glint);
                        canvas.restore();
                    }
                }
            } else if (i2 == 2) {
                this.paint.setColor(c.getGold());
                canvas.drawRoundRect(this.rect, f2, f2, this.paint);
                if (sin > 0.0f) {
                    this.paint.setColor(Ui.INSTANCE.withAlpha(-1, 0.35f * sin));
                    canvas.drawRoundRect(this.rect, f2, f2, this.paint);
                }
            } else if (i2 == 3) {
                this.stroke.setColor(Ui.INSTANCE.withAlpha(c.getGold(), ((1.0f - sin) * 0.45f) + 0.55f));
                float f6 = 2;
                this.rect.inset(this.stroke.getStrokeWidth() / f6, this.stroke.getStrokeWidth() / f6);
                canvas.drawRoundRect(this.rect, f2, f2, this.stroke);
                if (sin > 0.0f) {
                    this.paint.setColor(Ui.INSTANCE.withAlpha(c.getGold(), 0.28f * sin));
                    canvas.drawRoundRect(this.rect, f2, f2, this.paint);
                }
            } else if (i2 != 4) {
                throw new NoWhenBranchMatchedException();
            }
        }
    }

    public static final class Companion {
        public Companion(DefaultConstructorMarker defaultConstructorMarker) {
            this();
        }

        private Companion() {
        }
    }
}

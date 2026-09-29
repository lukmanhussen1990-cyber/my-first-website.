package com.imran.examcountdown.ui.widgets;

import android.content.Context;
import android.graphics.Bitmap;
import android.graphics.BitmapShader;
import android.graphics.Canvas;
import android.graphics.LinearGradient;
import android.graphics.Matrix;
import android.graphics.Paint;
import android.graphics.Path;
import android.graphics.Rect;
import android.graphics.Shader;
import android.graphics.SweepGradient;
import android.os.SystemClock;
import android.view.View;
import com.imran.examcountdown.core.AvatarFrame;
import com.imran.examcountdown.ui.Colors;
import com.imran.examcountdown.ui.Ease;
import com.imran.examcountdown.ui.Fonts;
import com.imran.examcountdown.ui.FxKt;
import com.imran.examcountdown.ui.ThemeKt;
import com.imran.examcountdown.ui.Ui;
import java.util.HashMap;
import kotlin.KotlinVersion;
import kotlin.Metadata;
import kotlin.NoWhenBranchMatchedException;
import kotlin.jvm.internal.DefaultConstructorMarker;
import kotlin.jvm.internal.Intrinsics;
import kotlin.ranges.RangesKt;

public final class AvatarView extends View {
    private static final int BLACK = -16777216;
    private static final long COMETS_MS = 4800;
    public static final Companion Companion = new Companion(null);
    private static final float DEG = 0.017453292f;
    private static final float FADE_MS = 180.0f;
    private static final long ORBIT_MS = 3600;
    public static final float PHOTO = 0.86f;
    private static final long SHIMMER_CYCLE = 4800;
    private static final long SHIMMER_SWEEP = 1100;
    private static final int WAVE_CRESTS = 6;
    private static final long WAVE_MS = 1500;
    private static final int WHITE = -1;
    private boolean animateFrame;
    private float cx;
    private float cy;
    private final Paint disc;
    private long fadeStart;
    private final Paint fill;
    private AvatarFrame frame;
    private LinearGradient glint;
    private String initials;
    private final Paint letters;
    private SweepGradient metal;
    private long nextDraw;
    private final Path path;
    private Bitmap photo;
    private final Matrix photoMatrix;
    private final Paint photoPaint;
    private AvatarFrame previous;
    private boolean previousMoving;
    private final Paint shaded;
    private final Matrix shaderMatrix;
    private final Paint stroke;
    private final HashMap<Integer, SweepGradient> trails;
    private final Rect visible;

    public class WhenMappings {
        public static final int[] $EnumSwitchMapping$0;

        static {
            int[] iArr = new int[AvatarFrame.values().length];
            try {
                iArr[AvatarFrame.DEFAULT.ordinal()] = 1;
            } catch (NoSuchFieldError unused) {
            }
            try {
                iArr[AvatarFrame.GOLD_ORBIT.ordinal()] = 2;
            } catch (NoSuchFieldError unused2) {
            }
            try {
                iArr[AvatarFrame.EMERALD_WAVE.ordinal()] = 3;
            } catch (NoSuchFieldError unused3) {
            }
            try {
                iArr[AvatarFrame.TWIN_COMETS.ordinal()] = 4;
            } catch (NoSuchFieldError unused4) {
            }
            try {
                iArr[AvatarFrame.GOLD_SHIMMER.ordinal()] = 5;
            } catch (NoSuchFieldError unused5) {
            }
            try {
                iArr[AvatarFrame.NONE.ordinal()] = AvatarView.WAVE_CRESTS;
            } catch (NoSuchFieldError unused6) {
            }
            $EnumSwitchMapping$0 = iArr;
        }
    }

    /* JADX WARN: 'super' call moved to the top of the method (can break code semantics) */
    public AvatarView(Context context) {
        super(context);
        Intrinsics.checkNotNullParameter(context, "context");
        this.initials = "IH";
        this.frame = AvatarFrame.DEFAULT;
        this.photoPaint = new Paint(3);
        this.disc = new Paint(1);
        Paint paint = new Paint(1);
        paint.setTextAlign(Paint.Align.CENTER);
        paint.setTypeface(Fonts.INSTANCE.getSerif());
        this.letters = paint;
        this.photoMatrix = new Matrix();
        Paint paint2 = new Paint(1);
        paint2.setStyle(Paint.Style.STROKE);
        this.stroke = paint2;
        this.fill = new Paint(1);
        this.shaded = new Paint(1);
        this.path = new Path();
        this.shaderMatrix = new Matrix();
        this.trails = new HashMap<>();
        this.visible = new Rect();
    }

    public final String getInitials() {
        return this.initials;
    }

    public final void setInitials(String value) {
        Intrinsics.checkNotNullParameter(value, "value");
        this.initials = value;
        invalidate();
    }

    public final AvatarFrame getFrame() {
        return this.frame;
    }

    public final boolean getAnimateFrame() {
        return this.animateFrame;
    }

    public final void setAnimateFrame(boolean z) {
        if (this.animateFrame == z) {
            return;
        }
        this.animateFrame = z;
        if (this.frame.getAnimated() && isAttachedToWindow()) {
            startFade(this.frame, !z);
        }
        invalidate();
    }

    public final boolean getHasPhoto() {
        return this.photo != null;
    }

    public final boolean isFrameMoving() {
        return moving() && isShown();
    }

    public final void setPhoto(Bitmap bitmap) {
        this.photo = bitmap;
        this.photoPaint.setShader(bitmap != null ? new BitmapShader(bitmap, Shader.TileMode.CLAMP, Shader.TileMode.CLAMP) : null);
        updateMatrix();
        invalidate();
    }

    public static void setFrame$default(AvatarView avatarView, AvatarFrame avatarFrame, boolean z, int i, Object obj) {
        if ((i & 2) != 0) {
            z = false;
        }
        avatarView.setFrame(avatarFrame, z);
    }

    public final void setFrame(AvatarFrame value, boolean z) {
        Intrinsics.checkNotNullParameter(value, "value");
        AvatarFrame avatarFrame = this.frame;
        if (value == avatarFrame) {
            return;
        }
        this.frame = value;
        if (z && isAttachedToWindow()) {
            startFade(avatarFrame, this.animateFrame && avatarFrame.getAnimated());
        } else {
            this.previous = null;
        }
        invalidate();
    }

    public final void copyTo(AvatarView other) {
        Intrinsics.checkNotNullParameter(other, "other");
        other.setInitials(this.initials);
        other.setPhoto(this.photo);
        setFrame$default(other, this.frame, false, 2, null);
        other.setAnimateFrame(this.animateFrame);
    }

    private final void startFade(AvatarFrame avatarFrame, boolean z) {
        this.previous = avatarFrame;
        this.previousMoving = z;
        this.fadeStart = SystemClock.uptimeMillis();
    }

    private final boolean moving() {
        return this.animateFrame && this.frame.getAnimated();
    }

    private final float photoRadius() {
        return (Math.min(getWidth(), getHeight()) / 2.0f) * 0.86f;
    }

    @Override
    protected void onSizeChanged(int i, int i2, int i3, int i4) {
        this.cx = i / 2.0f;
        this.cy = i2 / 2.0f;
        this.trails.clear();
        this.metal = null;
        this.glint = null;
        updateMatrix();
    }

    private final void updateMatrix() {
        Bitmap bitmap = this.photo;
        if (bitmap == null) {
            return;
        }
        float photoRadius = photoRadius() * 2.0f;
        if (photoRadius <= 0.0f) {
            return;
        }
        float min = photoRadius / Math.min(bitmap.getWidth(), bitmap.getHeight());
        this.photoMatrix.setScale(min, min);
        this.photoMatrix.postTranslate((getWidth() - (bitmap.getWidth() * min)) / 2.0f, (getHeight() - (bitmap.getHeight() * min)) / 2.0f);
        Shader shader = this.photoPaint.getShader();
        if (shader != null) {
            shader.setLocalMatrix(this.photoMatrix);
        }
    }

    @Override
    protected void onDraw(Canvas canvas) {
        Intrinsics.checkNotNullParameter(canvas, "canvas");
        float min = Math.min(getWidth(), getHeight()) / 2.0f;
        if (min <= 0.0f) {
            return;
        }
        float f = min * 0.86f;
        Colors c = Ui.INSTANCE.getC();
        if (this.photo != null) {
            canvas.drawCircle(this.cx, this.cy, f, this.photoPaint);
        } else {
            this.disc.setColor(c.getGreen());
            canvas.drawCircle(this.cx, this.cy, f, this.disc);
            this.letters.setColor(c.getOnGreen());
            this.letters.setTextSize(0.8f * f);
            canvas.drawText(this.initials, this.cx, this.cy - ((this.letters.descent() + this.letters.ascent()) / 2.0f), this.letters);
        }
        long uptimeMillis = SystemClock.uptimeMillis();
        boolean moving = moving();
        AvatarFrame avatarFrame = this.previous;
        float window = avatarFrame == null ? 1.0f : FxKt.window((float) (uptimeMillis - this.fadeStart), 0.0f, FADE_MS);
        if (avatarFrame != null && window < 1.0f) {
            drawFrame(canvas, avatarFrame, f, min, uptimeMillis, this.previousMoving, 1.0f - window);
        } else {
            this.previous = null;
        }
        drawFrame(canvas, this.frame, f, min, uptimeMillis, moving, window);
        if (moving || this.previous != null) {
            scheduleNext(uptimeMillis, this.previous != null);
        }
    }

    private final void scheduleNext(long j, boolean z) {
        if (isShown() && getWindowVisibility() == 0 && getLocalVisibleRect(this.visible)) {
            if (z || this.frame != AvatarFrame.GOLD_SHIMMER) {
                postInvalidateOnAnimation();
                return;
            }
            long j2 = j % 4800;
            if (j2 < SHIMMER_SWEEP) {
                postInvalidateOnAnimation();
            } else if (this.nextDraw <= j) {
                long j3 = 4800 - j2;
                this.nextDraw = j + j3;
                postInvalidateDelayed(j3);
            }
        }
    }

    private final void drawFrame(Canvas canvas, AvatarFrame avatarFrame, float f, float f2, long j, boolean z, float f3) {
        if (f3 <= 0.0f) {
            return;
        }
        switch (WhenMappings.$EnumSwitchMapping$0[avatarFrame.ordinal()]) {
            case 1:
                drawDefault(canvas, f, f3);
                return;
            case 2:
                drawOrbit(canvas, f, f2, j, z, f3);
                return;
            case 3:
                drawWaves(canvas, f, f2, j, z, f3);
                return;
            case 4:
                drawComets(canvas, f, f2, j, z, f3);
                return;
            case 5:
                drawShimmer(canvas, f, f2, j, z, f3);
                return;
            case WAVE_CRESTS:
                return;
            default:
                throw new NoWhenBranchMatchedException();
        }
    }

    private final void drawDefault(Canvas canvas, float f, float f2) {
        float max = Math.max(ThemeKt.dpf(this, Float.valueOf(1.5f)), 0.055f * f);
        this.stroke.setStrokeWidth(max);
        this.stroke.setColor(Ui.INSTANCE.withAlpha(Ui.INSTANCE.getC().getGold(), f2 * 0.9f));
        canvas.drawCircle(this.cx, this.cy, (f + (max / 2.0f)) - 0.5f, this.stroke);
    }

    private final void drawOrbit(Canvas canvas, float f, float f2, long j, boolean z, float f3) {
        float f4 = f2 - f;
        float f5 = f4 * 0.5f;
        float f6 = f + f5;
        int gold = Ui.INSTANCE.getC().getGold();
        AvatarView avatarView = this;
        this.stroke.setStrokeWidth(Math.max(ThemeKt.dpf(avatarView, Float.valueOf(1.0f)), 0.03f * f));
        this.stroke.setColor(Ui.INSTANCE.withAlpha(gold, 0.5f * f3));
        canvas.drawCircle(this.cx, this.cy, f6, this.stroke);
        float fraction = z ? (fraction(j, ORBIT_MS) * 360.0f) - 90.0f : -45.0f;
        comet(canvas, f6, fraction, 62.0f, f5, f4 * 0.08f, gold, f3 * 0.95f);
        double d = DEG * fraction;
        float cos = this.cx + (((float) Math.cos(d)) * f6);
        float sin = this.cy + (((float) Math.sin(d)) * f6);
        this.fill.setColor(Ui.INSTANCE.withAlpha(gold, 0.35f * f3));
        canvas.drawCircle(cos, sin, f5, this.fill);
        this.fill.setColor(Ui.INSTANCE.withAlpha(FxKt.lerpColor(gold, -1, 0.55f), f3));
        canvas.drawCircle(cos, sin, Math.max(ThemeKt.dpf(avatarView, Float.valueOf(1.2f)), f4 * 0.26f), this.fill);
    }

    private final void drawWaves(Canvas canvas, float f, float f2, long j, boolean z, float f3) {
        float f4 = f2 - f;
        float f5 = 0.5f * f4;
        float f6 = f + f5;
        AvatarView avatarView = this;
        float max = Math.max(ThemeKt.dpf(avatarView, Float.valueOf(1.1f)), f4 * 0.2f);
        float f7 = 1.8f * max;
        float coerceAtLeast = RangesKt.coerceAtLeast(Math.min(f4 * 0.24f, (f5 - (f7 / 2.0f)) - ThemeKt.dpf(avatarView, Float.valueOf(0.2f))), 0.0f);
        float fraction = z ? fraction(j, WAVE_MS) * 6.2831855f : 0.0f;
        boolean dark = Ui.INSTANCE.getC().getDark();
        int i = dark ? -11549556 : -14775721;
        int i2 = dark ? -5708346 : -9451878;
        this.stroke.setStrokeCap(Paint.Cap.ROUND);
        int i3 = 0;
        while (i3 < 2) {
            float f8 = 0.8f;
            wave(f6, coerceAtLeast, WAVE_CRESTS, i3 == 0 ? fraction : (fraction * 0.8f) + 3.1415927f);
            int i4 = i3 == 0 ? i : i2;
            this.stroke.setStrokeWidth(f7);
            this.stroke.setColor(Ui.INSTANCE.withAlpha(i4, 0.18f * f3));
            canvas.drawPath(this.path, this.stroke);
            this.stroke.setStrokeWidth(max);
            Paint paint = this.stroke;
            Ui ui = Ui.INSTANCE;
            if (i3 == 0) {
                f8 = 0.95f;
            }
            paint.setColor(ui.withAlpha(i4, f8 * f3));
            canvas.drawPath(this.path, this.stroke);
            i3++;
        }
        this.stroke.setStrokeCap(Paint.Cap.BUTT);
    }

    private final void wave(float f, float f2, int i, float f3) {
        float f4;
        this.path.reset();
        int i2 = 0;
        while (true) {
            float sin = (((float) Math.sin((i * f4) - f3)) * f2) + f;
            double d = (i2 * 6.2831855f) / 144;
            float cos = this.cx + (((float) Math.cos(d)) * sin);
            float sin2 = this.cy + (((float) Math.sin(d)) * sin);
            Path path = this.path;
            if (i2 == 0) {
                path.moveTo(cos, sin2);
            } else {
                path.lineTo(cos, sin2);
            }
            if (i2 == 144) {
                this.path.close();
                return;
            }
            i2++;
        }
    }

    private final void drawComets(Canvas canvas, float f, float f2, long j, boolean z, float f3) {
        float f4 = f2 - f;
        float f5 = f + (0.5f * f4);
        int gold = Ui.INSTANCE.getC().getGold();
        int i = Ui.INSTANCE.getC().getDark() ? -10695787 : -13919645;
        AvatarView avatarView = this;
        this.stroke.setStrokeWidth(Math.max(ThemeKt.dpf(avatarView, Float.valueOf(0.8f)), 0.02f * f));
        this.stroke.setColor(Ui.INSTANCE.withAlpha(gold, 0.16f * f3));
        canvas.drawCircle(this.cx, this.cy, f5, this.stroke);
        float fraction = z ? (-135.0f) + (fraction(j, 4800L) * 360.0f) : -135.0f;
        int i2 = 0;
        while (i2 < 2) {
            float f6 = fraction + (i2 * FADE_MS);
            int i3 = i2 == 0 ? i : gold;
            int i4 = gold;
            AvatarView avatarView2 = avatarView;
            comet(canvas, f5, f6, 110.0f, f4 * 0.52f, f4 * 0.06f, i3, f3 * 0.85f);
            float f7 = DEG * f6;
            this.fill.setColor(Ui.INSTANCE.withAlpha(FxKt.lerpColor(i3, -1, 0.35f), f3));
            double d = f7;
            canvas.drawCircle(this.cx + (((float) Math.cos(d)) * f5), this.cy + (((float) Math.sin(d)) * f5), Math.max(ThemeKt.dpf(avatarView2, Float.valueOf(1.1f)), 0.24f * f4), this.fill);
            i2++;
            avatarView = avatarView2;
            gold = i4;
        }
    }

    private final void drawShimmer(Canvas canvas, float f, float f2, long j, boolean z, float f3) {
        AvatarView avatarView;
        float f4;
        float f5;
        float f6;
        float f7 = f2 - f;
        AvatarView avatarView2 = this;
        float coerceAtMost = RangesKt.coerceAtMost(Math.max(ThemeKt.dpf(avatarView2, Float.valueOf(2.0f)), 0.62f * f7), f7);
        float f8 = coerceAtMost / 2.0f;
        float f9 = (f + f8) - 0.5f;
        int gold = Ui.INSTANCE.getC().getGold();
        SweepGradient sweepGradient = this.metal;
        if (sweepGradient == null) {
            f4 = f8;
            avatarView = avatarView2;
            f5 = 0.55f;
            SweepGradient sweepGradient2 = new SweepGradient(this.cx, this.cy, new int[]{FxKt.lerpColor(gold, BLACK, 0.28f), gold, FxKt.lerpColor(gold, -1, 0.55f), gold, FxKt.lerpColor(gold, BLACK, 0.3f), gold, FxKt.lerpColor(gold, -1, 0.4f), gold, FxKt.lerpColor(gold, BLACK, 0.28f)}, (float[]) null);
            Matrix matrix = new Matrix();
            matrix.setRotate(-30.0f, this.cx, this.cy);
            sweepGradient2.setLocalMatrix(matrix);
            this.metal = sweepGradient2;
            sweepGradient = sweepGradient2;
        } else {
            avatarView = avatarView2;
            f4 = f8;
            f5 = 0.55f;
        }
        this.shaded.setStyle(Paint.Style.STROKE);
        this.shaded.setStrokeWidth(coerceAtMost);
        this.shaded.setShader(sweepGradient);
        Paint paint = this.shaded;
        float f10 = ((float) KotlinVersion.MAX_COMPONENT_VALUE) * f3;
        paint.setAlpha((int) f10);
        canvas.drawCircle(this.cx, this.cy, f9, this.shaded);
        this.stroke.setStrokeWidth(Math.max(ThemeKt.dpf(avatarView, Float.valueOf(0.6f)), coerceAtMost * 0.12f));
        this.stroke.setColor(Ui.INSTANCE.withAlpha(FxKt.lerpColor(gold, BLACK, 0.35f), f3 * f5));
        canvas.drawCircle(this.cx, this.cy, (f9 + f4) - (this.stroke.getStrokeWidth() / 2.0f), this.stroke);
        if (z) {
            float window = FxKt.window((float) (j % 4800), 0.0f, 1100.0f);
            if (window <= 0.0f || window >= 1.0f) {
                return;
            }
            LinearGradient linearGradient = this.glint;
            if (linearGradient == null) {
                f6 = f2;
                linearGradient = new LinearGradient((-f6) * 0.35f, 0.0f, f6 * 0.35f, 0.0f, new int[]{16777215, -419430401, 16777215}, (float[]) null, Shader.TileMode.CLAMP);
                this.glint = linearGradient;
            } else {
                f6 = f2;
            }
            this.shaderMatrix.setTranslate(this.cx + ((-f6) * 1.4f) + (f6 * 2.8f * Ease.INSTANCE.cubicInOut(window)), this.cy);
            this.shaderMatrix.postRotate(45.0f, this.cx, this.cy);
            linearGradient.setLocalMatrix(this.shaderMatrix);
            this.shaded.setShader(linearGradient);
            this.shaded.setAlpha((int) (f10 * (Ui.INSTANCE.getC().getDark() ? 0.75f : 0.9f)));
            canvas.drawCircle(this.cx, this.cy, f9, this.shaded);
        }
    }

    private final void comet(Canvas canvas, float f, float f2, float f3, float f4, float f5, int i, float f6) {
        float f7;
        double d;
        int i2;
        float f8 = f4;
        float f9 = f5;
        this.path.reset();
        int i3 = 0;
        while (true) {
            f7 = 28;
            float f10 = i3 / f7;
            d = 1.4f;
            double d2 = (f2 - ((1.0f - f10) * f3)) * DEG;
            float lerp = f + (FxKt.lerp(f9, f8, (float) Math.pow(f10, d)) / 2.0f);
            float cos = this.cx + (((float) Math.cos(d2)) * lerp);
            float sin = this.cy + (((float) Math.sin(d2)) * lerp);
            Path path = this.path;
            if (i3 == 0) {
                path.moveTo(cos, sin);
            } else {
                path.lineTo(cos, sin);
            }
            i2 = 28;
            if (i3 == 28) {
                break;
            }
            i3++;
        }
        while (-1 < i2) {
            float f11 = i2 / f7;
            double d3 = (f2 - (f3 * (1.0f - f11))) * DEG;
            float lerp2 = f - (FxKt.lerp(f9, f8, (float) Math.pow(f11, d)) / 2.0f);
            this.path.lineTo(this.cx + (((float) Math.cos(d3)) * lerp2), this.cy + (((float) Math.sin(d3)) * lerp2));
            i2--;
            f8 = f4;
            f9 = f5;
        }
        this.path.close();
        HashMap<Integer, SweepGradient> hashMap = this.trails;
        Integer valueOf = Integer.valueOf((i * 31) + ((int) f3));
        SweepGradient sweepGradient = hashMap.get(valueOf);
        if (sweepGradient == null) {
            sweepGradient = new SweepGradient(this.cx, this.cy, new int[]{Ui.INSTANCE.withAlpha(i, 0.0f), Ui.INSTANCE.withAlpha(i, 1.0f), Ui.INSTANCE.withAlpha(i, 1.0f)}, new float[]{0.0f, f3 / 360.0f, 1.0f});
            hashMap.put(valueOf, sweepGradient);
        }
        SweepGradient sweepGradient2 = sweepGradient;
        this.shaderMatrix.setRotate(f2 - f3, this.cx, this.cy);
        sweepGradient2.setLocalMatrix(this.shaderMatrix);
        this.shaded.setStyle(Paint.Style.FILL);
        this.shaded.setShader(sweepGradient2);
        this.shaded.setAlpha((int) (((float) KotlinVersion.MAX_COMPONENT_VALUE) * f6));
        canvas.drawPath(this.path, this.shaded);
    }

    private final float fraction(long j, long j2) {
        return ((float) (j % j2)) / ((float) j2);
    }

    public static final class Companion {
        public Companion(DefaultConstructorMarker defaultConstructorMarker) {
            this();
        }

        private Companion() {
        }
    }
}

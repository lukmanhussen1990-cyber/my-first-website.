package com.imran.examcountdown.ui.widgets;

import android.content.Context;
import android.graphics.Canvas;
import android.graphics.Paint;
import android.graphics.Path;
import android.graphics.RadialGradient;
import android.graphics.RectF;
import android.graphics.Shader;
import android.os.SystemClock;
import android.view.View;
import com.imran.examcountdown.core.Timetable;
import com.imran.examcountdown.ui.Colors;
import com.imran.examcountdown.ui.Ease;
import com.imran.examcountdown.ui.FxKt;
import com.imran.examcountdown.ui.ThemeKt;
import com.imran.examcountdown.ui.Ui;
import java.util.ArrayList;
import java.util.Iterator;
import java.util.List;
import kotlin.KotlinVersion;
import kotlin.Metadata;
import kotlin.Pair;
import kotlin.TuplesKt;
import kotlin.collections.CollectionsKt;
import kotlin.jvm.functions.Function1;
import kotlin.jvm.internal.DefaultConstructorMarker;
import kotlin.jvm.internal.Intrinsics;
import kotlin.random.Random;
import kotlin.random.RandomKt;
import kotlin.ranges.RangesKt;

public final class ConfettiView extends View {
    public static final Companion Companion = new Companion(null);
    private static final int SHAPE_RECT = 0;
    private static final int SHAPE_RIBBON = 2;
    private static final int SHAPE_ROUND = 1;
    private static final int SHAPE_STAR = 3;
    private long fadeFrom;
    private final ArrayList<Flash> flashes;
    private final Paint glow;
    private long last;
    private final Paint line;
    private final Paint paint;
    private final ArrayList<Piece> pieces;
    private final Random random;
    private final RectF rect;
    private final ArrayList<Shell> shells;
    private final ArrayList<Spark> sparks;
    private final Path star;
    private long until;

    public static boolean $r8$lambda$0CxxysC4Ww1WJFhd9TThpGIei7I(Shell shell) {
        return onDraw$lambda$7(shell);
    }

    public static void $r8$lambda$7K0jRY2dbb6nnnvwICDHRnv5t70(ConfettiView confettiView) {
        burst$lambda$1(confettiView);
    }

    /* JADX WARN: 'super' call moved to the top of the method (can break code semantics) */
    public ConfettiView(Context context) {
        super(context);
        Intrinsics.checkNotNullParameter(context, "context");
        this.pieces = new ArrayList<>();
        this.sparks = new ArrayList<>();
        this.shells = new ArrayList<>();
        this.flashes = new ArrayList<>();
        this.paint = new Paint(1);
        Paint paint = new Paint(1);
        paint.setStrokeCap(Paint.Cap.ROUND);
        this.line = paint;
        this.glow = new Paint(1);
        this.rect = new RectF();
        Path path = new Path();
        this.star = path;
        this.random = RandomKt.Random(SystemClock.uptimeMillis());
        setImportantForAccessibility(2);
        setClickable(false);
        path.moveTo(0.0f, -1.0f);
        path.quadTo(0.14f, -0.14f, 1.0f, 0.0f);
        path.quadTo(0.14f, 0.14f, 0.0f, 1.0f);
        path.quadTo(-0.14f, 0.14f, -1.0f, 0.0f);
        path.quadTo(-0.14f, -0.14f, 0.0f, -1.0f);
        path.close();
    }

    private static final class Piece {
        private final int back;
        private final long born;
        private final int color;
        private float flip;
        private final float flipSpeed;
        private final float h;
        private final long life;
        private float rotation;
        private final int shape;
        private final float spin;
        private float vx;
        private float vy;
        private final float w;
        private final float wobble;
        private float x;
        private float y;

        public Piece(float f, float f2, float f3, float f4, float f5, float f6, float f7, float f8, float f9, float f10, int i, int i2, int i3, float f11, long j, long j2) {
            this.x = f;
            this.y = f2;
            this.vx = f3;
            this.vy = f4;
            this.rotation = f5;
            this.spin = f6;
            this.flip = f7;
            this.flipSpeed = f8;
            this.w = f9;
            this.h = f10;
            this.color = i;
            this.back = i2;
            this.shape = i3;
            this.wobble = f11;
            this.born = j;
            this.life = j2;
        }

        public final float getX() {
            return this.x;
        }

        public final void setX(float f) {
            this.x = f;
        }

        public final float getY() {
            return this.y;
        }

        public final void setY(float f) {
            this.y = f;
        }

        public final float getVx() {
            return this.vx;
        }

        public final void setVx(float f) {
            this.vx = f;
        }

        public final float getVy() {
            return this.vy;
        }

        public final void setVy(float f) {
            this.vy = f;
        }

        public final float getRotation() {
            return this.rotation;
        }

        public final void setRotation(float f) {
            this.rotation = f;
        }

        public final float getSpin() {
            return this.spin;
        }

        public final float getFlip() {
            return this.flip;
        }

        public final void setFlip(float f) {
            this.flip = f;
        }

        public final float getFlipSpeed() {
            return this.flipSpeed;
        }

        public final float getW() {
            return this.w;
        }

        public final float getH() {
            return this.h;
        }

        public final int getColor() {
            return this.color;
        }

        public final int getBack() {
            return this.back;
        }

        public final int getShape() {
            return this.shape;
        }

        public final float getWobble() {
            return this.wobble;
        }

        public final long getBorn() {
            return this.born;
        }

        public final long getLife() {
            return this.life;
        }
    }

    private static final class Spark {
        private final long born;
        private final int color;
        private final float drag;
        private final long life;
        private float px;
        private float py;
        private final float size;
        private final float twinkle;
        private float vx;
        private float vy;
        private float x;
        private float y;

        public Spark(float f, float f2, float f3, float f4, float f5, float f6, int i, float f7, long j, long j2, float f8, float f9) {
            this.x = f;
            this.y = f2;
            this.vx = f3;
            this.vy = f4;
            this.px = f5;
            this.py = f6;
            this.color = i;
            this.size = f7;
            this.born = j;
            this.life = j2;
            this.drag = f8;
            this.twinkle = f9;
        }

        public final float getX() {
            return this.x;
        }

        public final void setX(float f) {
            this.x = f;
        }

        public final float getY() {
            return this.y;
        }

        public final void setY(float f) {
            this.y = f;
        }

        public final float getVx() {
            return this.vx;
        }

        public final void setVx(float f) {
            this.vx = f;
        }

        public final float getVy() {
            return this.vy;
        }

        public final void setVy(float f) {
            this.vy = f;
        }

        public final float getPx() {
            return this.px;
        }

        public final void setPx(float f) {
            this.px = f;
        }

        public final float getPy() {
            return this.py;
        }

        public final void setPy(float f) {
            this.py = f;
        }

        public final int getColor() {
            return this.color;
        }

        public final float getSize() {
            return this.size;
        }

        public final long getBorn() {
            return this.born;
        }

        public final long getLife() {
            return this.life;
        }

        public final float getDrag() {
            return this.drag;
        }

        public final float getTwinkle() {
            return this.twinkle;
        }
    }

    public static final class Shell {
        private final int count;
        private final long explodeAt;
        private boolean exploded;
        private final long launch;
        private final boolean ring;
        private final float x0;
        private final float x1;
        private final float y0;
        private final float y1;

        public Shell(float f, float f2, float f3, float f4, long j, long j2, int i, boolean z, boolean z2) {
            this.x0 = f;
            this.y0 = f2;
            this.x1 = f3;
            this.y1 = f4;
            this.launch = j;
            this.explodeAt = j2;
            this.count = i;
            this.ring = z;
            this.exploded = z2;
        }

        public Shell(float f, float f2, float f3, float f4, long j, long j2, int i, boolean z, boolean z2, int i2, DefaultConstructorMarker defaultConstructorMarker) {
            this(f, f2, f3, f4, j, j2, i, z, (i2 & 256) != 0 ? false : z2);
        }

        public final float getX0() {
            return this.x0;
        }

        public final float getY0() {
            return this.y0;
        }

        public final float getX1() {
            return this.x1;
        }

        public final float getY1() {
            return this.y1;
        }

        public final long getLaunch() {
            return this.launch;
        }

        public final long getExplodeAt() {
            return this.explodeAt;
        }

        public final int getCount() {
            return this.count;
        }

        public final boolean getRing() {
            return this.ring;
        }

        public final boolean getExploded() {
            return this.exploded;
        }

        public final void setExploded(boolean z) {
            this.exploded = z;
        }
    }

    private static final class Flash {
        private final long born;
        private final float radius;
        private final float x;
        private final float y;

        public Flash(float f, float f2, long j, float f3) {
            this.x = f;
            this.y = f2;
            this.born = j;
            this.radius = f3;
        }

        public final long getBorn() {
            return this.born;
        }

        public final float getRadius() {
            return this.radius;
        }

        public final float getX() {
            return this.x;
        }

        public final float getY() {
            return this.y;
        }
    }

    public final boolean isRunning() {
        return SystemClock.uptimeMillis() < this.until && !(this.pieces.isEmpty() && this.sparks.isEmpty() && this.shells.isEmpty());
    }

    public final void burst() {
        if (getWidth() == 0 || getHeight() == 0) {
            post(new ConfettiView$$ExternalSyntheticLambda1(this));
            return;
        }
        clear();
        long uptimeMillis = SystemClock.uptimeMillis();
        float width = getWidth();
        float height = getHeight();
        int i = 0;
        while (true) {
            if (i >= 150) {
                break;
            }
            boolean z = i % 2 == 0;
            double radians = Math.toRadians(this.random.nextDouble(-17.0d, 17.0d) + (z ? -62.0d : -118.0d));
            ConfettiView confettiView = this;
            double dpf = ThemeKt.dpf(confettiView, Float.valueOf(900 + (this.random.nextFloat() * 750)));
            addPiece$default(this, z ? -ThemeKt.dpf(confettiView, (Number) 8) : ThemeKt.dpf(confettiView, (Number) 8) + width, height * ((this.random.nextFloat() * 0.12f) + 0.8f), (float) (Math.cos(radians) * dpf), (float) (Math.sin(radians) * dpf), uptimeMillis + this.random.nextLong(0L, 140L), 4200L, false, 64, null);
            i++;
            height = height;
        }
        float f = height;
        this.shells.add(new Shell(width * 0.28f, f, width * 0.3f, f * 0.27f, uptimeMillis + ((long) Timetable.CORE_MINUTES), uptimeMillis + 820, 54, false, false, 256, null));
        this.shells.add(new Shell(width * 0.74f, f, width * 0.7f, f * 0.2f, uptimeMillis + 520, uptimeMillis + 1180, 54, false, false, 256, null));
        float f2 = width * 0.5f;
        this.shells.add(new Shell(f2, f, f2, f * 0.34f, uptimeMillis + 880, uptimeMillis + 1560, 72, true, false, 256, null));
        for (int i2 = 0; i2 < 46; i2++) {
            ConfettiView confettiView2 = this;
            this.sparks.add(new Spark(this.random.nextFloat() * width, (-ThemeKt.dpf(confettiView2, (Number) 10)) - ((this.random.nextFloat() * f) * 0.3f), ThemeKt.dpf(confettiView2, Float.valueOf((this.random.nextFloat() - 0.5f) * 30)), ThemeKt.dpf(confettiView2, Float.valueOf(60 + (this.random.nextFloat() * 90))), 0.0f, 0.0f, pick(true), ThemeKt.dpf(confettiView2, Float.valueOf((this.random.nextFloat() * 1.6f) + 1.1f)), uptimeMillis + this.random.nextLong(250L, 1700L), 2600L, 0.0f, this.random.nextFloat() * 6.28f));
        }
        this.until = 4600 + uptimeMillis;
        this.fadeFrom = 3500 + uptimeMillis;
        this.last = uptimeMillis;
        postInvalidateOnAnimation();
    }

    private static final void burst$lambda$1(ConfettiView confettiView) {
        confettiView.burst();
    }

    public static void burstAt$default(ConfettiView confettiView, float f, float f2, float f3, int i, Object obj) {
        if ((i & 4) != 0) {
            f3 = 1.0f;
        }
        confettiView.burstAt(f, f2, f3);
    }

    public final void burstAt(float f, float f2, float f3) {
        if (getWidth() == 0 || getHeight() == 0) {
            return;
        }
        long uptimeMillis = SystemClock.uptimeMillis();
        if (!isRunning()) {
            clear();
        }
        int i = (int) (26 * f3);
        for (int i2 = 0; i2 < i; i2++) {
            double radians = Math.toRadians(this.random.nextDouble(-55.0d, 55.0d) - 90.0d);
            double dpf = ThemeKt.dpf(this, Float.valueOf((380 + (this.random.nextFloat() * 520)) * ((float) Math.sqrt(f3))));
            addPiece(f, f2, (float) (Math.cos(radians) * dpf), (float) (Math.sin(radians) * dpf), uptimeMillis, 1500L, true);
        }
        int i3 = (int) (18 * f3);
        for (int i4 = 0; i4 < i3; i4++) {
            ConfettiView confettiView = this;
            float dpf2 = ThemeKt.dpf(confettiView, Float.valueOf((140 + (this.random.nextFloat() * 260)) * ((float) Math.sqrt(f3))));
            double nextFloat = this.random.nextFloat() * 6.283f;
            this.sparks.add(new Spark(f, f2, ((float) Math.cos(nextFloat)) * dpf2, (((float) Math.sin(nextFloat)) * dpf2) - ThemeKt.dpf(confettiView, (Number) 80), f, f2, pick(true), ThemeKt.dpf(confettiView, Float.valueOf((this.random.nextFloat() * 1.4f) + 1.3f)), uptimeMillis, this.random.nextLong(0L, 400L) + 700, 3.2f, this.random.nextFloat() * 6.28f));
        }
        this.flashes.add(new Flash(f, f2, uptimeMillis, ThemeKt.dpf(this, (Number) 46) * f3));
        this.until = Math.max(this.until, uptimeMillis + 1700);
        this.fadeFrom = Math.max(this.fadeFrom, uptimeMillis + 1100);
        long j = this.last;
        if (j == 0) {
            j = uptimeMillis;
        }
        this.last = j;
        postInvalidateOnAnimation();
    }

    public final void stop() {
        clear();
        this.until = 0L;
        invalidate();
    }

    private final void clear() {
        this.pieces.clear();
        this.sparks.clear();
        this.shells.clear();
        this.flashes.clear();
    }

    static int pick$default(ConfettiView confettiView, boolean z, int i, Object obj) {
        if ((i & 1) != 0) {
            z = false;
        }
        return confettiView.pick(z);
    }

    private final int pick(boolean z) {
        int[] iArr;
        Colors c = Ui.INSTANCE.getC();
        if (z) {
            iArr = c.getDark() ? new int[]{c.getGold(), c.getGold(), c.getGoldSoft(), c.getOnGreen(), c.getGoldText()} : new int[]{c.getGold(), c.getGold(), c.getGoldText(), c.getGreen(), c.getGreenText()};
        } else {
            iArr = new int[]{c.getGold(), c.getGold(), c.getGoldSoft(), c.getGreen(), c.getGreenText(), c.getOnGreen(), c.getSurfaceAlt()};
        }
        return iArr[this.random.nextInt(iArr.length)];
    }

    static void addPiece$default(ConfettiView confettiView, float f, float f2, float f3, float f4, long j, long j2, boolean z, int i, Object obj) {
        confettiView.addPiece(f, f2, f3, f4, j, j2, (i & 64) != 0 ? false : z);
    }

    private final void addPiece(float f, float f2, float f3, float f4, long j, long j2, boolean z) {
        Pair pair;
        int i = 0;
        int pick$default = pick$default(this, false, 1, null);
        int nextInt = this.random.nextInt(10);
        if (nextInt == 0 || nextInt == 1) {
            i = 1;
        } else if (nextInt == 2 || nextInt == 3) {
            i = 2;
        } else if (nextInt == 4) {
            i = 3;
        }
        float f5 = z ? 0.8f : 1.0f;
        if (i == 2) {
            ConfettiView confettiView = this;
            pair = TuplesKt.to(Float.valueOf(ThemeKt.dpf(confettiView, Float.valueOf(3.2f))), Float.valueOf(ThemeKt.dpf(confettiView, Float.valueOf(14 + (this.random.nextFloat() * 8)))));
        } else if (i == 3) {
            pair = TuplesKt.to(Float.valueOf(ThemeKt.dpf(this, Float.valueOf(6 + (this.random.nextFloat() * 3)))), Float.valueOf(0.0f));
        } else {
            ConfettiView confettiView2 = this;
            float f6 = 6;
            pair = TuplesKt.to(Float.valueOf(ThemeKt.dpf(confettiView2, Float.valueOf(f6 + (this.random.nextFloat() * f6)))), Float.valueOf(ThemeKt.dpf(confettiView2, Float.valueOf(9 + (this.random.nextFloat() * 8)))));
        }
        this.pieces.add(new Piece(f, f2, f3, f4, this.random.nextFloat() * 360.0f, (this.random.nextFloat() - 0.5f) * 720.0f, this.random.nextFloat() * 6.28f, (this.random.nextFloat() * 8.0f) + 4.0f, ((Number) pair.component1()).floatValue() * f5, f5 * ((Number) pair.component2()).floatValue(), i == 3 ? Ui.INSTANCE.getC().getGold() : pick$default, FxKt.lerpColor(pick$default, -16777216, 0.28f), i, this.random.nextFloat() * 6.28f, j, j2));
    }

    private final void explode(Shell shell, long j) {
        float nextFloat;
        float f;
        shell.setExploded(true);
        Colors c = Ui.INSTANCE.getC();
        int[] iArr = c.getDark() ? new int[]{c.getGold(), c.getGoldSoft(), c.getOnGreen(), c.getGold(), c.getGreenText()} : new int[]{c.getGold(), c.getGoldText(), c.getGreen(), c.getGold(), c.getGreenText()};
        int count = shell.getCount();
        for (int i = 0; i < count; i++) {
            float count2 = ((i / (float) shell.getCount()) * 6.283f) + (this.random.nextFloat() * 0.12f);
            ConfettiView confettiView = this;
            if (shell.getRing()) {
                nextFloat = this.random.nextFloat() * 40.0f;
                f = 330.0f;
            } else {
                nextFloat = this.random.nextFloat() * 260.0f;
                f = 120.0f;
            }
            float dpf = ThemeKt.dpf(confettiView, Float.valueOf(nextFloat + f));
            double d = count2;
            this.sparks.add(new Spark(shell.getX1(), shell.getY1(), ((float) Math.cos(d)) * dpf, ((float) Math.sin(d)) * dpf, shell.getX1(), shell.getY1(), iArr[this.random.nextInt(iArr.length)], ThemeKt.dpf(confettiView, Float.valueOf((this.random.nextFloat() * 1.4f) + 1.6f)), j, this.random.nextLong(0L, 550L) + 950, 1.9f, this.random.nextFloat() * 6.28f));
        }
        if (shell.getRing()) {
            for (int i2 = 0; i2 < 10; i2++) {
                ConfettiView confettiView2 = this;
                addPiece$default(this, shell.getX1(), shell.getY1(), ThemeKt.dpf(confettiView2, Float.valueOf((this.random.nextFloat() - 0.5f) * 300)), ThemeKt.dpf(confettiView2, Float.valueOf((-this.random.nextFloat()) * 260)), j, 2600L, false, 64, null);
            }
        }
        this.flashes.add(new Flash(shell.getX1(), shell.getY1(), j, ThemeKt.dpf(this, Integer.valueOf(shell.getRing() ? 150 : 110))));
    }

    @Override
    protected void onDraw(Canvas canvas) {
        String str;
        float f;
        Iterator<Spark> it;
        float f2;
        Intrinsics.checkNotNullParameter(canvas, "canvas");
        long uptimeMillis = SystemClock.uptimeMillis();
        if (uptimeMillis >= this.until) {
            if (this.pieces.isEmpty() && this.sparks.isEmpty() && this.shells.isEmpty()) {
                return;
            }
            clear();
            return;
        }
        float coerceIn = ((float) RangesKt.coerceIn(uptimeMillis - this.last, 0L, 50L)) / 1000.0f;
        this.last = uptimeMillis;
        long j = this.fadeFrom;
        float window = 1.0f - FxKt.window((float) (uptimeMillis - j), 0.0f, (float) (this.until - j));
        ConfettiView confettiView = this;
        float dpf = ThemeKt.dpf(confettiView, (Number) 1150);
        Iterator<Flash> it2 = this.flashes.iterator();
        String str2 = "iterator(...)";
        Intrinsics.checkNotNullExpressionValue(it2, "iterator(...)");
        while (true) {
            str = "next(...)";
            if (!it2.hasNext()) {
                break;
            }
            Flash next = it2.next();
            Intrinsics.checkNotNullExpressionValue(next, "next(...)");
            Flash flash = next;
            float born = ((float) (uptimeMillis - flash.getBorn())) / 380.0f;
            if (born >= 1.0f) {
                it2.remove();
            } else {
                this.glow.setShader(new RadialGradient(flash.getX(), flash.getY(), flash.getRadius() * ((Ease.INSTANCE.cubicOut(born) * 0.4f) + 0.6f), Ui.INSTANCE.withAlpha(Ui.INSTANCE.getC().getGoldSoft(), (1.0f - born) * 0.5f * window), 0, Shader.TileMode.CLAMP));
                canvas.drawCircle(flash.getX(), flash.getY(), flash.getRadius(), this.glow);
            }
        }
        Iterator<Shell> it3 = this.shells.iterator();
        Intrinsics.checkNotNullExpressionValue(it3, "iterator(...)");
        while (it3.hasNext()) {
            Shell next2 = it3.next();
            Intrinsics.checkNotNullExpressionValue(next2, str);
            Shell shell = next2;
            if (!shell.getExploded() && uptimeMillis >= shell.getLaunch()) {
                if (uptimeMillis >= shell.getExplodeAt()) {
                    explode(shell, uptimeMillis);
                } else {
                    float cubicOut = Ease.INSTANCE.cubicOut(((float) (uptimeMillis - shell.getLaunch())) / ((float) (shell.getExplodeAt() - shell.getLaunch())));
                    float x0 = shell.getX0() + ((shell.getX1() - shell.getX0()) * cubicOut);
                    float y0 = shell.getY0() + ((shell.getY1() - shell.getY0()) * cubicOut);
                    float dpf2 = ThemeKt.dpf(confettiView, (Number) 46) * (1.0f - (cubicOut * 0.7f));
                    this.line.setStrokeWidth(ThemeKt.dpf(confettiView, Float.valueOf(2.4f)));
                    this.line.setColor(Ui.INSTANCE.withAlpha(Ui.INSTANCE.getC().getGold(), window * 0.45f));
                    canvas.drawLine(x0, y0, x0 - ((shell.getX1() - shell.getX0()) * 0.04f), y0 + dpf2, this.line);
                    this.paint.setColor(Ui.INSTANCE.withAlpha(Ui.INSTANCE.getC().getGoldSoft(), window));
                    canvas.drawCircle(x0, y0, ThemeKt.dpf(confettiView, Float.valueOf(2.6f)), this.paint);
                    str = str;
                    str2 = str2;
                    it3 = it3;
                    coerceIn = coerceIn;
                }
            }
        }
        String str3 = str;
        float f3 = coerceIn;
        String str4 = str2;
        CollectionsKt.removeAll((List) this.shells, (Function1) new ConfettiView$$ExternalSyntheticLambda0());
        Iterator<Spark> it4 = this.sparks.iterator();
        Intrinsics.checkNotNullExpressionValue(it4, str4);
        while (it4.hasNext()) {
            Spark next3 = it4.next();
            Intrinsics.checkNotNullExpressionValue(next3, str3);
            Spark spark = next3;
            if (uptimeMillis >= spark.getBorn()) {
                float born2 = ((float) (uptimeMillis - spark.getBorn())) / ((float) spark.getLife());
                if (born2 >= 1.0f) {
                    it4.remove();
                } else {
                    spark.setPx(spark.getX());
                    spark.setPy(spark.getY());
                    float exp = (float) Math.exp((-spark.getDrag()) * f3);
                    spark.setVx(spark.getVx() * exp);
                    spark.setVy((spark.getVy() * exp) + ((spark.getDrag() > 0.0f ? 0.34f * dpf : 0.0f) * f3));
                    spark.setX(spark.getX() + (spark.getVx() * f3));
                    spark.setY(spark.getY() + (spark.getVy() * f3));
                    if (spark.getDrag() == 0.0f) {
                        spark.setX(spark.getX() + (((float) Math.sin((9.0f * born2) + spark.getTwinkle())) * ThemeKt.dpf(confettiView, Float.valueOf(0.6f))));
                    }
                    float cubicIn = (1.0f - Ease.INSTANCE.cubicIn(born2)) * (born2 > 0.55f ? (((float) Math.sin(spark.getTwinkle() + (40.0f * born2))) * 0.45f) + 0.55f : 1.0f) * window;
                    if (cubicIn > 0.02f) {
                        if (spark.getDrag() > 0.0f) {
                            this.line.setStrokeWidth(spark.getSize());
                            this.line.setColor(Ui.INSTANCE.withAlpha(spark.getColor(), 0.55f * cubicIn));
                            it = it4;
                            f2 = cubicIn;
                            f = born2;
                            canvas.drawLine(spark.getPx() - ((spark.getX() - spark.getPx()) * 2.5f), spark.getPy() - ((spark.getY() - spark.getPy()) * 2.5f), spark.getX(), spark.getY(), this.line);
                        } else {
                            f = born2;
                            it = it4;
                            f2 = cubicIn;
                        }
                        this.paint.setColor(Ui.INSTANCE.withAlpha(spark.getColor(), f2));
                        canvas.drawCircle(spark.getX(), spark.getY(), spark.getSize() * (1.0f - (f * 0.35f)), this.paint);
                        it4 = it;
                    }
                }
            }
        }
        float exp2 = (float) Math.exp((-1.25f) * f3);
        Iterator<Piece> it5 = this.pieces.iterator();
        Intrinsics.checkNotNullExpressionValue(it5, str4);
        while (it5.hasNext()) {
            Piece next4 = it5.next();
            Intrinsics.checkNotNullExpressionValue(next4, str3);
            Piece piece = next4;
            if (uptimeMillis >= piece.getBorn()) {
                long born3 = uptimeMillis - piece.getBorn();
                if (born3 >= piece.getLife() || piece.getY() > getHeight() + ThemeKt.dpf(confettiView, (Number) 40)) {
                    it5.remove();
                } else {
                    piece.setVy(piece.getVy() + (dpf * f3));
                    piece.setVx(piece.getVx() * exp2);
                    piece.setVy(piece.getVy() * exp2);
                    float sin = piece.getVy() > 0.0f ? ((float) Math.sin(((((float) born3) / 1000.0f) * 5.0f) + piece.getWobble())) * ThemeKt.dpf(confettiView, (Number) 38) : 0.0f;
                    piece.setVy(RangesKt.coerceAtMost(piece.getVy(), ThemeKt.dpf(confettiView, Integer.valueOf(piece.getShape() == 2 ? 260 : 330))));
                    piece.setX(piece.getX() + ((piece.getVx() + sin) * f3));
                    piece.setY(piece.getY() + (piece.getVy() * f3));
                    piece.setRotation(piece.getRotation() + (piece.getSpin() * f3));
                    piece.setFlip(piece.getFlip() + (piece.getFlipSpeed() * f3));
                    float window2 = 1.0f - FxKt.window((float) born3, ((float) piece.getLife()) - 700.0f, 700.0f);
                    float cos = (float) Math.cos(piece.getFlip());
                    this.paint.setColor((cos >= 0.0f || piece.getShape() == 3) ? piece.getColor() : piece.getBack());
                    this.paint.setAlpha((int) (((float) KotlinVersion.MAX_COMPONENT_VALUE) * window * window2));
                    canvas.save();
                    canvas.translate(piece.getX(), piece.getY());
                    canvas.rotate(piece.getRotation());
                    int shape = piece.getShape();
                    if (shape == 1) {
                        canvas.scale(1.0f, Math.max(Math.abs(cos), 0.08f));
                        float f4 = 2;
                        this.rect.set((-piece.getW()) / f4, (-piece.getW()) / f4, piece.getW() / f4, piece.getW() / f4);
                        canvas.drawOval(this.rect, this.paint);
                    } else if (shape == 3) {
                        float w = piece.getW() * ((Math.abs(cos) * 0.25f) + 0.75f);
                        canvas.scale(w, w);
                        canvas.drawPath(this.star, this.paint);
                    } else {
                        canvas.scale(Math.max(Math.abs(cos), 0.08f), 1.0f);
                        float f5 = 2;
                        this.rect.set((-piece.getW()) / f5, (-piece.getH()) / f5, piece.getW() / f5, piece.getH() / f5);
                        float w2 = piece.getShape() == 2 ? piece.getW() / f5 : ThemeKt.dpf(confettiView, Float.valueOf(1.5f));
                        canvas.drawRoundRect(this.rect, w2, w2, this.paint);
                    }
                    canvas.restore();
                }
            }
        }
        this.paint.setAlpha(KotlinVersion.MAX_COMPONENT_VALUE);
        postInvalidateOnAnimation();
    }

    private static final boolean onDraw$lambda$7(Shell it) {
        Intrinsics.checkNotNullParameter(it, "it");
        return it.getExploded();
    }

    public static final class Companion {
        public Companion(DefaultConstructorMarker defaultConstructorMarker) {
            this();
        }

        private Companion() {
        }
    }
}

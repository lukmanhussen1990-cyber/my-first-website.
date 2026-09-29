package com.imran.examcountdown.ui.widgets;

import android.animation.ValueAnimator;
import android.content.Context;
import android.graphics.Canvas;
import android.graphics.LinearGradient;
import android.graphics.Matrix;
import android.graphics.Paint;
import android.graphics.Path;
import android.graphics.RadialGradient;
import android.graphics.RectF;
import android.graphics.Shader;
import android.graphics.Typeface;
import android.view.View;
import android.view.ViewGroup;
import android.view.ViewParent;
import android.view.animation.LinearInterpolator;
import android.widget.FrameLayout;
import android.widget.ImageView;
import com.imran.examcountdown.R;
import com.imran.examcountdown.ui.Colors;
import com.imran.examcountdown.ui.Ease;
import com.imran.examcountdown.ui.Fonts;
import com.imran.examcountdown.ui.FxKt;
import com.imran.examcountdown.ui.ThemeKt;
import com.imran.examcountdown.ui.Ui;
import kotlin.KotlinVersion;
import kotlin.Metadata;
import kotlin.Unit;
import kotlin.jvm.functions.Function0;
import kotlin.jvm.internal.DefaultConstructorMarker;
import kotlin.jvm.internal.Intrinsics;
import kotlin.ranges.RangesKt;

public final class IntroView extends FrameLayout {
    private static final float ARC_MS = 740.0f;
    private static final float ARC_START = 80.0f;
    private static final float BACKDROP_GONE = 260.0f;
    private static final long COVER_MS = 180;
    public static final Companion Companion = new Companion(null);
    private static final float DEG = 0.017453292f;
    public static final float EXIT = 1600.0f;
    private static final float FLIGHT_MS = 620.0f;
    private static final float REVEAL_DELAY = 100.0f;
    private static final float SKIP_SPEED = 0.75f;
    private static final float STILL_FADE = 300.0f;
    private static final float STILL_MS = 1200.0f;
    public static final float TOTAL = 2300.0f;
    private ValueAnimator animator;
    private final Paint backdrop;
    private boolean backdropGone;
    private final Path clip;
    private final Colors colors;
    private boolean covering;
    private final int cream;
    private float cx;
    private float cy;
    private final Paint depth;
    private final ImageView emblem;
    private int emblemSize;
    private float[] exitFrom;
    private float[] exitTo;
    private boolean exiting;
    private boolean finished;
    private final Paint head;
    private final Paint headGlow;
    private final Paint letter;
    private Function0<Unit> onBackdropGone;
    private Function0<Unit> onCovered;
    private Function0<Unit> onFinished;
    private Function0<Unit> onReveal;
    private final RectF oval;
    private final Word place;
    private float placeTop;
    private float r;
    private boolean revealed;
    private final Paint ring;
    private final Paint shine;
    private final Matrix shineMatrix;
    private LinearGradient shineShader;
    private boolean still;
    private float t;
    private Function0<? extends View> target;
    private final float textScale;
    private final Word title;
    private float titleTop;

    public static Unit m92$r8$lambda$0OChG0d30fWVcYNPhJ5vmGSpnY(IntroView introView) {
        return play$lambda$5(introView);
    }

    public static void m93$r8$lambda$A4grDJCpc6Bv2wbgY33WUKHac(IntroView introView, ValueAnimator valueAnimator) {
        run$lambda$11$lambda$10(introView, valueAnimator);
    }

    public static Unit m94$r8$lambda$TvP4YErNY4Or9DCoNdsitshrQ(IntroView introView) {
        return playStill$lambda$6(introView);
    }

    public static void m95$r8$lambda$ZCHwHjWdy3XFreBSslpZAd2Fmc(IntroView introView) {
        onSizeChanged$lambda$4(introView);
    }

    public static void $r8$lambda$atNOfI4bcgSF7IAJbSY43vA9hzE(IntroView introView, View view) {
        _init_$lambda$2(introView, view);
    }

    public static void $r8$lambda$vM_Kl_SrIIpHYe4bog21IdzFt3Y(IntroView introView, Function0 function0) {
        whenCovered$lambda$7(introView, function0);
    }

    public static void m96$r8$lambda$xYI_AkHuFzQGJM1KnYgkHzt4Mw(IntroView introView, ValueAnimator valueAnimator) {
        hold$lambda$9$lambda$8(introView, valueAnimator);
    }

    public IntroView(Context context) {
        super(context);
        Intrinsics.checkNotNullParameter(context, "context");
        ImageView imageView = new ImageView(context);
        imageView.setImageResource(R.drawable.emblem);
        imageView.setScaleType(ImageView.ScaleType.FIT_CENTER);
        imageView.setImportantForAccessibility(2);
        this.emblem = imageView;
        Colors c = Ui.INSTANCE.getC();
        this.colors = c;
        this.exitFrom = new float[]{1.0f, 1.0f};
        this.backdrop = new Paint();
        this.depth = new Paint(1);
        Paint paint = new Paint(1);
        paint.setStyle(Paint.Style.STROKE);
        paint.setStrokeCap(Paint.Cap.BUTT);
        this.ring = paint;
        this.head = new Paint(1);
        this.headGlow = new Paint(1);
        this.shine = new Paint(1);
        this.shineMatrix = new Matrix();
        this.clip = new Path();
        this.oval = new RectF();
        float coerceIn = RangesKt.coerceIn(context.getResources().getConfiguration().fontScale, 1.0f, 1.3f);
        this.textScale = coerceIn;
        int onGreen = Ui.INSTANCE.getLIGHT().getOnGreen();
        this.cream = onGreen;
        Word word = new Word("Al-Ameen Academy", Fonts.INSTANCE.getSerif(), ThemeKt.dpf(context, (Number) 23) * coerceIn, onGreen, 0.1f, 0.01f, 780.0f, 16.0f);
        this.title = word;
        Word word2 = new Word("BADARPUR · ESTD. 1994", Fonts.INSTANCE.getSansSemibold(), ThemeKt.dpf(context, Float.valueOf(11.5f)) * coerceIn, c.getGold(), 0.42f, 0.24f, 900.0f, 10.0f);
        this.place = word2;
        Paint paint2 = new Paint(1);
        this.letter = paint2;
        setWillNotDraw(false);
        setClickable(true);
        setContentDescription("Al-Ameen Academy, Badarpur");
        addView(imageView, ThemeKt.flp$default(0, 0, 0, 7, null));
        imageView.setAlpha(0.0f);
        setOnClickListener(new IntroView$$ExternalSyntheticLambda2(this));
        word.measure(paint2);
        word2.measure(paint2);
    }

    public final Function0<? extends View> getTarget() {
        return this.target;
    }

    public final void setTarget(Function0<? extends View> function0) {
        this.target = function0;
    }

    public final Function0<Unit> getOnCovered() {
        return this.onCovered;
    }

    public final void setOnCovered(Function0<Unit> function0) {
        this.onCovered = function0;
    }

    public final Function0<Unit> getOnReveal() {
        return this.onReveal;
    }

    public final void setOnReveal(Function0<Unit> function0) {
        this.onReveal = function0;
    }

    public final Function0<Unit> getOnBackdropGone() {
        return this.onBackdropGone;
    }

    public final void setOnBackdropGone(Function0<Unit> function0) {
        this.onBackdropGone = function0;
    }

    public final Function0<Unit> getOnFinished() {
        return this.onFinished;
    }

    public final void setOnFinished(Function0<Unit> function0) {
        this.onFinished = function0;
    }

    private static final void _init_$lambda$2(IntroView introView, View view) {
        introView.skip();
    }

    @Override
    protected void onSizeChanged(int i, int i2, int i3, int i4) {
        IntroView introView = this;
        int min = Math.min((int) (Math.min(i, i2) * (i > i2 ? 0.4f : 0.46f)), ThemeKt.dp(introView, (Number) 212));
        this.emblemSize = min;
        int coerceAtLeast = RangesKt.coerceAtLeast((int) ((i2 * 0.46f) - ((((min + ThemeKt.dpf(introView, (Number) 30)) + (ThemeKt.dpf(introView, (Number) 34) * this.textScale)) + (ThemeKt.dpf(introView, (Number) 16) * this.textScale)) / 2.0f)), ThemeKt.dp(introView, (Number) 24));
        ImageView imageView = this.emblem;
        int i5 = this.emblemSize;
        FrameLayout.LayoutParams flp = ThemeKt.flp(i5, i5, 1);
        flp.topMargin = coerceAtLeast;
        imageView.setLayoutParams(flp);
        this.cx = i / 2.0f;
        int i6 = this.emblemSize;
        this.cy = coerceAtLeast + (i6 / 2.0f);
        this.r = i6 / 2.0f;
        float dpf = coerceAtLeast + i6 + ThemeKt.dpf(introView, (Number) 30);
        this.titleTop = dpf;
        this.placeTop = dpf + (ThemeKt.dpf(introView, (Number) 34) * this.textScale);
        this.depth.setShader(new RadialGradient(this.cx, this.cy, Math.max(i, i2) * 0.6f, Ui.INSTANCE.withAlpha(-1, 0.075f), Ui.INSTANCE.withAlpha(-1, 0.0f), Shader.TileMode.CLAMP));
        this.headGlow.setShader(new RadialGradient(0.0f, 0.0f, ThemeKt.dpf(introView, (Number) 7), Ui.INSTANCE.withAlpha(this.colors.getGold(), 0.35f), Ui.INSTANCE.withAlpha(this.colors.getGold(), 0.0f), Shader.TileMode.CLAMP));
        float f = this.emblemSize * 0.22f;
        LinearGradient linearGradient = new LinearGradient(-f, 0.0f, f, 0.0f, new int[]{16777215, 1308622847, 16777215}, new float[]{0.0f, 0.5f, 1.0f}, Shader.TileMode.CLAMP);
        this.shineShader = linearGradient;
        this.shine.setShader(linearGradient);
        post(new IntroView$$ExternalSyntheticLambda3(this));
    }

    private static final void onSizeChanged$lambda$4(IntroView introView) {
        introView.requestLayout();
    }

    public static void play$default(IntroView introView, boolean z, int i, Object obj) {
        if ((i & 1) != 0) {
            z = false;
        }
        introView.play(z);
    }

    public final void play(boolean z) {
        if (this.animator != null || this.covering) {
            return;
        }
        whenCovered(z, new IntroView$$ExternalSyntheticLambda4(this));
    }

    private static final Unit play$lambda$5(IntroView introView) {
        View invoke;
        Function0<? extends View> function0 = introView.target;
        if (function0 != null && (invoke = function0.invoke()) != null) {
            invoke.setVisibility(4);
        }
        introView.run(0.0f, 1.0f);
        return Unit.INSTANCE;
    }

    public static void playStill$default(IntroView introView, boolean z, int i, Object obj) {
        if ((i & 1) != 0) {
            z = false;
        }
        introView.playStill(z);
    }

    public final void playStill(boolean z) {
        if (this.animator != null || this.covering) {
            return;
        }
        this.still = true;
        this.t = 1599.0f;
        this.emblem.setAlpha(1.0f);
        invalidate();
        whenCovered(z, new IntroView$$ExternalSyntheticLambda5(this));
    }

    private static final Unit playStill$lambda$6(IntroView introView) {
        introView.hold();
        return Unit.INSTANCE;
    }

    private final void whenCovered(boolean z, Function0<Unit> function0) {
        if (!z) {
            Function0<Unit> function02 = this.onCovered;
            if (function02 != null) {
                function02.invoke();
            }
            function0.invoke();
            return;
        }
        this.covering = true;
        setAlpha(0.0f);
        animate().alpha(1.0f).setDuration(COVER_MS).setInterpolator(Ease.INSTANCE.getOut()).withEndAction(new IntroView$$ExternalSyntheticLambda0(this, function0)).start();
    }

    private static final void whenCovered$lambda$7(IntroView introView, Function0 function0) {
        introView.covering = false;
        Function0<Unit> function02 = introView.onCovered;
        if (function02 != null) {
            function02.invoke();
        }
        function0.invoke();
    }

    private final void hold() {
        View invoke;
        Function0<? extends View> function0 = this.target;
        if (function0 != null && (invoke = function0.invoke()) != null) {
            invoke.setVisibility(0);
        }
        ValueAnimator ofFloat = ValueAnimator.ofFloat(0.0f, STILL_MS);
        ofFloat.setDuration(1200L);
        ofFloat.setInterpolator(new LinearInterpolator());
        ofFloat.addUpdateListener(new IntroView$$ExternalSyntheticLambda6(this));
        ofFloat.start();
        this.animator = ofFloat;
    }

    private static final void hold$lambda$9$lambda$8(IntroView introView, ValueAnimator it) {
        Intrinsics.checkNotNullParameter(it, "it");
        Object animatedValue = it.getAnimatedValue();
        Intrinsics.checkNotNull(animatedValue, "null cannot be cast to non-null type kotlin.Float");
        float floatValue = ((Float) animatedValue).floatValue();
        if (floatValue >= 900.0f) {
            if (!introView.revealed) {
                introView.revealed = true;
                Function0<Unit> function0 = introView.onReveal;
                if (function0 != null) {
                    function0.invoke();
                }
                introView.passTouches();
            }
            introView.setAlpha(1.0f - FxKt.window(floatValue, 900.0f, STILL_FADE));
            if (introView.getAlpha() < 0.5f) {
                introView.backdropGoneOnce();
            }
        }
        if (floatValue >= STILL_MS) {
            introView.finish();
        }
    }

    public final void skip() {
        ValueAnimator valueAnimator = this.animator;
        if (valueAnimator == null || this.still || this.t >= 1600.0f) {
            return;
        }
        valueAnimator.removeAllUpdateListeners();
        valueAnimator.cancel();
        run(1600.0f, SKIP_SPEED);
    }

    private final void run(float f, float f2) {
        ValueAnimator ofFloat = ValueAnimator.ofFloat(f, 2300.0f);
        ofFloat.setDuration((long) ((2300.0f - f) * f2));
        ofFloat.setInterpolator(new LinearInterpolator());
        ofFloat.addUpdateListener(new IntroView$$ExternalSyntheticLambda1(this));
        ofFloat.start();
        this.animator = ofFloat;
    }

    private static final void run$lambda$11$lambda$10(IntroView introView, ValueAnimator it) {
        Intrinsics.checkNotNullParameter(it, "it");
        Object animatedValue = it.getAnimatedValue();
        Intrinsics.checkNotNull(animatedValue, "null cannot be cast to non-null type kotlin.Float");
        introView.apply(((Float) animatedValue).floatValue());
    }

    private final void apply(float f) {
        this.t = f;
        if (f >= 1600.0f) {
            if (!this.exiting) {
                beginExit();
            }
            float interpolation = Ease.INSTANCE.getInOut().getInterpolation(FxKt.window(this.t, 1600.0f, FLIGHT_MS));
            float[] fArr = this.exitTo;
            this.emblem.setAlpha(fArr == null ? this.exitFrom[0] * (1.0f - interpolation) : FxKt.lerp(this.exitFrom[0], 1.0f, FxKt.window(this.t, 1600.0f, 150.0f)));
            float lerp = FxKt.lerp(this.exitFrom[1], fArr != null ? fArr[2] : 0.9f, interpolation);
            this.emblem.setScaleX(lerp);
            this.emblem.setScaleY(lerp);
            this.emblem.setTranslationX((fArr != null ? fArr[0] : 0.0f) * interpolation);
            this.emblem.setTranslationY((fArr != null ? fArr[1] : -ThemeKt.dpf(this, (Number) 20)) * interpolation);
            if (!this.revealed && this.t >= 1700.0f) {
                this.revealed = true;
                Function0<Unit> function0 = this.onReveal;
                if (function0 != null) {
                    function0.invoke();
                }
            }
            if (this.t >= 1860.0f) {
                backdropGoneOnce();
            }
        } else {
            this.emblem.setAlpha(Ease.INSTANCE.cubicOut(FxKt.window(this.t, 220.0f, 480.0f)));
            float spring = (FxKt.spring(FxKt.window(this.t, 220.0f, 780.0f), 0.82f) * 0.08f) + 0.92f;
            this.emblem.setScaleX(spring);
            this.emblem.setScaleY(spring);
        }
        invalidate();
        if (this.t >= 2300.0f) {
            finish();
        }
    }

    private final void beginExit() {
        this.exiting = true;
        this.exitFrom = new float[]{this.emblem.getAlpha(), this.emblem.getScaleX()};
        this.exitTo = exitTransform();
        passTouches();
    }

    private final void passTouches() {
        setOnClickListener(null);
        setClickable(false);
    }

    private final void backdropGoneOnce() {
        if (this.backdropGone) {
            return;
        }
        this.backdropGone = true;
        Function0<Unit> function0 = this.onBackdropGone;
        if (function0 != null) {
            function0.invoke();
        }
    }

    @Override
    protected void onDraw(Canvas canvas) {
        Intrinsics.checkNotNullParameter(canvas, "canvas");
        if (getWidth() == 0) {
            return;
        }
        float width = getWidth();
        float height = getHeight();
        float cubicInOut = this.still ? 0.0f : Ease.INSTANCE.cubicInOut(FxKt.window(this.t, 1600.0f, 400.0f));
        float cubicOut = this.still ? 0.0f : Ease.INSTANCE.cubicOut(FxKt.window(this.t, 1820.0f, STILL_FADE));
        if (cubicOut < 1.0f) {
            this.backdrop.setColor(FxKt.lerpColor(Ui.INSTANCE.getFOREST(), this.colors.getBg(), cubicInOut));
            Paint paint = this.backdrop;
            float f = (float) KotlinVersion.MAX_COMPONENT_VALUE;
            paint.setAlpha((int) ((1.0f - cubicOut) * f));
            canvas.drawRect(0.0f, 0.0f, width, height, this.backdrop);
            this.depth.setAlpha((int) (f * Ease.INSTANCE.cubicOut(FxKt.window(this.t, 0.0f, 500.0f)) * (1.0f - cubicInOut)));
            if (this.depth.getAlpha() > 0) {
                canvas.drawRect(0.0f, 0.0f, width, height, this.depth);
            }
        }
        drawBorder(canvas);
    }

    private final void drawBorder(Canvas canvas) {
        float window = this.still ? 1.0f : 1.0f - FxKt.window(this.t, 1600.0f, STILL_FADE);
        float f = 0.0f;
        if (window <= 0.0f) {
            return;
        }
        float scaleX = this.emblem.getScaleX();
        float translationX = this.cx + this.emblem.getTranslationX();
        float translationY = this.cy + this.emblem.getTranslationY();
        IntroView introView = this;
        int i = 7;
        float dpf = (this.r + ThemeKt.dpf(introView, (Number) 7)) * scaleX;
        float cubicInOut = Ease.INSTANCE.cubicInOut(FxKt.window(this.t, ARC_START, ARC_MS)) * 180.0f;
        this.ring.setStrokeWidth(ThemeKt.dpf(introView, Float.valueOf(1.6f)) * RangesKt.coerceAtLeast(scaleX, 0.5f));
        this.ring.setColor(Ui.INSTANCE.withAlpha(this.colors.getGold(), window));
        if (cubicInOut >= 180.0f) {
            canvas.drawCircle(translationX, translationY, dpf, this.ring);
        } else if (cubicInOut <= 0.0f) {
        } else {
            this.oval.set(translationX - dpf, translationY - dpf, translationX + dpf, translationY + dpf);
            canvas.drawArc(this.oval, 90.0f, cubicInOut, false, this.ring);
            canvas.drawArc(this.oval, 90.0f, -cubicInOut, false, this.ring);
            float window2 = 1.0f - FxKt.window(this.t, 730.0f, 90.0f);
            if (window2 <= 0.0f) {
                return;
            }
            int i2 = 2;
            int i3 = 0;
            float[] fArr = {cubicInOut + 90.0f, 90.0f - cubicInOut};
            while (i3 < i2) {
                double d = fArr[i3] * DEG;
                float cos = (((float) Math.cos(d)) * dpf) + translationX;
                float sin = (((float) Math.sin(d)) * dpf) + translationY;
                canvas.save();
                canvas.translate(cos, sin);
                this.headGlow.setAlpha((int) (((float) KotlinVersion.MAX_COMPONENT_VALUE) * window2));
                canvas.drawCircle(f, f, ThemeKt.dpf(introView, Integer.valueOf(i)), this.headGlow);
                canvas.restore();
                this.head.setColor(Ui.INSTANCE.withAlpha(FxKt.lerpColor(this.colors.getGold(), -1, 0.55f), window2));
                canvas.drawCircle(cos, sin, ThemeKt.dpf(introView, Float.valueOf(2.0f)), this.head);
                i3++;
                i2 = 2;
                f = 0.0f;
                i = 7;
            }
        }
    }

    @Override
    protected void dispatchDraw(Canvas canvas) {
        Intrinsics.checkNotNullParameter(canvas, "canvas");
        super.dispatchDraw(canvas);
        if (getWidth() == 0) {
            return;
        }
        float window = FxKt.window(this.t, 980.0f, 520.0f);
        if (!this.still && window > 0.0f && window < 1.0f && this.t < 1600.0f) {
            float scaleX = this.r * this.emblem.getScaleX();
            this.clip.reset();
            this.clip.addCircle(this.cx, this.cy, scaleX, Path.Direction.CW);
            canvas.save();
            canvas.clipPath(this.clip);
            float f = this.emblemSize * 0.22f;
            float f2 = 2;
            this.shineMatrix.setTranslate(((this.cx - scaleX) - f) + (((f2 * scaleX) + (f * f2)) * Ease.INSTANCE.cubicInOut(window)), 0.0f);
            this.shineMatrix.postRotate(-20.0f, this.cx, this.cy);
            LinearGradient linearGradient = this.shineShader;
            if (linearGradient != null) {
                linearGradient.setLocalMatrix(this.shineMatrix);
            }
            float f3 = this.cx;
            float f4 = this.cy;
            canvas.drawRect(f3 - scaleX, f4 - scaleX, f3 + scaleX, f4 + scaleX, this.shine);
            canvas.restore();
        }
        float cubicOut = this.still ? 1.0f : 1.0f - Ease.INSTANCE.cubicOut(FxKt.window(this.t, 1600.0f, 180.0f));
        if (cubicOut <= 0.0f) {
            return;
        }
        float dpf = ThemeKt.dpf(this, (Number) 4) * (1.0f - cubicOut);
        drawWord(canvas, this.title, this.titleTop + dpf, cubicOut);
        drawWord(canvas, this.place, this.placeTop + dpf, cubicOut);
    }

    private final void drawWord(Canvas canvas, Word word, float f, float f2) {
        float f3 = this.still ? 10000.0f : this.t;
        if (f3 < word.getStart()) {
            return;
        }
        float lerp = FxKt.lerp(word.getSpacingFrom(), word.getSpacingTo(), Ease.INSTANCE.quintOut(FxKt.window(f3, word.getStart(), 760.0f))) * word.getSize();
        this.letter.setTypeface(word.getFont());
        this.letter.setTextSize(word.getSize());
        int length = word.getText().length();
        float f4 = (length - 1) * lerp;
        for (int i = 0; i < length; i++) {
            f4 += word.getWidths()[i];
        }
        float f5 = this.cx - (f4 / 2.0f);
        float ascent = f - this.letter.ascent();
        for (int i2 = 0; i2 < length; i2++) {
            float cubicOut = Ease.INSTANCE.cubicOut(FxKt.window(f3, word.getStart() + (i2 * word.getStagger()), 400.0f));
            if (cubicOut > 0.0f) {
                this.letter.setColor(Ui.INSTANCE.withAlpha(word.getColor(), cubicOut * f2));
                canvas.drawText(word.getText(), i2, i2 + 1, f5, ascent + (ThemeKt.dpf(this, (Number) 6) * (1.0f - cubicOut)), this.letter);
            }
            f5 += word.getWidths()[i2] + lerp;
        }
    }

    private final float[] exitTransform() {
        Function0<? extends View> function0 = this.target;
        View invoke = function0 != null ? function0.invoke() : null;
        if (invoke == null || invoke.getWidth() == 0 || this.emblem.getWidth() == 0) {
            return null;
        }
        int[] iArr = new int[2];
        int[] iArr2 = new int[2];
        invoke.getLocationInWindow(iArr);
        getLocationInWindow(iArr2);
        return new float[]{(iArr[0] + (invoke.getWidth() / 2.0f)) - ((iArr2[0] + this.emblem.getLeft()) + (this.emblem.getWidth() / 2.0f)), (iArr[1] + (invoke.getHeight() / 2.0f)) - ((iArr2[1] + this.emblem.getTop()) + (this.emblem.getHeight() / 2.0f)), invoke.getWidth() / (float) this.emblem.getWidth()};
    }

    private final void finish() {
        View invoke;
        if (this.finished) {
            return;
        }
        this.finished = true;
        backdropGoneOnce();
        Function0<? extends View> function0 = this.target;
        if (function0 != null && (invoke = function0.invoke()) != null) {
            invoke.setVisibility(0);
        }
        ViewParent parent = getParent();
        ViewGroup viewGroup = parent instanceof ViewGroup ? (ViewGroup) parent : null;
        if (viewGroup != null) {
            viewGroup.removeView(this);
        }
        Function0<Unit> function02 = this.onFinished;
        if (function02 != null) {
            function02.invoke();
        }
    }

    @Override
    protected void onDetachedFromWindow() {
        View invoke;
        super.onDetachedFromWindow();
        if (this.finished) {
            return;
        }
        ValueAnimator valueAnimator = this.animator;
        if (valueAnimator != null) {
            valueAnimator.cancel();
        }
        this.finished = true;
        Function0<? extends View> function0 = this.target;
        if (function0 == null || (invoke = function0.invoke()) == null) {
            return;
        }
        invoke.setVisibility(0);
    }

    private static final class Word {
        private final int color;
        private final Typeface font;
        private final float size;
        private final float spacingFrom;
        private final float spacingTo;
        private final float stagger;
        private final float start;
        private final String text;
        private final float[] widths;

        public Word(String text, Typeface font, float f, int i, float f2, float f3, float f4, float f5) {
            Intrinsics.checkNotNullParameter(text, "text");
            Intrinsics.checkNotNullParameter(font, "font");
            this.text = text;
            this.font = font;
            this.size = f;
            this.color = i;
            this.spacingFrom = f2;
            this.spacingTo = f3;
            this.start = f4;
            this.stagger = f5;
            this.widths = new float[text.length()];
        }

        public final String getText() {
            return this.text;
        }

        public final Typeface getFont() {
            return this.font;
        }

        public final float getSize() {
            return this.size;
        }

        public final int getColor() {
            return this.color;
        }

        public final float getSpacingFrom() {
            return this.spacingFrom;
        }

        public final float getSpacingTo() {
            return this.spacingTo;
        }

        public final float getStart() {
            return this.start;
        }

        public final float getStagger() {
            return this.stagger;
        }

        public final float[] getWidths() {
            return this.widths;
        }

        public final void measure(Paint paint) {
            Intrinsics.checkNotNullParameter(paint, "paint");
            paint.setTypeface(this.font);
            paint.setTextSize(this.size);
            int length = this.text.length();
            int i = 0;
            while (i < length) {
                int i2 = i + 1;
                this.widths[i] = paint.measureText(this.text, i, i2);
                i = i2;
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

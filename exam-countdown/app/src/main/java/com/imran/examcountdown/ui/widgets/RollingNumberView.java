package com.imran.examcountdown.ui.widgets;

import android.content.Context;
import android.graphics.Canvas;
import android.graphics.Paint;
import android.graphics.Rect;
import android.graphics.Typeface;
import android.os.SystemClock;
import android.view.View;
import com.imran.examcountdown.ui.Ease;
import com.imran.examcountdown.ui.Fonts;
import com.imran.examcountdown.ui.FxKt;
import com.imran.examcountdown.ui.Ui;
import java.util.Iterator;
import java.util.NoSuchElementException;
import kotlin.Metadata;
import kotlin.collections.ArraysKt;
import kotlin.collections.IntIterator;
import kotlin.jvm.internal.DefaultConstructorMarker;
import kotlin.jvm.internal.Intrinsics;
import kotlin.ranges.IntRange;
import kotlin.ranges.RangesKt;
import kotlin.text.StringsKt;

public final class RollingNumberView extends View {
    private static final long CARRY_MS = 30;
    public static final Companion Companion = new Companion(null);
    private static final String DIGITS = "0123456789";
    public static final float SLIDE_MS = 280.0f;
    private boolean animateChanges;
    private final Rect bounds;
    private int color;
    private Boolean countsDown;
    private String current;
    private float digitHeight;
    private float digitWidth;
    private int minDigits;
    private final Paint paint;
    private Slide[] slides;
    private float verticalGapPx;

    /* JADX WARN: 'super' call moved to the top of the method (can break code semantics) */
    public RollingNumberView(Context context) {
        super(context);
        Intrinsics.checkNotNullParameter(context, "context");
        Paint paint = new Paint(1);
        paint.setColor(Ui.INSTANCE.getC().getText());
        paint.setTypeface(Fonts.INSTANCE.getSerif());
        paint.setTextAlign(Paint.Align.CENTER);
        paint.setFontFeatureSettings("tnum, lnum");
        this.paint = paint;
        this.bounds = new Rect();
        this.current = "00";
        this.slides = new Slide[0];
        this.minDigits = 2;
        this.verticalGapPx = -1.0f;
        this.animateChanges = true;
        this.color = Ui.INSTANCE.getC().getText();
        setImportantForAccessibility(2);
        measureDigits();
    }

    public final int getMinDigits() {
        return this.minDigits;
    }

    public final void setMinDigits(int i) {
        if (this.minDigits == i) {
            return;
        }
        this.minDigits = i;
        this.current = StringsKt.padStart(this.current, i, '0');
        requestLayout();
    }

    public final float getVerticalGapPx() {
        return this.verticalGapPx;
    }

    public final void setVerticalGapPx(float f) {
        this.verticalGapPx = f;
        requestLayout();
    }

    public final boolean getAnimateChanges() {
        return this.animateChanges;
    }

    public final void setAnimateChanges(boolean z) {
        this.animateChanges = z;
    }

    public final Boolean getCountsDown() {
        return this.countsDown;
    }

    public final void setCountsDown(Boolean bool) {
        this.countsDown = bool;
    }

    public final float getTextSizePx() {
        return this.paint.getTextSize();
    }

    public final void setTextSizePx(float f) {
        if (this.paint.getTextSize() == f) {
            return;
        }
        this.paint.setTextSize(f);
        measureDigits();
    }

    public final int getColor() {
        return this.color;
    }

    public final void setColor(int i) {
        this.color = i;
        invalidate();
    }

    public final Typeface getFont() {
        Typeface typeface = this.paint.getTypeface();
        Intrinsics.checkNotNullExpressionValue(typeface, "getTypeface(...)");
        return typeface;
    }

    public final void setFont(Typeface value) {
        Intrinsics.checkNotNullParameter(value, "value");
        this.paint.setTypeface(value);
        measureDigits();
    }

    public final String getValue() {
        return this.current;
    }

    public final boolean isAnimating() {
        Slide[] slideArr;
        long uptimeMillis = SystemClock.uptimeMillis();
        for (Slide slide : this.slides) {
            if (slide != null && !slide.done(uptimeMillis)) {
                return true;
            }
        }
        return false;
    }

    public static void setValue$default(RollingNumberView rollingNumberView, long j, boolean z, int i, Object obj) {
        if ((i & 2) != 0) {
            z = rollingNumberView.animateChanges;
        }
        rollingNumberView.setValue(j, z);
    }

    public final void setValue(long j, boolean z) {
        boolean z2;
        String padStart = StringsKt.padStart(String.valueOf(RangesKt.coerceAtLeast(j, 0L)), this.minDigits, '0');
        if (Intrinsics.areEqual(padStart, this.current)) {
            return;
        }
        String str = this.current;
        this.current = padStart;
        if (padStart.length() != str.length()) {
            requestLayout();
        }
        if (!z || !this.animateChanges || !isAttachedToWindow() || !isShown() || padStart.length() != str.length()) {
            this.slides = new Slide[padStart.length()];
            invalidate();
            return;
        }
        Boolean bool = this.countsDown;
        int i = 0;
        if (bool != null) {
            z2 = bool.booleanValue();
        } else {
            Long longOrNull = StringsKt.toLongOrNull(padStart);
            long longValue = longOrNull != null ? longOrNull.longValue() : 0L;
            Long longOrNull2 = StringsKt.toLongOrNull(str);
            z2 = longValue < (longOrNull2 != null ? longOrNull2.longValue() : 0L);
        }
        long uptimeMillis = SystemClock.uptimeMillis();
        Slide[] slideArr = new Slide[padStart.length()];
        int length = padStart.length() - 1;
        if (length >= 0) {
            while (true) {
                int i2 = length - 1;
                Slide slide = (Slide) ArraysKt.getOrNull(this.slides, length);
                if (slide == null || slide.done(uptimeMillis)) {
                    slide = null;
                }
                if (padStart.charAt(length) == str.charAt(length)) {
                    slideArr[length] = slide;
                } else {
                    slideArr[length] = new Slide(str.charAt(length), padStart.charAt(length), (i * CARRY_MS) + uptimeMillis, z2);
                    i++;
                }
                if (i2 < 0) {
                    break;
                }
                length = i2;
            }
        }
        this.slides = slideArr;
        postInvalidateOnAnimation();
    }

    private final void measureDigits() {
        Iterator<Integer> it = new IntRange(0, 9).iterator();
        if (!it.hasNext()) {
            throw new NoSuchElementException();
        }
        IntIterator intIterator = (IntIterator) it;
        float measureText = this.paint.measureText(String.valueOf(intIterator.nextInt()));
        while (it.hasNext()) {
            measureText = Math.max(measureText, this.paint.measureText(String.valueOf(intIterator.nextInt())));
        }
        this.digitWidth = measureText;
        this.paint.getTextBounds(DIGITS, 0, 10, this.bounds);
        this.digitHeight = this.bounds.height();
        requestLayout();
        invalidate();
    }

    private final float gap() {
        float f = this.verticalGapPx;
        return f >= 0.0f ? f : this.digitHeight * 0.16f;
    }

    @Override
    protected void onMeasure(int i, int i2) {
        setMeasuredDimension(View.resolveSize(((int) (this.digitWidth * this.current.length())) + getPaddingLeft() + getPaddingRight(), i), View.resolveSize(((int) (this.digitHeight + (2 * gap()))) + getPaddingTop() + getPaddingBottom(), i2));
    }

    @Override
    protected void onDetachedFromWindow() {
        this.slides = new Slide[this.current.length()];
        super.onDetachedFromWindow();
    }

    @Override
    protected void onDraw(Canvas canvas) {
        long j;
        int i;
        int i2;
        int i3;
        Intrinsics.checkNotNullParameter(canvas, "canvas");
        long uptimeMillis = SystemClock.uptimeMillis();
        float height = ((getHeight() - getPaddingBottom()) - gap()) - this.bounds.bottom;
        float gap = this.digitHeight + (gap() * 2.0f);
        int length = this.current.length();
        float paddingLeft = getPaddingLeft() + ((((getWidth() - getPaddingLeft()) - getPaddingRight()) - (this.digitWidth * length)) / 2.0f);
        if (this.slides.length != length) {
            this.slides = new Slide[length];
        }
        canvas.save();
        canvas.clipRect(0, 0, getWidth(), getHeight());
        int i4 = 0;
        boolean z = false;
        while (i4 < length) {
            float f = paddingLeft + (this.digitWidth * (i4 + 0.5f));
            Slide slide = this.slides[i4];
            if (slide == null || slide.done(uptimeMillis)) {
                j = uptimeMillis;
                i = length;
                this.slides[i4] = null;
                this.paint.setColor(this.color);
                canvas.drawText(this.current, i4, i4 + 1, f, height, this.paint);
            } else {
                float cubicOut = Ease.INSTANCE.cubicOut(FxKt.window((float) (uptimeMillis - slide.getStart()), 0.0f, 280.0f));
                float f2 = slide.getDown() ? 1.0f : -1.0f;
                j = uptimeMillis;
                i = length;
                this.paint.setColor(Ui.INSTANCE.withAlpha(this.color, ((i2 >>> 24) / 255.0f) * (1.0f - FxKt.window(cubicOut, 0.0f, 0.7f))));
                float f3 = f2 * gap;
                drawDigit(canvas, slide.getFrom(), f, (f3 * cubicOut) + height);
                this.paint.setColor(Ui.INSTANCE.withAlpha(this.color, ((i3 >>> 24) / 255.0f) * FxKt.window(cubicOut, 0.2f, 0.8f)));
                drawDigit(canvas, slide.getTo(), f, height - (f3 * (1.0f - cubicOut)));
                z = true;
            }
            i4++;
            uptimeMillis = j;
            length = i;
        }
        canvas.restore();
        this.paint.setColor(this.color);
        if (z) {
            postInvalidateOnAnimation();
        }
    }

    private final void drawDigit(Canvas canvas, char c, float f, float f2) {
        int i = c - '0';
        if (i < 0 || i >= 10) {
            return;
        }
        canvas.drawText(DIGITS, i, c - '/', f, f2, this.paint);
    }

    private static final class Slide {
        private final boolean down;
        private final char from;
        private final long start;
        private final char to;

        public Slide(char c, char c2, long j, boolean z) {
            this.from = c;
            this.to = c2;
            this.start = j;
            this.down = z;
        }

        public final boolean getDown() {
            return this.down;
        }

        public final char getFrom() {
            return this.from;
        }

        public final long getStart() {
            return this.start;
        }

        public final char getTo() {
            return this.to;
        }

        public final boolean done(long j) {
            return ((float) (j - this.start)) >= 280.0f;
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

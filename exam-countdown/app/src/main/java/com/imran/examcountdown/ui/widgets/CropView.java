package com.imran.examcountdown.ui.widgets;

import android.content.Context;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Matrix;
import android.graphics.Paint;
import android.graphics.Path;
import android.view.MotionEvent;
import android.view.ScaleGestureDetector;
import android.view.View;
import android.view.ViewParent;
import com.imran.examcountdown.ui.ThemeKt;
import kotlin.Metadata;
import kotlin.Unit;
import kotlin.jvm.functions.Function1;
import kotlin.jvm.internal.Intrinsics;
import kotlin.ranges.RangesKt;

public final class CropView extends View {
    private Bitmap bitmap;
    private float cx;
    private float cy;
    private boolean dragging;
    private final Matrix drawMatrix;
    private final Path hole;
    private final Paint imagePaint;
    private float lastX;
    private float lastY;
    private float minScale;
    private Function1<? super Float, Unit> onZoomChanged;
    private final Paint outline;
    private float radius;
    private float scale;
    private final ScaleGestureDetector scaler;
    private final Paint shade;
    private float tx;
    private float ty;

    public CropView(Context context) {
        super(context);
        Intrinsics.checkNotNullParameter(context, "context");
        this.scale = 1.0f;
        this.minScale = 1.0f;
        this.drawMatrix = new Matrix();
        this.imagePaint = new Paint(3);
        Paint paint = new Paint(1);
        paint.setColor(-1728053248);
        this.shade = paint;
        Paint paint2 = new Paint(1);
        paint2.setStyle(Paint.Style.STROKE);
        paint2.setStrokeWidth(ThemeKt.dpf(this, (Number) 2));
        paint2.setColor(-419430401);
        this.outline = paint2;
        this.hole = new Path();
        this.scaler = new ScaleGestureDetector(context, new CropView$scaler$1(this));
        setContentDescription("Photo crop area. Pinch to zoom and drag to move the photo.");
    }

    public static final float access$getScale$p(CropView cropView) {
        return cropView.scale;
    }

    public final Function1<? super Float, Unit> getOnZoomChanged() {
        return this.onZoomChanged;
    }

    public final void setOnZoomChanged(Function1<? super Float, Unit> function1) {
        this.onZoomChanged = function1;
    }

    public final void setBitmap(Bitmap b) {
        Intrinsics.checkNotNullParameter(b, "b");
        this.bitmap = b;
        reset();
    }

    public final void reset() {
        Bitmap bitmap = this.bitmap;
        if (bitmap == null) {
            return;
        }
        float f = this.radius;
        if (f <= 0.0f) {
            return;
        }
        float f2 = 2;
        float max = Math.max((f * f2) / bitmap.getWidth(), (f2 * this.radius) / bitmap.getHeight());
        this.minScale = max;
        this.scale = max;
        this.tx = this.cx - ((bitmap.getWidth() * this.scale) / 2.0f);
        this.ty = this.cy - ((bitmap.getHeight() * this.scale) / 2.0f);
        Function1<? super Float, Unit> function1 = this.onZoomChanged;
        if (function1 != null) {
            function1.invoke(Float.valueOf(0.0f));
        }
        invalidate();
    }

    public final void setZoom(float f) {
        zoomAround(this.minScale * ((RangesKt.coerceIn(f, 0.0f, 1.0f) * 4.0f) + 1.0f), this.cx, this.cy, false);
    }

    public static void zoomAround$default(CropView cropView, float f, float f2, float f3, boolean z, int i, Object obj) {
        if ((i & 8) != 0) {
            z = true;
        }
        cropView.zoomAround(f, f2, f3, z);
    }

    private final void zoomAround(float f, float f2, float f3, boolean z) {
        Function1<? super Float, Unit> function1;
        float f4 = this.minScale;
        float coerceIn = RangesKt.coerceIn(f, f4, 5.0f * f4);
        float f5 = this.scale;
        this.tx = f2 - ((f2 - this.tx) * (coerceIn / f5));
        this.ty = f3 - ((f3 - this.ty) * (coerceIn / f5));
        this.scale = coerceIn;
        clamp();
        if (z && (function1 = this.onZoomChanged) != null) {
            function1.invoke(Float.valueOf(((this.scale / this.minScale) - 1.0f) / 4.0f));
        }
        invalidate();
    }

    private final void clamp() {
        Bitmap bitmap = this.bitmap;
        if (bitmap == null) {
            return;
        }
        float width = bitmap.getWidth() * this.scale;
        float height = bitmap.getHeight() * this.scale;
        float f = this.tx;
        float f2 = this.cx;
        float f3 = this.radius;
        this.tx = RangesKt.coerceIn(f, (f2 + f3) - width, f2 - f3);
        float f4 = this.ty;
        float f5 = this.cy;
        float f6 = this.radius;
        this.ty = RangesKt.coerceIn(f4, (f5 + f6) - height, f5 - f6);
    }

    @Override
    protected void onSizeChanged(int i, int i2, int i3, int i4) {
        float f = i;
        this.cx = f / 2.0f;
        float f2 = i2;
        this.cy = f2 / 2.0f;
        this.radius = (Math.min(i, i2) / 2.0f) - ThemeKt.dpf(this, (Number) 16);
        this.hole.reset();
        this.hole.setFillType(Path.FillType.EVEN_ODD);
        this.hole.addRect(0.0f, 0.0f, f, f2, Path.Direction.CW);
        this.hole.addCircle(this.cx, this.cy, this.radius, Path.Direction.CW);
        reset();
    }

    @Override
    public boolean onTouchEvent(MotionEvent event) {
        Intrinsics.checkNotNullParameter(event, "event");
        if (this.bitmap == null) {
            return false;
        }
        this.scaler.onTouchEvent(event);
        int actionMasked = event.getActionMasked();
        if (actionMasked == 0) {
            this.lastX = event.getX();
            this.lastY = event.getY();
            this.dragging = true;
            ViewParent parent = getParent();
            if (parent != null) {
                parent.requestDisallowInterceptTouchEvent(true);
            }
        } else if (actionMasked == 1 || actionMasked == 3) {
            this.dragging = false;
            ViewParent parent2 = getParent();
            if (parent2 != null) {
                parent2.requestDisallowInterceptTouchEvent(false);
            }
        } else if (actionMasked == 2) {
            if (this.dragging && !this.scaler.isInProgress() && event.getPointerCount() == 1) {
                this.tx += event.getX() - this.lastX;
                this.ty += event.getY() - this.lastY;
                this.lastX = event.getX();
                this.lastY = event.getY();
                clamp();
                invalidate();
            }
        } else if (actionMasked == 5) {
            this.dragging = false;
        } else if (actionMasked == 6) {
            int i = event.getActionIndex() == 0 ? 1 : 0;
            this.lastX = event.getX(i);
            this.lastY = event.getY(i);
            this.dragging = true;
        }
        return true;
    }

    @Override
    protected void onDraw(Canvas canvas) {
        Intrinsics.checkNotNullParameter(canvas, "canvas");
        Bitmap bitmap = this.bitmap;
        if (bitmap == null) {
            return;
        }
        Matrix matrix = this.drawMatrix;
        float f = this.scale;
        matrix.setScale(f, f);
        this.drawMatrix.postTranslate(this.tx, this.ty);
        canvas.drawBitmap(bitmap, this.drawMatrix, this.imagePaint);
        canvas.drawPath(this.hole, this.shade);
        canvas.drawCircle(this.cx, this.cy, this.radius, this.outline);
    }

    public static Bitmap result$default(CropView cropView, int i, int i2, Object obj) {
        if ((i2 & 1) != 0) {
            i = 512;
        }
        return cropView.result(i);
    }

    public final Bitmap result(int i) {
        Bitmap bitmap = this.bitmap;
        if (bitmap == null) {
            return null;
        }
        Bitmap createBitmap = Bitmap.createBitmap(i, i, Bitmap.Config.ARGB_8888);
        Intrinsics.checkNotNullExpressionValue(createBitmap, "createBitmap(...)");
        Canvas canvas = new Canvas(createBitmap);
        float f = this.cx;
        float f2 = this.radius;
        float f3 = (f - f2) - this.tx;
        float f4 = this.scale;
        float f5 = (2 * f2) / f4;
        Matrix matrix = new Matrix();
        matrix.setTranslate(-(f3 / f4), -(((this.cy - f2) - this.ty) / f4));
        float f6 = i / f5;
        matrix.postScale(f6, f6);
        canvas.drawColor(-1);
        canvas.drawBitmap(bitmap, matrix, new Paint(3));
        return createBitmap;
    }
}

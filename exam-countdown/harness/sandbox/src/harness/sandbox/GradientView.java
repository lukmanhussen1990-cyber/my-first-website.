package harness.sandbox;

import android.content.Context;
import android.graphics.BlurMaskFilter;
import android.graphics.Canvas;
import android.graphics.LinearGradient;
import android.graphics.Paint;
import android.graphics.Path;
import android.graphics.RadialGradient;
import android.graphics.RectF;
import android.graphics.Shader;
import android.graphics.SweepGradient;
import android.graphics.Typeface;
import android.view.View;

/** A custom view that exercises the Canvas features the real app relies on. */
public class GradientView extends View {
    private final Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Path path = new Path();
    public Typeface serif;

    public GradientView(Context c) {
        super(c);
    }

    @Override
    protected void onDraw(Canvas canvas) {
        float w = getWidth(), h = getHeight();
        // 1) linear gradient rounded rect
        paint.setShader(new LinearGradient(0, 0, w, 0, 0xFF1F7A4D, 0xFFE0B04A, Shader.TileMode.CLAMP));
        canvas.drawRoundRect(new RectF(16, 16, w - 16, 120), 40, 40, paint);
        // 2) radial gradient circle
        paint.setShader(new RadialGradient(120, 250, 90, new int[]{0xFFFFFFFF, 0xFF3B82F6, 0xFF0B1B4D}, null, Shader.TileMode.CLAMP));
        canvas.drawCircle(120, 250, 90, paint);
        // 3) sweep gradient ring
        paint.setShader(new SweepGradient(w - 130, 250, new int[]{0xFFEF4444, 0xFFF59E0B, 0xFF10B981, 0xFF3B82F6, 0xFFEF4444}, null));
        paint.setStyle(Paint.Style.STROKE);
        paint.setStrokeWidth(28);
        paint.setStrokeCap(Paint.Cap.ROUND);
        canvas.drawArc(new RectF(w - 220, 160, w - 40, 340), -90, 250, false, paint);
        // 4) blur (mask filter) shadow + solid rect
        paint.setShader(null);
        paint.setStyle(Paint.Style.FILL);
        paint.setColor(0x99000000);
        paint.setMaskFilter(new BlurMaskFilter(18, BlurMaskFilter.Blur.NORMAL));
        canvas.drawRoundRect(new RectF(40, 390, w - 40, 470), 24, 24, paint);
        paint.setMaskFilter(null);
        paint.setColor(0xFFFFFFFF);
        canvas.drawRoundRect(new RectF(32, 380, w - 48, 458), 24, 24, paint);
        // 5) text with app font
        paint.setColor(0xFF14231B);
        paint.setTextSize(44);
        if (serif != null) paint.setTypeface(serif);
        canvas.drawText("Serif italic 24 days", 56, 430, paint);
        // 6) bezier path
        path.reset();
        path.moveTo(32, 560);
        path.cubicTo(w * 0.3f, 480, w * 0.6f, 680, w - 32, 540);
        paint.setStyle(Paint.Style.STROKE);
        paint.setStrokeWidth(8);
        paint.setColor(0xFF7C3AED);
        paint.setTypeface(null);
        canvas.drawPath(path, paint);
        paint.setStyle(Paint.Style.FILL);
    }
}

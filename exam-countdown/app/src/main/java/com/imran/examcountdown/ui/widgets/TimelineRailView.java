package com.imran.examcountdown.ui.widgets;

import android.content.Context;
import android.graphics.Canvas;
import android.graphics.Paint;
import android.graphics.Path;
import android.graphics.PathMeasure;
import android.view.View;
import com.imran.examcountdown.ui.Colors;
import com.imran.examcountdown.ui.Ease;
import com.imran.examcountdown.ui.FxKt;
import com.imran.examcountdown.ui.ThemeKt;
import com.imran.examcountdown.ui.Ui;
import kotlin.Metadata;
import kotlin.NoWhenBranchMatchedException;
import kotlin.enums.EnumEntries;
import kotlin.enums.EnumEntriesKt;
import kotlin.jvm.internal.Intrinsics;
import kotlin.ranges.RangesKt;

public final class TimelineRailView extends View {
    private boolean bottomLit;
    private final Paint check;
    private final Path checkPath;
    private final Paint fill;
    private boolean hasBottom;
    private boolean hasTop;
    private final Paint line;
    private final PathMeasure measure;
    private Node node;
    private final float nodeRadius;
    private float nodeY;
    private final Path partial;
    private float pulse;
    private float reveal;
    private final Paint ring;
    private boolean topLit;

    public class WhenMappings {
        public static final int[] $EnumSwitchMapping$0;

        static {
            int[] iArr = new int[Node.values().length];
            try {
                iArr[Node.DONE.ordinal()] = 1;
            } catch (NoSuchFieldError unused) {
            }
            try {
                iArr[Node.LIVE.ordinal()] = 2;
            } catch (NoSuchFieldError unused2) {
            }
            try {
                iArr[Node.TODAY.ordinal()] = 3;
            } catch (NoSuchFieldError unused3) {
            }
            try {
                iArr[Node.UPCOMING.ordinal()] = 4;
            } catch (NoSuchFieldError unused4) {
            }
            $EnumSwitchMapping$0 = iArr;
        }
    }

    /* JADX WARN: 'super' call moved to the top of the method (can break code semantics) */
    public TimelineRailView(Context context) {
        super(context);
        Intrinsics.checkNotNullParameter(context, "context");
        this.node = Node.UPCOMING;
        this.hasTop = true;
        this.hasBottom = true;
        TimelineRailView timelineRailView = this;
        this.nodeY = ThemeKt.dpf(timelineRailView, (Number) 22);
        this.reveal = 1.0f;
        this.nodeRadius = ThemeKt.dpf(timelineRailView, (Number) 8);
        Paint paint = new Paint(1);
        paint.setStrokeWidth(ThemeKt.dpf(timelineRailView, Float.valueOf(2.0f)));
        paint.setStrokeCap(Paint.Cap.ROUND);
        this.line = paint;
        this.fill = new Paint(1);
        Paint paint2 = new Paint(1);
        paint2.setStyle(Paint.Style.STROKE);
        this.ring = paint2;
        Paint paint3 = new Paint(1);
        paint3.setStyle(Paint.Style.STROKE);
        paint3.setStrokeWidth(ThemeKt.dpf(timelineRailView, Float.valueOf(1.8f)));
        paint3.setStrokeCap(Paint.Cap.ROUND);
        paint3.setStrokeJoin(Paint.Join.ROUND);
        this.check = paint3;
        this.checkPath = new Path();
        this.partial = new Path();
        this.measure = new PathMeasure();
        setImportantForAccessibility(2);
    }

    public enum Node {
        DONE,
        LIVE,
        TODAY,
        UPCOMING;


        public static EnumEntries<Node> getEntries() {
            return EnumEntriesKt.enumEntries(values());
        }

        Node() {
        }
    }

    public final Node getNode() {
        return this.node;
    }

    public final void setNode(Node node) {
        Intrinsics.checkNotNullParameter(node, "<set-?>");
        this.node = node;
    }

    public final boolean getHasTop() {
        return this.hasTop;
    }

    public final void setHasTop(boolean z) {
        this.hasTop = z;
    }

    public final boolean getHasBottom() {
        return this.hasBottom;
    }

    public final void setHasBottom(boolean z) {
        this.hasBottom = z;
    }

    public final boolean getTopLit() {
        return this.topLit;
    }

    public final void setTopLit(boolean z) {
        this.topLit = z;
    }

    public final boolean getBottomLit() {
        return this.bottomLit;
    }

    public final void setBottomLit(boolean z) {
        this.bottomLit = z;
    }

    public final float getNodeY() {
        return this.nodeY;
    }

    public final void setNodeY(float f) {
        this.nodeY = f;
    }

    public final float getPulse() {
        return this.pulse;
    }

    public final void setPulse(float f) {
        this.pulse = f;
        if (this.node == Node.LIVE || this.node == Node.TODAY) {
            invalidate();
        }
    }

    public final float getReveal() {
        return this.reveal;
    }

    public final void setReveal(float f) {
        this.reveal = f;
        invalidate();
    }

    @Override
    protected void onDraw(Canvas canvas) {
        Intrinsics.checkNotNullParameter(canvas, "canvas");
        Colors c = Ui.INSTANCE.getC();
        float width = getWidth() / 2.0f;
        float height = getHeight() * this.reveal;
        TimelineRailView timelineRailView = this;
        float dpf = this.nodeRadius + ThemeKt.dpf(timelineRailView, (Number) 4);
        if (this.hasTop) {
            float coerceAtMost = RangesKt.coerceAtMost(this.nodeY - dpf, height);
            if (coerceAtMost > 0.0f) {
                this.line.setColor(this.topLit ? c.getGreen() : c.getSeparator());
                canvas.drawLine(width, 0.0f, width, coerceAtMost, this.line);
            }
        }
        if (this.hasBottom && height > this.nodeY + dpf) {
            this.line.setColor(this.bottomLit ? c.getGreen() : c.getSeparator());
            canvas.drawLine(width, this.nodeY + dpf, width, height, this.line);
        }
        float f = this.reveal;
        if (0.02f <= f && f <= 0.98f && (this.hasBottom || height < this.nodeY)) {
            boolean z = height < this.nodeY ? this.topLit : this.bottomLit;
            this.fill.setColor(Ui.INSTANCE.withAlpha(z ? c.getGreenText() : c.getText3(), (1.0f - this.reveal) * 0.35f));
            canvas.drawCircle(width, height, ThemeKt.dpf(timelineRailView, Float.valueOf(4.5f)), this.fill);
            this.fill.setColor(Ui.INSTANCE.withAlpha(z ? c.getGreenText() : c.getText3(), 1.0f - (this.reveal * 0.5f)));
            canvas.drawCircle(width, height, ThemeKt.dpf(timelineRailView, Float.valueOf(1.8f)), this.fill);
        }
        float f2 = this.reveal;
        if (f2 < 0.1f) {
            return;
        }
        float spring = FxKt.spring(RangesKt.coerceIn((f2 - 0.1f) / 0.55f, 0.0f, 1.0f), 0.8f);
        canvas.save();
        canvas.translate(width, this.nodeY);
        canvas.scale(spring, spring);
        int i = WhenMappings.$EnumSwitchMapping$0[this.node.ordinal()];
        if (i == 1) {
            this.fill.setColor(c.getGreen());
            canvas.drawCircle(0.0f, 0.0f, this.nodeRadius, this.fill);
            float f3 = this.nodeRadius;
            this.checkPath.reset();
            float f4 = -f3;
            this.checkPath.moveTo(0.42f * f4, 0.02f * f3);
            this.checkPath.lineTo(0.1f * f4, 0.34f * f3);
            this.checkPath.lineTo(f3 * 0.45f, f4 * 0.3f);
            this.check.setColor(c.getOnGreen());
            float window = FxKt.window(this.reveal, 0.4f, 0.5f);
            if (window >= 1.0f) {
                canvas.drawPath(this.checkPath, this.check);
            } else if (window > 0.0f) {
                this.measure.setPath(this.checkPath, false);
                this.partial.reset();
                PathMeasure pathMeasure = this.measure;
                pathMeasure.getSegment(0.0f, pathMeasure.getLength() * window, this.partial, true);
                canvas.drawPath(this.partial, this.check);
            }
        } else if (i == 2) {
            drawPulse(canvas, c.getGold());
            this.fill.setColor(c.getGold());
            canvas.drawCircle(0.0f, 0.0f, this.nodeRadius, this.fill);
        } else if (i == 3) {
            drawPulse(canvas, c.getGold());
            this.fill.setColor(c.getBg());
            canvas.drawCircle(0.0f, 0.0f, this.nodeRadius, this.fill);
            this.ring.setColor(c.getGold());
            this.ring.setStrokeWidth(ThemeKt.dpf(timelineRailView, Float.valueOf(2.2f)));
            canvas.drawCircle(0.0f, 0.0f, this.nodeRadius - ThemeKt.dpf(timelineRailView, Float.valueOf(1.1f)), this.ring);
        } else if (i != 4) {
            throw new NoWhenBranchMatchedException();
        } else {
            this.fill.setColor(c.getBg());
            canvas.drawCircle(0.0f, 0.0f, this.nodeRadius, this.fill);
            this.ring.setColor(c.getText3());
            this.ring.setStrokeWidth(ThemeKt.dpf(timelineRailView, Float.valueOf(1.5f)));
            canvas.drawCircle(0.0f, 0.0f, this.nodeRadius * 0.7f, this.ring);
        }
        canvas.restore();
    }

    private final void drawPulse(Canvas canvas, int i) {
        if (this.pulse <= 0.0f) {
            return;
        }
        this.fill.setColor(Ui.INSTANCE.withAlpha(i, (((float) Math.sin(this.pulse * 6.283f)) * 0.1f) + 0.16f));
        TimelineRailView timelineRailView = this;
        canvas.drawCircle(0.0f, 0.0f, this.nodeRadius + ThemeKt.dpf(timelineRailView, (Number) 4), this.fill);
        this.ring.setStrokeWidth(ThemeKt.dpf(timelineRailView, Float.valueOf(1.5f)));
        for (int i2 = 0; i2 < 2; i2++) {
            float f = (this.pulse + (i2 * 0.5f)) % 1.0f;
            this.ring.setColor(Ui.INSTANCE.withAlpha(i, (1.0f - f) * 0.5f));
            canvas.drawCircle(0.0f, 0.0f, this.nodeRadius + (ThemeKt.dpf(timelineRailView, (Number) 8) * Ease.INSTANCE.cubicOut(f)), this.ring);
        }
    }
}

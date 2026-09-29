package com.imran.examcountdown.ui.widgets;

import android.view.ScaleGestureDetector;
import kotlin.Metadata;
import kotlin.jvm.internal.Intrinsics;

public final class CropView$scaler$1 extends ScaleGestureDetector.SimpleOnScaleGestureListener {
    final CropView this$0;

    public CropView$scaler$1(CropView cropView) {
        this.this$0 = cropView;
    }

    @Override
    public boolean onScale(ScaleGestureDetector detector) {
        Intrinsics.checkNotNullParameter(detector, "detector");
        CropView cropView = this.this$0;
        CropView.zoomAround$default(cropView, detector.getScaleFactor() * CropView.access$getScale$p(cropView), detector.getFocusX(), detector.getFocusY(), false, 8, null);
        return true;
    }
}

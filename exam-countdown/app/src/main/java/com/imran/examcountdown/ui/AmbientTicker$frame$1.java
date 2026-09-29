package com.imran.examcountdown.ui;

import android.view.Choreographer;
import kotlin.Metadata;
import kotlin.collections.CollectionsKt;
import kotlin.ranges.RangesKt;

public final class AmbientTicker$frame$1 implements Choreographer.FrameCallback {
    final AmbientTicker this$0;

    public AmbientTicker$frame$1(AmbientTicker ambientTicker) {
        this.this$0 = ambientTicker;
    }

    @Override
    public void doFrame(long j) {
        if (AmbientTicker.access$getRunning$p(this.this$0)) {
            long j2 = j / ((long) 1000000);
            for (AmbientListener ambientListener : CollectionsKt.toList(AmbientTicker.access$getListeners$p(this.this$0))) {
                ambientListener.onAmbientFrame(j2);
            }
            AmbientTicker.access$getChoreographer$p(this.this$0).postFrameCallbackDelayed(this, RangesKt.coerceAtLeast((1000 / ((long) AmbientTicker.access$getFps$p(this.this$0))) - 4, 0L));
        }
    }
}

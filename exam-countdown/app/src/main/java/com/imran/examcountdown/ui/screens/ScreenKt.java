package com.imran.examcountdown.ui.screens;

import android.animation.ValueAnimator;
import android.view.View;
import android.view.animation.LinearInterpolator;
import com.imran.examcountdown.ui.Ease;
import com.imran.examcountdown.ui.FxKt;
import java.util.List;
import java.util.WeakHashMap;
import kotlin.Metadata;
import kotlin.collections.CollectionsKt;
import kotlin.jvm.internal.Intrinsics;

public final class ScreenKt {
    private static final float ENTRANCE_MS = 300.0f;
    private static final long STAGGER_MS = 40;
    private static final WeakHashMap<View, ValueAnimator> entrances = new WeakHashMap<>();

    public static void $r8$lambda$JHdT2zTX65d7e7mHlfFM5TACy1I(View view, float f, ValueAnimator valueAnimator) {
        staggerIn$lambda$2$lambda$1$lambda$0(view, f, valueAnimator);
    }

    public static final WeakHashMap access$getEntrances$p() {
        return entrances;
    }

    public static final void access$settle(View view) {
        settle(view);
    }

    public static final void setVisible(View view, boolean z) {
        Intrinsics.checkNotNullParameter(view, "<this>");
        view.setVisibility(z ? 0 : 8);
    }

    public static void staggerIn$default(List list, boolean z, long j, int i, Object obj) {
        if ((i & 4) != 0) {
            j = 0;
        }
        staggerIn(list, z, j);
    }

    public static final void staggerIn(List<? extends View> views, boolean z, long j) {
        Intrinsics.checkNotNullParameter(views, "views");
        int i = 0;
        for (Object obj : views) {
            int i2 = i + 1;
            if (i < 0) {
                CollectionsKt.throwIndexOverflow();
            }
            View view = (View) obj;
            view.animate().cancel();
            WeakHashMap<View, ValueAnimator> weakHashMap = entrances;
            ValueAnimator remove = weakHashMap.remove(view);
            if (remove != null) {
                remove.cancel();
            }
            if (!z) {
                settle(view);
            } else {
                float f = view.getResources().getDisplayMetrics().density * 14;
                view.setAlpha(0.0f);
                view.setTranslationY(f);
                ValueAnimator ofFloat = ValueAnimator.ofFloat(0.0f, ENTRANCE_MS);
                ofFloat.setDuration(300L);
                ofFloat.setStartDelay((i * STAGGER_MS) + j);
                ofFloat.setInterpolator(new LinearInterpolator());
                ofFloat.addUpdateListener(new ScreenKt$$ExternalSyntheticLambda0(view, f));
                ofFloat.addListener(new ScreenKt$staggerIn$1$1$2(view));
                ofFloat.start();
                weakHashMap.put(view, ofFloat);
            }
            i = i2;
        }
    }

    private static final void staggerIn$lambda$2$lambda$1$lambda$0(View view, float f, ValueAnimator it) {
        Intrinsics.checkNotNullParameter(it, "it");
        Object animatedValue = it.getAnimatedValue();
        Intrinsics.checkNotNull(animatedValue, "null cannot be cast to non-null type kotlin.Float");
        float floatValue = ((Float) animatedValue).floatValue();
        view.setAlpha(Ease.INSTANCE.cubicOut(FxKt.window(floatValue, 0.0f, 200.0f)));
        view.setTranslationY(f * (1.0f - FxKt.spring(floatValue / ENTRANCE_MS, 0.86f)));
    }

    private static final void settle(View view) {
        view.setAlpha(1.0f);
        view.setTranslationY(0.0f);
        view.setScaleX(1.0f);
        view.setScaleY(1.0f);
    }
}

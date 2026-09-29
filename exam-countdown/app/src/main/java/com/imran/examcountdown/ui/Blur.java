package com.imran.examcountdown.ui;

import android.graphics.RenderEffect;
import android.graphics.Shader;
import android.os.Build;
import android.view.View;
import kotlin.Metadata;
import kotlin.jvm.internal.Intrinsics;

public final class Blur {
    public static final Blur INSTANCE = new Blur();
    private static final boolean supported;

    private Blur() {
    }

    static {
        supported = Build.VERSION.SDK_INT >= 31;
    }

    public final void set(View view, float f) {
        RenderEffect createBlurEffect;
        Intrinsics.checkNotNullParameter(view, "view");
        if (supported) {
            if (f < 0.5f) {
                createBlurEffect = null;
            } else {
                try {
                    createBlurEffect = RenderEffect.createBlurEffect(f, f, Shader.TileMode.DECAL);
                } catch (Throwable unused) {
                    return;
                }
            }
            view.setRenderEffect(createBlurEffect);
        }
    }
}

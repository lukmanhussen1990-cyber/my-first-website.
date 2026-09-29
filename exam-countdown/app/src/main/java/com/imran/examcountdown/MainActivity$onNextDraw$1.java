package com.imran.examcountdown;

import android.view.View;
import android.view.ViewTreeObserver;
import kotlin.Metadata;
import kotlin.Unit;
import kotlin.jvm.functions.Function0;

public final class MainActivity$onNextDraw$1 implements ViewTreeObserver.OnPreDrawListener {
    final Function0<Unit> $block;
    final View $view;

    public MainActivity$onNextDraw$1(View view, Function0<Unit> function0) {
        this.$view = view;
        this.$block = function0;
    }

    @Override
    public boolean onPreDraw() {
        this.$view.getViewTreeObserver().removeOnPreDrawListener(this);
        this.$block.invoke();
        return true;
    }
}

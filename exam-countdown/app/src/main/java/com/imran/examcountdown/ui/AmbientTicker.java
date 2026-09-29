package com.imran.examcountdown.ui;

import android.view.Choreographer;
import java.util.LinkedHashSet;
import kotlin.Metadata;
import kotlin.jvm.internal.DefaultConstructorMarker;
import kotlin.jvm.internal.Intrinsics;

public final class AmbientTicker {
    private final Choreographer choreographer;
    private final int fps;
    private final AmbientTicker$frame$1 frame;
    private final LinkedHashSet<AmbientListener> listeners;
    private boolean running;

    public AmbientTicker() {
        this(0, 1, null);
    }

    public AmbientTicker(int i) {
        this.fps = i;
        this.listeners = new LinkedHashSet<>();
        Choreographer choreographer = Choreographer.getInstance();
        Intrinsics.checkNotNullExpressionValue(choreographer, "getInstance(...)");
        this.choreographer = choreographer;
        this.frame = new AmbientTicker$frame$1(this);
    }

    public AmbientTicker(int i, int i2, DefaultConstructorMarker defaultConstructorMarker) {
        this((i2 & 1) != 0 ? 30 : i);
    }

    public static final Choreographer access$getChoreographer$p(AmbientTicker ambientTicker) {
        return ambientTicker.choreographer;
    }

    public static final int access$getFps$p(AmbientTicker ambientTicker) {
        return ambientTicker.fps;
    }

    public static final LinkedHashSet<AmbientListener> access$getListeners$p(AmbientTicker ambientTicker) {
        return ambientTicker.listeners;
    }

    public static final boolean access$getRunning$p(AmbientTicker ambientTicker) {
        return ambientTicker.running;
    }

    public final boolean isRunning() {
        return this.running;
    }

    public final int getListenerCount() {
        return this.listeners.size();
    }

    public final void add(AmbientListener listener) {
        Intrinsics.checkNotNullParameter(listener, "listener");
        this.listeners.add(listener);
    }

    public final void remove(AmbientListener listener) {
        Intrinsics.checkNotNullParameter(listener, "listener");
        this.listeners.remove(listener);
    }

    public final void start() {
        if (this.running) {
            return;
        }
        this.running = true;
        this.choreographer.postFrameCallback(this.frame);
    }

    public final void stop() {
        this.running = false;
        this.choreographer.removeFrameCallback(this.frame);
    }
}

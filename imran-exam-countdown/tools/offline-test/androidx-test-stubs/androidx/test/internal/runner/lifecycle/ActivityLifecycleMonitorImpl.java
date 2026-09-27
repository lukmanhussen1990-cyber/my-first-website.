// Minimal stand-in for part of androidx.test (Apache 2.0 API), written for this test
// harness because androidx.test is only published on Google Maven.
package androidx.test.internal.runner.lifecycle;

import android.app.Activity;
import androidx.test.runner.lifecycle.ActivityLifecycleCallback;
import androidx.test.runner.lifecycle.ActivityLifecycleMonitor;
import androidx.test.runner.lifecycle.Stage;
import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.WeakHashMap;

/** Tracks each activity's lifecycle stage, as the real androidx.test monitor does. */
public final class ActivityLifecycleMonitorImpl implements ActivityLifecycleMonitor {
    private final Map<Activity, Stage> stages = new WeakHashMap<>();
    private final List<ActivityLifecycleCallback> callbacks = new ArrayList<>();

    public ActivityLifecycleMonitorImpl() {}

    public ActivityLifecycleMonitorImpl(boolean declawThreadCheck) {}

    public synchronized void signalLifecycleChange(Stage stage, Activity activity) {
        if (stage == Stage.DESTROYED) stages.remove(activity); else stages.put(activity, stage);
        for (ActivityLifecycleCallback c : new ArrayList<>(callbacks)) c.onActivityLifecycleChanged(activity, stage);
    }

    @Override public synchronized void addLifecycleCallback(ActivityLifecycleCallback callback) { callbacks.add(callback); }

    @Override public synchronized void removeLifecycleCallback(ActivityLifecycleCallback callback) { callbacks.remove(callback); }

    @Override public synchronized Stage getLifecycleStageOf(Activity activity) {
        Stage s = stages.get(activity);
        if (s == null) throw new IllegalArgumentException("Unknown activity: " + activity);
        return s;
    }

    @Override public synchronized Collection<Activity> getActivitiesInStage(Stage stage) {
        List<Activity> out = new ArrayList<>();
        for (Map.Entry<Activity, Stage> e : stages.entrySet()) if (e.getValue() == stage) out.add(e.getKey());
        return out;
    }
}

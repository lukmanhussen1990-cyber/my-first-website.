package androidx.test.internal.runner.lifecycle;

import android.app.Activity;
import androidx.test.runner.lifecycle.ActivityLifecycleCallback;
import androidx.test.runner.lifecycle.ActivityLifecycleMonitor;
import androidx.test.runner.lifecycle.Stage;
import java.lang.ref.WeakReference;
import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;

/** Keeps the last known Stage of each Activity and dispatches changes to registered callbacks. */
public class ActivityLifecycleMonitorImpl implements ActivityLifecycleMonitor {
  private final List<ActivityLifecycleCallback> callbacks = new CopyOnWriteArrayList<>();
  private final List<Entry> entries = new ArrayList<>();

  private static final class Entry {
    final WeakReference<Activity> activity;
    Stage stage;
    Entry(Activity a, Stage s) { activity = new WeakReference<>(a); stage = s; }
  }

  @Override
  public void addLifecycleCallback(ActivityLifecycleCallback callback) {
    if (callback != null && !callbacks.contains(callback)) callbacks.add(callback);
  }

  @Override
  public void removeLifecycleCallback(ActivityLifecycleCallback callback) {
    callbacks.remove(callback);
  }

  public void signalLifecycleChange(Stage stage, Activity activity) {
    synchronized (entries) {
      Entry found = null;
      for (int i = entries.size() - 1; i >= 0; i--) {
        Activity a = entries.get(i).activity.get();
        if (a == null) { entries.remove(i); continue; }
        if (a == activity) found = entries.get(i);
      }
      if (found == null) entries.add(new Entry(activity, stage)); else found.stage = stage;
    }
    for (ActivityLifecycleCallback cb : callbacks) {
      cb.onActivityLifecycleChanged(activity, stage);
    }
  }

  @Override
  public Stage getLifecycleStageOf(Activity activity) {
    synchronized (entries) {
      for (Entry e : entries) {
        if (e.activity.get() == activity) return e.stage;
      }
    }
    throw new IllegalArgumentException("Unknown activity: " + activity);
  }

  @Override
  public Collection<Activity> getActivitiesInStage(Stage stage) {
    List<Activity> out = new ArrayList<>();
    synchronized (entries) {
      for (Entry e : entries) {
        Activity a = e.activity.get();
        if (a != null && e.stage == stage) out.add(a);
      }
    }
    return out;
  }
}

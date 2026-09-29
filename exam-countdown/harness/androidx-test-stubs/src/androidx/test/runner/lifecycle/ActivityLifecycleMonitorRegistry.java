package androidx.test.runner.lifecycle;

import java.util.concurrent.atomic.AtomicReference;

/** Holds the single ActivityLifecycleMonitor of the current instrumentation. */
public final class ActivityLifecycleMonitorRegistry {
  private static final AtomicReference<ActivityLifecycleMonitor> INSTANCE = new AtomicReference<>();

  private ActivityLifecycleMonitorRegistry() {}

  public static ActivityLifecycleMonitor getInstance() {
    ActivityLifecycleMonitor m = INSTANCE.get();
    if (m == null) {
      throw new IllegalStateException(
          "No lifecycle monitor registered! Are you running under an Instrumentation which registers lifecycle monitors?");
    }
    return m;
  }

  public static void registerInstance(ActivityLifecycleMonitor monitor) {
    INSTANCE.set(monitor);
  }
}

package androidx.test.runner.lifecycle;

import java.util.concurrent.atomic.AtomicReference;

public final class ApplicationLifecycleMonitorRegistry {
  private static final AtomicReference<ApplicationLifecycleMonitor> INSTANCE = new AtomicReference<>();

  private ApplicationLifecycleMonitorRegistry() {}

  public static ApplicationLifecycleMonitor getInstance() {
    ApplicationLifecycleMonitor m = INSTANCE.get();
    if (m == null) {
      throw new IllegalStateException("No application lifecycle monitor registered!");
    }
    return m;
  }

  public static void registerInstance(ApplicationLifecycleMonitor monitor) {
    INSTANCE.set(monitor);
  }
}

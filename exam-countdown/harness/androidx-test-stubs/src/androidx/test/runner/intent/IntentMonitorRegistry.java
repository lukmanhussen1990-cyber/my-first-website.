package androidx.test.runner.intent;

import java.util.concurrent.atomic.AtomicReference;

public final class IntentMonitorRegistry {
  private static final AtomicReference<IntentMonitor> INSTANCE = new AtomicReference<>();

  private IntentMonitorRegistry() {}

  public static IntentMonitor getInstance() {
    IntentMonitor m = INSTANCE.get();
    if (m == null) {
      throw new IllegalStateException("No intent monitor registered!");
    }
    return m;
  }

  public static void registerInstance(IntentMonitor monitor) {
    INSTANCE.set(monitor);
  }
}

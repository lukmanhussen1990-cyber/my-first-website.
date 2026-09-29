package androidx.test.platform.app;

import android.app.Instrumentation;
import android.content.Context;
import android.os.Bundle;
import java.util.concurrent.atomic.AtomicReference;

/** Holder for the current Instrumentation, registered by Robolectric's RoboMonitoringInstrumentation. */
public final class InstrumentationRegistry {
  private static final AtomicReference<Instrumentation> INSTRUMENTATION = new AtomicReference<>();
  private static final AtomicReference<Bundle> ARGUMENTS = new AtomicReference<>();

  private InstrumentationRegistry() {}

  public static Instrumentation getInstrumentation() {
    Instrumentation i = INSTRUMENTATION.get();
    if (i == null) {
      throw new IllegalStateException("No instrumentation registered! Must run under a registering instrumentation.");
    }
    return i;
  }

  public static Bundle getArguments() {
    Bundle b = ARGUMENTS.get();
    if (b == null) throw new IllegalStateException("No instrumentation arguments registered!");
    return new Bundle(b);
  }

  public static void registerInstance(Instrumentation instrumentation, Bundle arguments) {
    INSTRUMENTATION.set(instrumentation);
    ARGUMENTS.set(new Bundle(arguments));
  }

  public static Context getContext() { return getInstrumentation().getContext(); }
  public static Context getTargetContext() { return getInstrumentation().getTargetContext(); }
}

// Minimal stand-in for part of androidx.test (Apache 2.0 API), written for this test
// harness because androidx.test is only published on Google Maven.
package androidx.test.runner.lifecycle;

public final class ActivityLifecycleMonitorRegistry {
    private static volatile ActivityLifecycleMonitor instance;

    private ActivityLifecycleMonitorRegistry() {}

    public static void registerInstance(ActivityLifecycleMonitor monitor) { instance = monitor; }

    public static ActivityLifecycleMonitor getInstance() {
        ActivityLifecycleMonitor m = instance;
        if (m == null) throw new IllegalStateException("No lifecycle monitor registered");
        return m;
    }
}

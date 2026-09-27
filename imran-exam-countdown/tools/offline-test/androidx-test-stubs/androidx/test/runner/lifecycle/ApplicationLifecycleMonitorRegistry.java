// Minimal stand-in for part of androidx.test (Apache 2.0 API), written for this test
// harness because androidx.test is only published on Google Maven.
package androidx.test.runner.lifecycle;

public final class ApplicationLifecycleMonitorRegistry {
    private static volatile ApplicationLifecycleMonitor instance;

    private ApplicationLifecycleMonitorRegistry() {}

    public static void registerInstance(ApplicationLifecycleMonitor monitor) { instance = monitor; }

    public static ApplicationLifecycleMonitor getInstance() { return instance; }
}

// Minimal stand-in for part of androidx.test (Apache 2.0 API), written for this test
// harness because androidx.test is only published on Google Maven.
package androidx.test.runner.intent;

public final class IntentMonitorRegistry {
    private static volatile IntentMonitor instance;

    private IntentMonitorRegistry() {}

    public static void registerInstance(IntentMonitor monitor) { instance = monitor; }

    public static IntentMonitor getInstance() { return instance; }
}

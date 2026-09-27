// Minimal stand-in for part of androidx.test (Apache 2.0 API), written for this test
// harness because androidx.test is only published on Google Maven.
package androidx.test.runner.intent;

/** Nothing stubs intents in these tests. */
public final class IntentStubberRegistry {
    private IntentStubberRegistry() {}

    public static boolean isLoaded() { return false; }

    public static IntentStubber getInstance() { throw new IllegalStateException("No IntentStubber loaded"); }
}

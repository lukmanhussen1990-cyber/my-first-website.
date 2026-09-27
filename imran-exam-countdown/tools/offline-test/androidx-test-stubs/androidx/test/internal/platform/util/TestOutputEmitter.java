// Minimal stand-in for part of androidx.test (Apache 2.0 API), written for this test
// harness because androidx.test is only published on Google Maven.
package androidx.test.internal.platform.util;

public final class TestOutputEmitter {
    private TestOutputEmitter() {}

    public static void dumpThreadStates(String outputFileName) {}
}

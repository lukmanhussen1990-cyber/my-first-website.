// Minimal stand-in for part of androidx.test (Apache 2.0 API), written for this test
// harness because androidx.test is only published on Google Maven.
package androidx.test.platform.app;

import android.app.Instrumentation;
import android.os.Bundle;

public final class InstrumentationRegistry {
    private static volatile Instrumentation instrumentation;
    private static volatile Bundle arguments = new Bundle();

    private InstrumentationRegistry() {}

    public static void registerInstance(Instrumentation instance, Bundle args) {
        instrumentation = instance;
        arguments = args == null ? new Bundle() : new Bundle(args);
    }

    public static Instrumentation getInstrumentation() {
        Instrumentation i = instrumentation;
        if (i == null) throw new IllegalStateException("No instrumentation registered");
        return i;
    }

    public static Bundle getArguments() {
        return new Bundle(arguments);
    }
}

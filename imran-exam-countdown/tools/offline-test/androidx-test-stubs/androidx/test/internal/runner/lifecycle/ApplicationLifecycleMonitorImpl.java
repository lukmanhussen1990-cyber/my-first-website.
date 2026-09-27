// Minimal stand-in for part of androidx.test (Apache 2.0 API), written for this test
// harness because androidx.test is only published on Google Maven.
package androidx.test.internal.runner.lifecycle;

import android.app.Application;
import androidx.test.runner.lifecycle.ApplicationLifecycleMonitor;
import androidx.test.runner.lifecycle.ApplicationStage;

public final class ApplicationLifecycleMonitorImpl implements ApplicationLifecycleMonitor {
    public void signalLifecycleChange(Application app, ApplicationStage stage) {}
}

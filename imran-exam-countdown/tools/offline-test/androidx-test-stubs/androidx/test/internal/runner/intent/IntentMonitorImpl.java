// Minimal stand-in for part of androidx.test (Apache 2.0 API), written for this test
// harness because androidx.test is only published on Google Maven.
package androidx.test.internal.runner.intent;

import android.content.Intent;
import androidx.test.runner.intent.IntentMonitor;

public final class IntentMonitorImpl implements IntentMonitor {
    public void signalIntent(Intent intent) {}
}

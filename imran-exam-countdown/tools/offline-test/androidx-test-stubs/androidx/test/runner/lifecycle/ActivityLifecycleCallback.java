// Minimal stand-in for part of androidx.test (Apache 2.0 API), written for this test
// harness because androidx.test is only published on Google Maven.
package androidx.test.runner.lifecycle;

import android.app.Activity;

public interface ActivityLifecycleCallback {
    void onActivityLifecycleChanged(Activity activity, Stage stage);
}

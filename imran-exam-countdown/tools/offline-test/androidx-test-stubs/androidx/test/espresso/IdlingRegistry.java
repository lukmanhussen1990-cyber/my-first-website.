// Minimal stand-in for part of androidx.test (Apache 2.0 API), written for this test
// harness because androidx.test is only published on Google Maven.
package androidx.test.espresso;

import android.os.Looper;
import java.util.Collection;
import java.util.Collections;

/** No Espresso idling resources are used by these tests. */
public final class IdlingRegistry {
    private static final IdlingRegistry INSTANCE = new IdlingRegistry();

    public static IdlingRegistry getInstance() { return INSTANCE; }

    public Collection<IdlingResource> getResources() { return Collections.emptyList(); }

    public Collection<Looper> getLoopers() { return Collections.emptyList(); }
}

package androidx.test.espresso;

import android.os.Looper;
import java.util.Collection;
import java.util.Collections;
import java.util.LinkedHashSet;
import java.util.Set;

public final class IdlingRegistry {
  private static final IdlingRegistry INSTANCE = new IdlingRegistry();
  private final Set<IdlingResource> resources = new LinkedHashSet<>();
  private final Set<Looper> loopers = new LinkedHashSet<>();

  private IdlingRegistry() {}

  public static IdlingRegistry getInstance() { return INSTANCE; }

  public synchronized boolean register(IdlingResource... idlingResources) {
    boolean changed = false;
    for (IdlingResource r : idlingResources) changed |= resources.add(r);
    return changed;
  }

  public synchronized boolean unregister(IdlingResource... idlingResources) {
    boolean changed = false;
    for (IdlingResource r : idlingResources) changed |= resources.remove(r);
    return changed;
  }

  public synchronized void registerLooperAsIdlingResource(Looper looper) { loopers.add(looper); }

  public synchronized void unregisterLooperAsIdlingResource(Looper looper) { loopers.remove(looper); }

  public synchronized Collection<IdlingResource> getResources() {
    return Collections.unmodifiableSet(new LinkedHashSet<>(resources));
  }

  public synchronized Collection<Looper> getLoopers() {
    return Collections.unmodifiableSet(new LinkedHashSet<>(loopers));
  }
}

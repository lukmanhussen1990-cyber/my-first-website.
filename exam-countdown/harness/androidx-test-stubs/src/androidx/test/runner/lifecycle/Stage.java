package androidx.test.runner.lifecycle;

/** Activity lifecycle stages (same constants, same order, as androidx.test:monitor). */
public enum Stage {
  PRE_ON_CREATE, CREATED, STARTED, RESUMED, PAUSED, STOPPED, RESTARTED, DESTROYED
}

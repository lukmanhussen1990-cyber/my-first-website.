package androidx.test.runner.intent;

public final class IntentStubberRegistry {
  private static volatile IntentStubber instance;

  private IntentStubberRegistry() {}

  public static synchronized IntentStubber getInstance() {
    if (instance == null) {
      throw new IllegalStateException("No intent monitor registered!");
    }
    return instance;
  }

  public static synchronized void load(IntentStubber stubber) {
    instance = stubber;
  }

  public static synchronized boolean isLoaded() {
    return instance != null;
  }
}

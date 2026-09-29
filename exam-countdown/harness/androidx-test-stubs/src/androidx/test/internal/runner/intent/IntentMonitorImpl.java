package androidx.test.internal.runner.intent;

import android.content.Intent;
import androidx.test.runner.intent.IntentCallback;
import androidx.test.runner.intent.IntentMonitor;
import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;

public class IntentMonitorImpl implements IntentMonitor {
  private final List<IntentCallback> callbacks = new CopyOnWriteArrayList<>();

  @Override
  public void addIntentCallback(IntentCallback callback) {
    if (callback != null && !callbacks.contains(callback)) callbacks.add(callback);
  }

  @Override
  public void removeIntentCallback(IntentCallback callback) {
    callbacks.remove(callback);
  }

  public void signalIntent(Intent intent) {
    for (IntentCallback cb : callbacks) cb.onIntentSent(intent);
  }
}

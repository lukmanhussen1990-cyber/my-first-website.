package androidx.test.internal.platform.util;

import java.util.Map;

public final class TestOutputEmitter {
  private TestOutputEmitter() {}

  public static void dumpThreadStates(String outputFileName) {
    StringBuilder sb = new StringBuilder();
    for (Map.Entry<Thread, StackTraceElement[]> e : Thread.getAllStackTraces().entrySet()) {
      sb.append('"').append(e.getKey().getName()).append("\" ").append(e.getKey().getState()).append('\n');
      for (StackTraceElement el : e.getValue()) sb.append("    at ").append(el).append('\n');
    }
    System.err.println("[androidx-test-stubs] thread dump (" + outputFileName + "):\n" + sb);
  }
}

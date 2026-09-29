package harness;

import java.io.File;
import java.io.PrintStream;
import java.util.ArrayList;
import java.util.List;
import org.junit.runner.Description;
import org.junit.runner.JUnitCore;
import org.junit.runner.Request;
import org.junit.runner.Result;
import org.junit.runner.manipulation.Filter;
import org.junit.runner.notification.Failure;
import org.junit.runner.notification.RunListener;

/**
 * Tiny JUnit4 launcher: discovers *Test classes under a directory, filters tests by substring
 * (matched against "Class.method"), prints one line per test and a summary.
 *
 * <pre>java harness.Main --dir build/harness/app/testclasses [--filter home] [Fully.Qualified.Class ...]</pre>
 */
public final class Main {
    public static void main(String[] args) throws Exception {
        String dir = null;
        List<String> filters = new ArrayList<>();
        List<String> classNames = new ArrayList<>();
        for (int i = 0; i < args.length; i++) {
            if (args[i].equals("--dir")) dir = args[++i];
            else if (args[i].equals("--filter")) filters.add(args[++i].toLowerCase());
            else classNames.add(args[i]);
        }
        if (dir != null) scan(new File(dir), new File(dir), classNames);
        if (classNames.isEmpty()) {
            System.err.println("harness.Main: no test classes found");
            System.exit(3);
        }
        List<Class<?>> classes = new ArrayList<>();
        for (String n : classNames) classes.add(Class.forName(n));

        final PrintStream out = System.out;
        Request req = Request.classes(classes.toArray(new Class<?>[0]));
        if (!filters.isEmpty()) {
            final List<String> fs = filters;
            req = req.filterWith(new Filter() {
                @Override public boolean shouldRun(Description d) {
                    if (d.isSuite()) {
                        for (Description c : d.getChildren()) if (shouldRun(c)) return true;
                        return false;
                    }
                    String id = (d.getClassName() + "." + d.getMethodName()).toLowerCase();
                    for (String f : fs) if (id.contains(f)) return true;
                    return false;
                }
                @Override public String describe() { return "filter " + fs; }
            });
        }
        JUnitCore core = new JUnitCore();
        final long[] t0 = new long[1];
        final List<Failure> failures = new ArrayList<>();
        core.addListener(new RunListener() {
            @Override public void testStarted(Description d) { t0[0] = System.nanoTime(); out.println("[run ] " + name(d)); out.flush(); }
            @Override public void testFinished(Description d) {
                boolean failed = false;
                for (Failure f : failures) if (f.getDescription().equals(d)) failed = true;
                out.println("[" + (failed ? "FAIL" : "ok  ") + "] " + name(d) + " (" + (System.nanoTime() - t0[0]) / 1_000_000 + " ms)");
                out.flush();
            }
            @Override public void testFailure(Failure f) { failures.add(f); }
            @Override public void testAssumptionFailure(Failure f) { out.println("[skip] " + name(f.getDescription()) + ": " + f.getMessage()); }
            @Override public void testIgnored(Description d) { out.println("[skip] " + name(d)); }
        });
        Result r = core.run(req);
        for (Failure f : r.getFailures()) {
            out.println();
            out.println("---- FAILURE " + name(f.getDescription()) + " ----");
            String trace = f.getTrace();
            String[] lines = trace.split("\n");
            int max = Integer.getInteger("harness.trace.lines", 40);
            for (int i = 0; i < Math.min(lines.length, max); i++) out.println(lines[i]);
            if (lines.length > max) out.println("  ... (" + (lines.length - max) + " more lines; -Dharness.trace.lines=N)");
        }
        out.println();
        out.println("Tests run: " + r.getRunCount() + ", failed: " + r.getFailureCount() + ", skipped: " + r.getIgnoreCount()
                + ", time: " + r.getRunTime() / 1000.0 + " s");
        System.exit(r.wasSuccessful() ? 0 : 1);
    }

    private static String name(Description d) {
        String c = d.getClassName();
        return c.substring(c.lastIndexOf('.') + 1) + "." + d.getMethodName();
    }

    private static void scan(File root, File cur, List<String> out) {
        File[] fs = cur.listFiles();
        if (fs == null) return;
        java.util.Arrays.sort(fs);
        for (File f : fs) {
            if (f.isDirectory()) scan(root, f, out);
            else if (f.getName().endsWith("Test.class") && !f.getName().contains("$")) {
                String rel = root.toURI().relativize(f.toURI()).getPath();
                out.add(rel.substring(0, rel.length() - 6).replace('/', '.'));
            }
        }
    }
}

package harness;

import android.app.Activity;
import android.graphics.Insets;
import android.graphics.Rect;
import android.os.SystemClock;
import android.view.MotionEvent;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowInsets;
import android.widget.TextView;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.TimeUnit;
import java.util.function.Predicate;
import java.util.regex.Pattern;
import org.robolectric.shadows.ShadowLooper;

/** View-tree helpers for tests: search, tap, dump, fake system-bar insets, settling the main looper. */
public final class Views {
    private Views() {}

    public static List<View> all(View root) {
        List<View> out = new ArrayList<>();
        walk(root, out);
        return out;
    }

    private static void walk(View v, List<View> out) {
        out.add(v);
        if (v instanceof ViewGroup) {
            ViewGroup g = (ViewGroup) v;
            for (int i = 0; i < g.getChildCount(); i++) walk(g.getChildAt(i), out);
        }
    }

    public static View find(View root, Predicate<View> p) {
        for (View v : all(root)) if (p.test(v)) return v;
        return null;
    }

    /** First visible TextView whose text matches {@code regex} (find(), case-insensitive). */
    public static TextView findText(View root, String regex) {
        Pattern p = Pattern.compile(regex, Pattern.CASE_INSENSITIVE);
        for (View v : all(root)) {
            if (v instanceof TextView && v.getVisibility() == View.VISIBLE && v.isShown()) {
                CharSequence t = ((TextView) v).getText();
                if (t != null && p.matcher(t).find()) return (TextView) v;
            }
        }
        return null;
    }

    public static View findDescription(View root, String regex) {
        Pattern p = Pattern.compile(regex, Pattern.CASE_INSENSITIVE);
        for (View v : all(root)) {
            CharSequence d = v.getContentDescription();
            if (d != null && p.matcher(d).find()) return v;
        }
        return null;
    }

    /** Clicks the nearest clickable ancestor-or-self of the first view whose text matches; throws if none. */
    public static void clickText(View root, String regex) {
        TextView t = findText(root, regex);
        if (t == null) throw new AssertionError("no visible text matching /" + regex + "/ in:\n" + dumpText(root));
        tap(clickable(t));
    }

    public static View clickable(View v) {
        View cur = v;
        while (cur != null) {
            if (cur.isClickable() || cur.hasOnClickListeners()) return cur;
            if (!(cur.getParent() instanceof View)) break;
            cur = (View) cur.getParent();
        }
        return v;
    }

    /** Dispatches a real DOWN/UP touch pair at the view's centre (so custom touch handling runs), then performs click if unhandled. */
    public static void tap(View v) {
        int[] loc = new int[2];
        v.getLocationOnScreen(loc);
        float x = loc[0] + v.getWidth() / 2f, y = loc[1] + v.getHeight() / 2f;
        long t = SystemClock.uptimeMillis();
        View root = v.getRootView();
        int[] rl = new int[2];
        root.getLocationOnScreen(rl);
        MotionEvent down = MotionEvent.obtain(t, t, MotionEvent.ACTION_DOWN, x - rl[0], y - rl[1], 0);
        MotionEvent up = MotionEvent.obtain(t, t + 60, MotionEvent.ACTION_UP, x - rl[0], y - rl[1], 0);
        boolean h1 = root.dispatchTouchEvent(down);
        settle(70);
        boolean h2 = root.dispatchTouchEvent(up);
        down.recycle();
        up.recycle();
        if (!h1 && !h2) v.performClick();
        settle(50);
    }

    /** Runs the main looper for {@code ms} of virtual time (timers, posted runnables, animator frames). */
    public static void settle(long ms) {
        ShadowLooper.idleMainLooper(ms, TimeUnit.MILLISECONDS);
    }

    /** Pretend the window has a status bar and a navigation bar (Robolectric delivers zero insets by default). */
    public static void insets(Activity a, int topDp, int bottomDp) {
        float d = a.getResources().getDisplayMetrics().density;
        Insets bars = Insets.of(0, Math.round(topDp * d), 0, Math.round(bottomDp * d));
        WindowInsets wi = new WindowInsets.Builder()
                .setInsets(WindowInsets.Type.statusBars(), Insets.of(0, bars.top, 0, 0))
                .setInsets(WindowInsets.Type.navigationBars(), Insets.of(0, 0, 0, bars.bottom))
                .setVisible(WindowInsets.Type.statusBars(), true)
                .setVisible(WindowInsets.Type.navigationBars(), true)
                .build();
        View decor = a.getWindow().getDecorView();
        decor.dispatchApplyWindowInsets(wi);
        decor.requestLayout();
    }

    public static Rect bounds(View v) {
        int[] l = new int[2];
        v.getLocationOnScreen(l);
        return new Rect(l[0], l[1], l[0] + v.getWidth(), l[1] + v.getHeight());
    }

    /** Human-readable tree, for debugging test scripts. */
    public static String dump(View root) {
        StringBuilder sb = new StringBuilder();
        dump(root, 0, sb, false);
        return sb.toString();
    }

    /** Only the visible texts, in draw order. */
    public static String dumpText(View root) {
        StringBuilder sb = new StringBuilder();
        for (View v : all(root)) {
            if (v instanceof TextView && v.isShown()) sb.append("  \"").append(((TextView) v).getText()).append("\"\n");
        }
        return sb.toString();
    }

    private static void dump(View v, int depth, StringBuilder sb, boolean onlyVisible) {
        for (int i = 0; i < depth; i++) sb.append("  ");
        sb.append(v.getClass().getSimpleName());
        Rect b = new Rect(v.getLeft(), v.getTop(), v.getRight(), v.getBottom());
        sb.append(' ').append(b.width()).append('x').append(b.height()).append('@').append(b.left).append(',').append(b.top);
        if (v.getVisibility() != View.VISIBLE) sb.append(" [gone/invisible]");
        if (v.getAlpha() < 1f) sb.append(" a=").append(v.getAlpha());
        if (v instanceof TextView) sb.append(" \"").append(((TextView) v).getText()).append('"');
        if (v.getContentDescription() != null) sb.append(" cd=\"").append(v.getContentDescription()).append('"');
        sb.append('\n');
        if (v instanceof ViewGroup) {
            ViewGroup g = (ViewGroup) v;
            for (int i = 0; i < g.getChildCount(); i++) dump(g.getChildAt(i), depth + 1, sb, onlyVisible);
        }
    }
}

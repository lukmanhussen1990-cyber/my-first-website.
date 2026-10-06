package com.imrano.arrowgo;

import android.annotation.SuppressLint;
import android.annotation.TargetApi;
import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.content.res.AssetManager;
import android.media.AudioManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.os.VibratorManager;
import android.util.Log;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.view.Window;
import android.view.WindowInsetsController;
import android.view.WindowManager;
import android.webkit.ConsoleMessage;
import android.webkit.JavascriptInterface;
import android.webkit.RenderProcessGoneDetail;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.TextView;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.Charset;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;

/**
 * ArrowGO! by ImranO: a thin, full-window WebView shell around the web game.
 *
 * <ul>
 *   <li>The web files are packaged under {@code assets/www/} and served from
 *       {@code https://appassets.androidplatform.net/} by {@link #shouldInterceptRequest}, so the
 *       page runs on a normal secure origin (localStorage works, no file:// quirks).</li>
 *   <li>{@code window.AndroidBridge} (see docs/ARCHITECTURE.md): vibrate, setSystemBars, exitApp,
 *       getAppVersion.</li>
 *   <li>Hardware back is offered to {@code window.ArrowGO.handleBack()} first; lifecycle changes
 *       call {@code window.ArrowGO.onPause()} / {@code onResume()}.</li>
 * </ul>
 *
 * Plain android.app.Activity, no androidx. minSdk 24: every call to an API newer than 24 is
 * behind a Build.VERSION.SDK_INT check and lives in a nested ApiNN helper class, so older
 * devices never even resolve the newer classes.
 */
public class MainActivity extends Activity {

    static final String TAG = "ArrowGO";

    /** Virtual host the web app is served from (reserved by Android for exactly this purpose). */
    static final String ASSET_HOST = "appassets.androidplatform.net";
    static final String START_URL = "https://" + ASSET_HOST + "/index.html";
    /** Folder inside the APK's assets/ that holds the web files. */
    static final String ASSET_ROOT = "www";

    static final String BRIDGE_NAME = "AndroidBridge";
    static final String FALLBACK_VERSION = "1.0.0";

    /** Brand cream #F5EBD8 (also the theme's window background, so there is no white flash). */
    static final int COLOR_CREAM = 0xFFF5EBD8;
    /** Navigation bar on API 24-25 when the page wants dark icons (not supported there). */
    static final int COLOR_LEGACY_NAV = 0xFF000000;

    static final long VIBRATE_MIN_MS = 1L;
    static final long VIBRATE_MAX_MS = 1000L;
    static final long DEFAULT_VIBRATE_MS = 20L;

    private static final long BACK_TIMEOUT_MS = 1500L;
    /** More renderer deaths than this within RENDERER_RESTART_WINDOW_MS closes the app. */
    private static final int MAX_RENDERER_RESTARTS = 3;
    private static final long RENDERER_RESTART_WINDOW_MS = 60_000L;

    private static final String JS_HANDLE_BACK =
            "(function(){try{return !!(window.ArrowGO&&window.ArrowGO.handleBack&&window.ArrowGO.handleBack());}catch(e){return false;}})()";
    private static final String JS_ON_PAUSE =
            "(function(){try{if(window.ArrowGO&&typeof window.ArrowGO.onPause==='function'){window.ArrowGO.onPause();}}catch(e){}})()";
    private static final String JS_ON_RESUME =
            "(function(){try{if(window.ArrowGO&&typeof window.ArrowGO.onResume==='function'){window.ArrowGO.onResume();}}catch(e){}})()";

    private static final Charset UTF_8 = Charset.forName("UTF-8");

    private final Handler uiHandler = new Handler(Looper.getMainLooper());

    private FrameLayout container;
    private WebView webView;
    private volatile String appVersion = FALLBACK_VERSION;

    /** True while a back press is waiting for window.ArrowGO.handleBack() to answer. */
    private boolean backPending;
    /** Set when the page did not answer a back press in time; the next press then closes. */
    private boolean backTimedOut;
    /** Identifies the current back press so a late answer to an older one is ignored. */
    private int backToken;
    private int rendererRestarts;
    private long firstRendererRestartAt;
    /** Between onStart and onStop (the activity is visible). */
    private boolean started;
    /** The renderer died while the activity was stopped; rebuild the WebView in onStart. */
    private boolean webViewRestartPending;
    private volatile boolean destroyed;

    // ------------------------------------------------------------------------------------------
    // Lifecycle
    // ------------------------------------------------------------------------------------------

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        appVersion = readVersionName();
        // Volume keys change the game's sound volume (on Android 7-8 they would otherwise change
        // the ringer volume whenever no sound happens to be playing).
        setVolumeControlStream(AudioManager.STREAM_MUSIC);

        container = new FrameLayout(this);
        container.setBackgroundColor(COLOR_CREAM);
        setContentView(container, new ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));

        // Same look as the theme until the page picks its own colours via setSystemBars().
        // (Also clears any translucent-bar flags and enables drawing the bar backgrounds.)
        applySystemBars(COLOR_CREAM, true);

        if ((getApplicationInfo().flags & ApplicationInfo.FLAG_DEBUGGABLE) != 0) {
            WebView.setWebContentsDebuggingEnabled(true);
        }

        webView = createWebView();
        if (webView == null) {
            showWebViewMissing();
            return;
        }
        container.addView(webView, new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        // Always a fresh load, also after the system recreated the activity: the game is a single
        // URL and keeps its own state in localStorage, so WebView.saveState()/restoreState() would
        // add nothing but risk (an oversized saved-state Bundle is a TransactionTooLargeException
        // crash on Android 7+, and restored history replays whatever the old page was showing).
        webView.loadUrl(START_URL);
    }

    @Override
    protected void onStart() {
        super.onStart();
        started = true;
        if (webViewRestartPending) {
            // The renderer was killed while we were in the background: rebuild now.
            webViewRestartPending = false;
            recreateWebView();
        }
    }

    @Override
    protected void onStop() {
        started = false;
        super.onStop();
    }

    @Override
    protected void onPause() {
        if (webView != null) {
            runPageScript(JS_ON_PAUSE);
            webView.onPause();
        }
        super.onPause();
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (webView != null) {
            webView.onResume();
            runPageScript(JS_ON_RESUME);
        }
    }

    @Override
    protected void onDestroy() {
        destroyed = true;
        uiHandler.removeCallbacksAndMessages(null);
        destroyWebView();
        super.onDestroy();
    }

    // ------------------------------------------------------------------------------------------
    // Back button: ask the page first (close a sheet / go back a screen), else close the app.
    // ------------------------------------------------------------------------------------------

    @SuppressWarnings("deprecation")
    @Override
    public void onBackPressed() {
        if (webView == null || backTimedOut) {
            // No page, or the page did not answer the previous press: never trap the user.
            finish();
            return;
        }
        if (backPending) {
            return; // Still waiting for the page's answer to the previous press.
        }
        backPending = true;
        final int token = ++backToken;
        uiHandler.postDelayed(new Runnable() {
            @Override
            public void run() {
                if (backPending && token == backToken) {
                    backPending = false;
                    backTimedOut = true;
                }
            }
        }, BACK_TIMEOUT_MS);
        webView.evaluateJavascript(JS_HANDLE_BACK, new ValueCallback<String>() {
            @Override
            public void onReceiveValue(String value) {
                backTimedOut = false;
                if (!backPending || token != backToken) {
                    return; // Answer to a press that already timed out.
                }
                backPending = false;
                if (!"true".equals(value) && !isFinishing()) {
                    finish();
                }
            }
        });
    }

    // ------------------------------------------------------------------------------------------
    // WebView setup
    // ------------------------------------------------------------------------------------------

    /** Returns a configured WebView, or null if Android System WebView cannot be used. */
    private WebView createWebView() {
        WebView wv = null;
        try {
            wv = new WebView(this);
            configureWebView(wv);
            return wv;
        } catch (RuntimeException | LinkageError e) {
            // Android System WebView missing, disabled or in the middle of an update
            // (AndroidRuntimeException, Resources.NotFoundException, UnsatisfiedLinkError...).
            Log.e(TAG, "Cannot create WebView", e);
            if (wv != null) {
                try {
                    wv.destroy();
                } catch (RuntimeException ignored) {
                    // Nothing more to clean up.
                }
            }
            return null;
        }
    }

    @SuppressLint({"SetJavaScriptEnabled", "AddJavascriptInterface"})
    @SuppressWarnings("deprecation")
    private void configureWebView(WebView wv) {
        wv.setBackgroundColor(COLOR_CREAM);
        wv.setOverScrollMode(View.OVER_SCROLL_NEVER);
        wv.setVerticalScrollBarEnabled(false);
        wv.setHorizontalScrollBarEnabled(false);
        // No long-press text selection, context menu or long-press haptic.
        wv.setLongClickable(false);
        wv.setHapticFeedbackEnabled(false);
        wv.setOnLongClickListener(new View.OnLongClickListener() {
            @Override
            public boolean onLongClick(View v) {
                return true;
            }
        });
        wv.setFocusable(true);
        wv.setFocusableInTouchMode(true);

        WebSettings s = wv.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(false);
        s.setAllowFileAccessFromFileURLs(false);
        s.setAllowUniversalAccessFromFileURLs(false);
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        s.setTextZoom(100);
        // The page has <meta name="viewport" content="width=device-width, ...">.
        s.setUseWideViewPort(true);
        s.setLoadWithOverviewMode(true);
        s.setSupportZoom(false);
        s.setBuiltInZoomControls(false);
        s.setDisplayZoomControls(false);
        s.setSupportMultipleWindows(false);
        s.setJavaScriptCanOpenWindowsAutomatically(false);
        s.setGeolocationEnabled(false);
        s.setDefaultTextEncodingName("utf-8");
        String ua = s.getUserAgentString();
        s.setUserAgentString((ua == null ? "" : ua + " ") + "ArrowGOApp/" + appVersion);
        // The game has its own light/dark themes: never let WebView darken it on its own.
        // (Purely cosmetic, so a WebView build that lacks these methods must not stop the app.)
        try {
            if (Build.VERSION.SDK_INT >= 33) {
                Api33.disableAlgorithmicDarkening(s);
            } else if (Build.VERSION.SDK_INT >= 29) {
                Api29.disableForceDark(s);
            }
        } catch (RuntimeException | LinkageError e) {
            Log.w(TAG, "Could not turn off WebView darkening", e);
        }

        wv.setWebViewClient(new ArrowWebViewClient());
        wv.setWebChromeClient(new ArrowChromeClient());
        wv.addJavascriptInterface(new AndroidBridge(), BRIDGE_NAME);
    }

    private void destroyWebView() {
        WebView wv = webView;
        webView = null;
        if (wv == null) {
            return;
        }
        try {
            ViewGroup parent = (ViewGroup) wv.getParent();
            if (parent != null) {
                parent.removeView(wv);
            }
            wv.stopLoading();
            wv.removeJavascriptInterface(BRIDGE_NAME);
            wv.setWebChromeClient(null);
            wv.setWebViewClient(new WebViewClient());
            wv.destroy();
        } catch (RuntimeException e) {
            Log.w(TAG, "Error while destroying WebView", e);
        }
    }

    /** After the renderer died the WebView must only be detached and destroyed, nothing else. */
    private static void discardDeadWebView(WebView wv) {
        try {
            ViewGroup parent = (ViewGroup) wv.getParent();
            if (parent != null) {
                parent.removeView(wv);
            }
            wv.destroy();
        } catch (RuntimeException e) {
            Log.w(TAG, "Error while destroying a dead WebView", e);
        }
    }

    private void showWebViewMissing() {
        TextView tv = new TextView(this);
        tv.setText("ArrowGO! needs Android System WebView.\nPlease install or enable it and try again.");
        tv.setTextColor(0xFF3B2A20);
        tv.setTextSize(18f);
        tv.setGravity(Gravity.CENTER);
        int pad = Math.round(24 * getResources().getDisplayMetrics().density);
        tv.setPadding(pad, pad, pad, pad);
        container.addView(tv, new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
    }

    private void runPageScript(String js) {
        if (webView == null) {
            return;
        }
        try {
            webView.evaluateJavascript(js, null);
        } catch (RuntimeException e) {
            Log.w(TAG, "evaluateJavascript failed", e);
        }
    }

    /** Called (API 26+) after the renderer crashed or was killed: rebuild instead of crashing. */
    void restartAfterRendererGone(WebView gone) {
        discardDeadWebView(gone);
        if (gone != webView) {
            return;
        }
        webView = null;
        backPending = false;
        backTimedOut = false;
        backToken++;
        if (destroyed || isFinishing()) {
            return;
        }
        uiHandler.post(new Runnable() {
            @Override
            public void run() {
                recreateWebView();
            }
        });
    }

    /**
     * Builds a new WebView after the old renderer died. While the activity is stopped this is
     * deferred to onStart(): the system usually kills a background renderer to reclaim memory,
     * and reloading the game there at once would only fight the low-memory killer (and run the
     * page without the onPause() it got before).
     */
    void recreateWebView() {
        if (destroyed || isFinishing() || webView != null) {
            return;
        }
        if (!started) {
            webViewRestartPending = true;
            return;
        }
        long now = SystemClock.elapsedRealtime();
        if (rendererRestarts == 0 || now - firstRendererRestartAt > RENDERER_RESTART_WINDOW_MS) {
            rendererRestarts = 0;
            firstRendererRestartAt = now;
        }
        if (++rendererRestarts > MAX_RENDERER_RESTARTS) {
            Log.e(TAG, "WebView renderer keeps dying; closing");
            finish();
            return;
        }
        webView = createWebView();
        if (webView == null) {
            showWebViewMissing();
            return;
        }
        container.addView(webView, new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        webView.loadUrl(START_URL);
    }

    // ------------------------------------------------------------------------------------------
    // Serving assets/www from https://appassets.androidplatform.net/
    // ------------------------------------------------------------------------------------------

    WebResourceResponse serveAsset(WebResourceRequest request) {
        Uri url = request.getUrl();
        if (url == null
                || !"https".equalsIgnoreCase(url.getScheme())
                || !ASSET_HOST.equalsIgnoreCase(url.getHost())) {
            return null; // Not ours: let WebView handle it (the game itself makes no such requests).
        }
        String method = request.getMethod();
        if (method != null && !"GET".equalsIgnoreCase(method) && !"HEAD".equalsIgnoreCase(method)) {
            return errorResponse(405, "Method Not Allowed");
        }
        String assetPath = resolveAssetPath(url.getPath());
        if (assetPath == null) {
            return errorResponse(404, "Not Found");
        }
        InputStream in;
        try {
            in = getAssets().open(assetPath, AssetManager.ACCESS_STREAMING);
        } catch (IOException e) {
            return errorResponse(404, "Not Found");
        } catch (RuntimeException e) {
            Log.w(TAG, "Asset open failed: " + assetPath, e);
            return errorResponse(404, "Not Found");
        }
        String mime = mimeTypeFor(assetPath);
        return new WebResourceResponse(mime, isTextMime(mime) ? "UTF-8" : null,
                200, "OK", responseHeaders(), in);
    }

    static WebResourceResponse errorResponse(int status, String reason) {
        byte[] body = (status + " " + reason).getBytes(UTF_8);
        return new WebResourceResponse("text/plain", "UTF-8", status, reason,
                responseHeaders(), new ByteArrayInputStream(body));
    }

    static Map<String, String> responseHeaders() {
        Map<String, String> h = new HashMap<String, String>();
        h.put("Cache-Control", "no-cache");
        h.put("Access-Control-Allow-Origin", "*");
        return h;
    }

    /**
     * Maps a (percent-decoded) URL path to an asset path under {@link #ASSET_ROOT}.
     * "" and "/" (and any path ending in "/") map to index.html. Returns null for paths that try
     * to leave the web root ("..") or contain characters that never appear in our file names.
     */
    static String resolveAssetPath(String urlPath) {
        String p = urlPath == null ? "" : urlPath;
        if (p.indexOf('\0') >= 0 || p.indexOf('\\') >= 0) {
            return null;
        }
        if (p.isEmpty() || p.endsWith("/")) {
            p = p + "index.html";
        }
        StringBuilder out = new StringBuilder(ASSET_ROOT);
        for (String segment : p.split("/")) {
            if (segment.isEmpty() || segment.equals(".")) {
                continue;
            }
            if (segment.equals("..")) {
                return null;
            }
            out.append('/').append(segment);
        }
        return out.length() == ASSET_ROOT.length() ? null : out.toString();
    }

    static String mimeTypeFor(String path) {
        String name = path == null ? "" : path;
        int slash = name.lastIndexOf('/');
        int dot = name.lastIndexOf('.');
        String ext = dot > slash ? name.substring(dot + 1).toLowerCase(Locale.ROOT) : "";
        switch (ext) {
            case "html":
            case "htm":
                return "text/html";
            case "css":
                return "text/css";
            case "js":
            case "mjs":
                return "text/javascript";
            case "json":
                return "application/json";
            case "webmanifest":
                return "application/manifest+json";
            case "svg":
                return "image/svg+xml";
            case "png":
                return "image/png";
            case "jpg":
            case "jpeg":
                return "image/jpeg";
            case "webp":
                return "image/webp";
            case "gif":
                return "image/gif";
            case "ico":
                return "image/x-icon";
            case "woff2":
                return "font/woff2";
            case "woff":
                return "font/woff";
            case "ttf":
                return "font/ttf";
            case "txt":
            case "md":
                return "text/plain";
            case "xml":
                return "application/xml";
            case "mp3":
                return "audio/mpeg";
            case "ogg":
                return "audio/ogg";
            case "wav":
                return "audio/wav";
            case "m4a":
                return "audio/mp4";
            case "wasm":
                return "application/wasm";
            default:
                return "application/octet-stream";
        }
    }

    static boolean isTextMime(String mime) {
        return mime.startsWith("text/")
                || mime.equals("application/json")
                || mime.equals("application/manifest+json")
                || mime.equals("application/xml")
                || mime.equals("image/svg+xml");
    }

    // ------------------------------------------------------------------------------------------
    // External links
    // ------------------------------------------------------------------------------------------

    boolean handleNavigation(WebView view, WebResourceRequest request) {
        Uri uri = request.getUrl();
        if (uri == null) {
            return true;
        }
        String scheme = uri.getScheme() == null ? "" : uri.getScheme().toLowerCase(Locale.ROOT);
        boolean web = scheme.equals("https") || scheme.equals("http");
        if (web && ASSET_HOST.equalsIgnoreCase(uri.getHost())) {
            if (scheme.equals("https")) {
                return false; // Our own pages: stay inside the WebView.
            }
            view.loadUrl(uri.buildUpon().scheme("https").build().toString());
            return true;
        }
        if (!request.isForMainFrame()) {
            // Sub-frames (if the page ever embeds one) may load web content, nothing else.
            return !(web || scheme.equals("about") || scheme.equals("data") || scheme.equals("blob"));
        }
        if (web || scheme.equals("mailto") || scheme.equals("tel") || scheme.equals("sms")
                || scheme.equals("market") || scheme.equals("geo")) {
            openExternal(uri, web);
        } else {
            Log.w(TAG, "Blocked navigation to " + scheme + ": URL");
        }
        return true;
    }

    private void openExternal(Uri uri, boolean browsable) {
        Intent intent = new Intent(Intent.ACTION_VIEW, uri);
        if (browsable) {
            intent.addCategory(Intent.CATEGORY_BROWSABLE);
        }
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        try {
            startActivity(intent);
        } catch (ActivityNotFoundException e) {
            Log.w(TAG, "No app can open " + uri);
        } catch (RuntimeException e) {
            Log.w(TAG, "Could not open " + uri, e);
        }
    }

    // ------------------------------------------------------------------------------------------
    // System bars
    // ------------------------------------------------------------------------------------------

    /**
     * Colours the status and navigation bars and picks dark ({@code darkIcons=true}, for light
     * colours) or light icons. Must run on the UI thread.
     */
    @SuppressWarnings("deprecation")
    void applySystemBars(int color, boolean darkIcons) {
        try {
            Window window = getWindow();
            int opaque = color | 0xFF000000;
            window.clearFlags(WindowManager.LayoutParams.FLAG_TRANSLUCENT_STATUS
                    | WindowManager.LayoutParams.FLAG_TRANSLUCENT_NAVIGATION);
            window.addFlags(WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS);
            window.setStatusBarColor(opaque);
            // Dark navigation-bar icons exist from API 26; before that keep icons readable.
            boolean lightNavSupported = Build.VERSION.SDK_INT >= 26;
            window.setNavigationBarColor(darkIcons && !lightNavSupported ? COLOR_LEGACY_NAV : opaque);

            // Legacy flags (still honoured, and AndroidX also sets them on API 30 for consistency).
            View decor = window.getDecorView();
            int flags = decor.getSystemUiVisibility();
            if (darkIcons) {
                flags |= View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR; // API 23 (minSdk is 24)
            } else {
                flags &= ~View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR;
            }
            if (lightNavSupported) {
                flags = Api26.lightNavigationFlag(flags, darkIcons);
            }
            decor.setSystemUiVisibility(flags);

            if (Build.VERSION.SDK_INT >= 30) {
                Api30.setLightBars(window, darkIcons);
            }
        } catch (RuntimeException e) {
            Log.w(TAG, "applySystemBars failed", e);
        }
    }

    /**
     * Parses a CSS colour from the page: #rgb, #rgba, #rrggbb, #rrggbbaa (CSS order, alpha last),
     * the same without '#', or rgb()/rgba() with 0-255 components. Returns 0xAARRGGBB or null.
     */
    static Integer parseCssColor(String input) {
        if (input == null) {
            return null;
        }
        String s = input.trim().toLowerCase(Locale.ROOT);
        if (s.isEmpty()) {
            return null;
        }
        if (s.startsWith("rgb")) {
            int open = s.indexOf('(');
            int close = s.lastIndexOf(')');
            if (open < 0 || close <= open) {
                return null;
            }
            String[] parts = s.substring(open + 1, close).trim().split("[\\s,/]+");
            if (parts.length < 3 || parts.length > 4) {
                return null;
            }
            int[] rgb = new int[3];
            for (int i = 0; i < 3; i++) {
                try {
                    double v = Double.parseDouble(parts[i]);
                    if (Double.isNaN(v)) {
                        return null;
                    }
                    rgb[i] = (int) Math.round(Math.max(0, Math.min(255, v)));
                } catch (NumberFormatException e) {
                    return null;
                }
            }
            return 0xFF000000 | (rgb[0] << 16) | (rgb[1] << 8) | rgb[2];
        }
        if (s.startsWith("#")) {
            s = s.substring(1);
        }
        for (int i = 0; i < s.length(); i++) {
            if (Character.digit(s.charAt(i), 16) < 0) {
                return null;
            }
        }
        int r;
        int g;
        int b;
        switch (s.length()) {
            case 3:
            case 4:
                r = Character.digit(s.charAt(0), 16) * 17;
                g = Character.digit(s.charAt(1), 16) * 17;
                b = Character.digit(s.charAt(2), 16) * 17;
                break;
            case 6:
            case 8:
                r = Integer.parseInt(s.substring(0, 2), 16);
                g = Integer.parseInt(s.substring(2, 4), 16);
                b = Integer.parseInt(s.substring(4, 6), 16);
                break;
            default:
                return null;
        }
        return 0xFF000000 | (r << 16) | (g << 8) | b;
    }

    /** True if dark icons read better on this colour (relative luminance above ~0.5). */
    static boolean isLightColor(int color) {
        double r = ((color >> 16) & 0xFF) / 255.0;
        double g = ((color >> 8) & 0xFF) / 255.0;
        double b = (color & 0xFF) / 255.0;
        return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.5;
    }

    static long clampVibrationMs(long ms) {
        return Math.max(VIBRATE_MIN_MS, Math.min(VIBRATE_MAX_MS, ms));
    }

    // ------------------------------------------------------------------------------------------
    // Misc
    // ------------------------------------------------------------------------------------------

    @SuppressWarnings("deprecation")
    private String readVersionName() {
        try {
            PackageManager pm = getPackageManager();
            PackageInfo info = Build.VERSION.SDK_INT >= 33
                    ? Api33.packageInfo(pm, getPackageName())
                    : pm.getPackageInfo(getPackageName(), 0);
            if (info != null && info.versionName != null && !info.versionName.isEmpty()) {
                return info.versionName;
            }
        } catch (Exception e) {
            Log.w(TAG, "Could not read versionName", e);
        }
        return FALLBACK_VERSION;
    }

    @SuppressWarnings("deprecation")
    void doVibrate(long ms) {
        try {
            long duration = clampVibrationMs(ms);
            Vibrator vibrator = Build.VERSION.SDK_INT >= 31
                    ? Api31.defaultVibrator(this)
                    : (Vibrator) getSystemService(Context.VIBRATOR_SERVICE);
            if (vibrator == null || !vibrator.hasVibrator()) {
                return;
            }
            if (Build.VERSION.SDK_INT >= 26) {
                Api26.vibrateOneShot(vibrator, duration);
            } else {
                vibrator.vibrate(duration);
            }
        } catch (Throwable t) {
            // Haptics are decoration: never let them crash the game.
            Log.w(TAG, "vibrate failed", t);
        }
    }

    // ------------------------------------------------------------------------------------------
    // window.AndroidBridge (docs/ARCHITECTURE.md). Called on WebView's JavaBridge thread.
    // ------------------------------------------------------------------------------------------

    public final class AndroidBridge {

        /** Haptic pulse of {@code ms} milliseconds, clamped to 1..1000. */
        @JavascriptInterface
        public void vibrate(long ms) {
            doVibrate(ms);
        }

        /** Convenience overload: AndroidBridge.vibrate() gives a short tick. */
        @JavascriptInterface
        public void vibrate() {
            doVibrate(DEFAULT_VIBRATE_MS);
        }

        /** Status + navigation bar colour (CSS hex) and icon style (true = dark icons). */
        @JavascriptInterface
        public void setSystemBars(String hex, final boolean darkIcons) {
            final Integer color = parseCssColor(hex);
            if (color == null) {
                Log.w(TAG, "setSystemBars: ignoring invalid colour " + hex);
                return;
            }
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    if (!destroyed && !isFinishing()) {
                        applySystemBars(color, darkIcons);
                    }
                }
            });
        }

        /** Convenience overload: icon style chosen from the colour's luminance. */
        @JavascriptInterface
        public void setSystemBars(String hex) {
            Integer color = parseCssColor(hex);
            if (color != null) {
                setSystemBars(hex, isLightColor(color));
            }
        }

        @JavascriptInterface
        public void exitApp() {
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    if (!isFinishing()) {
                        finish();
                    }
                }
            });
        }

        @JavascriptInterface
        public String getAppVersion() {
            return appVersion;
        }
    }

    // ------------------------------------------------------------------------------------------
    // Clients
    // ------------------------------------------------------------------------------------------

    private final class ArrowWebViewClient extends WebViewClient {

        @Override
        public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
            try {
                return serveAsset(request);
            } catch (RuntimeException e) {
                Log.e(TAG, "shouldInterceptRequest failed", e);
                return errorResponse(500, "Internal Error");
            }
        }

        @Override
        public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
            try {
                return handleNavigation(view, request);
            } catch (RuntimeException e) {
                Log.e(TAG, "shouldOverrideUrlLoading failed", e);
                return true;
            }
        }

        /** API 26+. Without this a renderer crash (or OOM kill) would take the app down. */
        @Override
        public boolean onRenderProcessGone(WebView view, RenderProcessGoneDetail detail) {
            boolean crashed = Build.VERSION.SDK_INT >= 26 && Api26.didCrash(detail);
            Log.e(TAG, "WebView renderer gone (crashed=" + crashed + "), reloading");
            restartAfterRendererGone(view);
            return true;
        }
    }

    private static final class ArrowChromeClient extends WebChromeClient {
        @Override
        public boolean onConsoleMessage(ConsoleMessage m) {
            if (m == null) {
                return true;
            }
            String text = m.message() + " (" + m.sourceId() + ":" + m.lineNumber() + ")";
            ConsoleMessage.MessageLevel level = m.messageLevel();
            if (level == ConsoleMessage.MessageLevel.ERROR) {
                Log.e(TAG, text);
            } else if (level == ConsoleMessage.MessageLevel.WARNING) {
                Log.w(TAG, text);
            } else if (level == ConsoleMessage.MessageLevel.DEBUG) {
                Log.d(TAG, text);
            } else if (level == ConsoleMessage.MessageLevel.TIP) {
                Log.v(TAG, text);
            } else {
                Log.i(TAG, text);
            }
            return true;
        }
    }

    // ------------------------------------------------------------------------------------------
    // API-level helpers: only ever called behind a Build.VERSION.SDK_INT check. Keeping each
    // newer API in its own class means older devices never load or verify those references.
    // ------------------------------------------------------------------------------------------

    @SuppressWarnings("deprecation")
    @TargetApi(26)
    private static final class Api26 {
        static void vibrateOneShot(Vibrator vibrator, long ms) {
            vibrator.vibrate(VibrationEffect.createOneShot(ms, VibrationEffect.DEFAULT_AMPLITUDE));
        }

        static int lightNavigationFlag(int flags, boolean darkIcons) {
            return darkIcons
                    ? flags | View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR
                    : flags & ~View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR;
        }

        static boolean didCrash(RenderProcessGoneDetail detail) {
            return detail != null && detail.didCrash();
        }
    }

    @TargetApi(29)
    private static final class Api29 {
        @SuppressWarnings("deprecation")
        static void disableForceDark(WebSettings settings) {
            settings.setForceDark(WebSettings.FORCE_DARK_OFF);
        }
    }

    @TargetApi(30)
    private static final class Api30 {
        static void setLightBars(Window window, boolean darkIcons) {
            WindowInsetsController controller = window.getInsetsController();
            if (controller == null) {
                return;
            }
            int mask = WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS
                    | WindowInsetsController.APPEARANCE_LIGHT_NAVIGATION_BARS;
            controller.setSystemBarsAppearance(darkIcons ? mask : 0, mask);
        }
    }

    @TargetApi(31)
    private static final class Api31 {
        static Vibrator defaultVibrator(Context context) {
            VibratorManager manager =
                    (VibratorManager) context.getSystemService(Context.VIBRATOR_MANAGER_SERVICE);
            return manager == null ? null : manager.getDefaultVibrator();
        }
    }

    @TargetApi(33)
    private static final class Api33 {
        static void disableAlgorithmicDarkening(WebSettings settings) {
            settings.setAlgorithmicDarkeningAllowed(false);
        }

        static PackageInfo packageInfo(PackageManager pm, String packageName)
                throws PackageManager.NameNotFoundException {
            return pm.getPackageInfo(packageName, PackageManager.PackageInfoFlags.of(0));
        }
    }
}

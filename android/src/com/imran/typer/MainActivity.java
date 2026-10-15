package com.imran.typer;

import android.app.Activity;
import android.content.ContentValues;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.os.StrictMode;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.print.PrintAttributes;
import android.print.PrintManager;
import android.provider.MediaStore;
import android.util.Base64;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;

/** Imran Typer: the typewriter page in a full-screen WebView, with saving, sharing and printing done by the phone. */
public class MainActivity extends Activity {
    private static final int PICK_FILE = 42;
    private WebView web;
    private ValueCallback<Uri[]> fileCallback;

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        // below Android 10 a shared picture is passed as a plain file
        StrictMode.setVmPolicy(new StrictMode.VmPolicy.Builder().build());
        web = new WebView(this);
        web.setBackgroundColor(Color.rgb(5, 109, 75));
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);   // the opening animation plays its typing sounds at once
        s.setAllowFileAccess(true);
        s.setAllowFileAccessFromFileURLs(true);
        s.setTextZoom(100);
        s.setUserAgentString(s.getUserAgentString() + " ImranTyper/1.0");
        web.addJavascriptInterface(new Bridge(), "ImranApp");
        web.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest req) {
                Uri u = req.getUrl();
                if ("file".equals(u.getScheme())) return false;
                try { startActivity(new Intent(Intent.ACTION_VIEW, u)); } catch (Exception e) { /* nothing to open it with */ }
                return true;
            }
        });
        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> cb, FileChooserParams params) {
                if (fileCallback != null) fileCallback.onReceiveValue(null);
                fileCallback = cb;
                Intent pick = new Intent(Intent.ACTION_GET_CONTENT);
                pick.addCategory(Intent.CATEGORY_OPENABLE);
                pick.setType("*/*");
                try { startActivityForResult(Intent.createChooser(pick, "Restore a backup"), PICK_FILE); }
                catch (Exception e) { fileCallback = null; return false; }
                return true;
            }
        });
        setContentView(web);
        if (state != null) web.restoreState(state);
        else web.loadUrl("file:///android_asset/index.html");
    }

    @Override
    protected void onActivityResult(int req, int res, Intent data) {
        if (req == PICK_FILE && fileCallback != null) {
            fileCallback.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(res, data));
            fileCallback = null;
            return;
        }
        super.onActivityResult(req, res, data);
    }

    @Override
    protected void onSaveInstanceState(Bundle out) {
        super.onSaveInstanceState(out);
        web.saveState(out);
    }

    @Override
    protected void onPause() { super.onPause(); web.onPause(); }

    @Override
    protected void onResume() { super.onResume(); web.onResume(); }

    @Override
    public void onBackPressed() {
        // the page closes its menus first; only when nothing is open does the app leave
        web.evaluateJavascript("(window.__appBack && window.__appBack()) ? 1 : 0", new ValueCallback<String>() {
            @Override public void onReceiveValue(String v) { if (!"1".equals(v)) finish(); }
        });
    }

    @Override
    protected void onDestroy() {
        if (web != null) { web.destroy(); web = null; }
        super.onDestroy();
    }

    /** Writes a file where the user can find it: Pictures/Imran Typer for images, Download/Imran Typer otherwise. */
    private Uri store(String name, String mime, byte[] data) throws Exception {
        boolean image = mime != null && mime.startsWith("image/");
        if (Build.VERSION.SDK_INT >= 29) {
            ContentValues v = new ContentValues();
            v.put(MediaStore.MediaColumns.DISPLAY_NAME, name);
            v.put(MediaStore.MediaColumns.MIME_TYPE, mime);
            v.put(MediaStore.MediaColumns.RELATIVE_PATH, (image ? Environment.DIRECTORY_PICTURES : Environment.DIRECTORY_DOWNLOADS) + "/Imran Typer");
            Uri coll = image ? MediaStore.Images.Media.EXTERNAL_CONTENT_URI : MediaStore.Downloads.EXTERNAL_CONTENT_URI;
            Uri uri = getContentResolver().insert(coll, v);
            if (uri == null) throw new Exception("no uri");
            try (OutputStream o = getContentResolver().openOutputStream(uri)) { o.write(data); }
            return uri;
        }
        File dir = new File(getExternalFilesDir(null), image ? "Pictures" : "Download");
        if (!dir.exists()) dir.mkdirs();
        File f = new File(dir, name);
        try (FileOutputStream o = new FileOutputStream(f)) { o.write(data); }
        return Uri.fromFile(f);
    }

    /** What the page can ask of the phone (window.ImranApp). */
    private class Bridge {
        @JavascriptInterface
        public String saveFile(String name, String mime, String b64) {
            try {
                store(name, mime, Base64.decode(b64, Base64.DEFAULT));
                boolean image = mime != null && mime.startsWith("image/");
                return Build.VERSION.SDK_INT >= 29 ? (image ? "Pictures/Imran Typer" : "Download/Imran Typer") : "the app's folder";
            } catch (Exception e) {
                return "";
            }
        }

        @JavascriptInterface
        public void shareText(final String text) {
            runOnUiThread(new Runnable() { @Override public void run() {
                Intent i = new Intent(Intent.ACTION_SEND);
                i.setType("text/plain");
                i.putExtra(Intent.EXTRA_TEXT, text);
                i.putExtra(Intent.EXTRA_SUBJECT, "Imran Typer");
                try { startActivity(Intent.createChooser(i, "Share text")); } catch (Exception e) { /* no app to share with */ }
            } });
        }

        @JavascriptInterface
        public void shareFile(String name, final String mime, String b64) {
            try {
                final Uri uri = store(name, mime, Base64.decode(b64, Base64.DEFAULT));
                runOnUiThread(new Runnable() { @Override public void run() {
                    Intent i = new Intent(Intent.ACTION_SEND);
                    i.setType(mime);
                    i.putExtra(Intent.EXTRA_STREAM, uri);
                    i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                    try { startActivity(Intent.createChooser(i, "Share picture")); } catch (Exception e) { /* no app to share with */ }
                } });
            } catch (Exception e) { /* could not write the picture */ }
        }

        /** A short buzz (the opening film's key strikes and carriage stops: the page has no touch yet to vibrate with). */
        @JavascriptInterface
        public void buzz(int ms, int amplitude) {
            try {
                Vibrator v = (Vibrator) getSystemService(VIBRATOR_SERVICE);
                if (v == null || !v.hasVibrator()) return;
                if (Build.VERSION.SDK_INT >= 26) v.vibrate(VibrationEffect.createOneShot(Math.max(1, ms), Math.max(1, Math.min(255, amplitude))));
                else v.vibrate(Math.max(1, ms));
            } catch (Exception e) { /* no vibrator */ }
        }

        @JavascriptInterface
        public void print(final String jobName) {
            runOnUiThread(new Runnable() { @Override public void run() {
                PrintManager pm = (PrintManager) getSystemService(PRINT_SERVICE);
                if (pm != null && web != null) pm.print(jobName, web.createPrintDocumentAdapter(jobName), new PrintAttributes.Builder().build());
            } });
        }
    }
}

package com.imran.bio

import android.annotation.SuppressLint
import android.content.ActivityNotFoundException
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.ApplicationInfo
import android.content.res.AssetManager
import android.graphics.Bitmap
import android.graphics.Color
import android.media.AudioManager
import android.os.BatteryManager
import android.os.Build
import android.net.Uri
import android.os.Bundle
import android.os.SystemClock
import android.view.HapticFeedbackConstants
import android.view.KeyEvent
import android.view.View
import android.view.ViewGroup
import android.view.WindowManager
import android.webkit.JavascriptInterface
import android.webkit.RenderProcessGoneDetail
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.FrameLayout
import androidx.activity.ComponentActivity
import androidx.activity.SystemBarStyle
import androidx.activity.addCallback
import androidx.activity.enableEdgeToEdge
import androidx.core.content.ContextCompat
import androidx.core.content.edit
import androidx.core.graphics.createBitmap
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import androidx.webkit.WebViewAssetLoader
import org.json.JSONObject
import java.io.ByteArrayInputStream
import java.io.IOException
import kotlin.math.roundToInt

/**
 * Full-screen WebView that shows the website (index.html + assets, copied from ../website).
 *
 * The page opens from https://appassets.androidplatform.net/assets/index.html: a made-up secure address that never
 * goes to the internet - every file comes from inside the app. Unlike file://, a real address lets Web Audio read
 * the music (the player's equalizer and everything in it that moves with the sound).
 */
class MainActivity : ComponentActivity() {

    private companion object {
        const val HOST = "appassets.androidplatform.net"
        const val PAGE_URL = "https://$HOST/assets/index.html"

        /** Opened once after updating from 1.5 or older: brings the saved settings over from file:// (see move.html). */
        const val MOVE_URL = "file:///android_asset/move.html"
        const val MOVED = "moved_to_https"

        /** Songs and videos: served in pieces (see [media]). */
        val MEDIA_TYPES = mapOf(
            "mp3" to "audio/mpeg", "m4a" to "audio/mp4", "aac" to "audio/aac", "ogg" to "audio/ogg",
            "wav" to "audio/wav", "mp4" to "video/mp4", "webm" to "video/webm",
        )
    }

    private lateinit var webView: WebView
    private val audio by lazy { getSystemService(Context.AUDIO_SERVICE) as AudioManager }
    private val prefs by lazy { getSharedPreferences("app", MODE_PRIVATE) }

    /** https://appassets.androidplatform.net/assets/... -> the files in the app's assets folder. */
    private val assetLoader by lazy {
        WebViewAssetLoader.Builder()
            .setDomain(HOST)
            .addPathHandler("/assets/", WebViewAssetLoader.AssetsPathHandler(this))
            .build()
    }

    /** CDN address -> copy inside assets/offline, so the fonts and icons also work without internet. */
    private val offlineFiles: Map<String, String> by lazy {
        try {
            val json = JSONObject(assets.open("offline/map.json").bufferedReader().use { it.readText() })
            json.keys().asSequence().associateWith { json.getString(it) }
        } catch (e: Exception) {
            emptyMap()
        }
    }

    /** Until when a volume change is our own (a volume button or a slider in the page), so the page already knows. */
    @Volatile
    private var ownVolumeUntil = 0L

    /** Last known: is a charger plugged in (null = not known yet), and the battery level (0..1). */
    private var plugged: Boolean? = null
    private var batteryLevel = -1f

    /**
     * The battery: plugging a charger in (also while the app was in the background) plays the page's charging animation;
     * unplugging closes it; the level keeps its percentage up to date.
     */
    private val batteryWatch = object : BroadcastReceiver() {
        override fun onReceive(context: Context, intent: Intent) {
            val level = intent.getIntExtra(BatteryManager.EXTRA_LEVEL, -1)
            val scale = intent.getIntExtra(BatteryManager.EXTRA_SCALE, 100)
            val now = intent.getIntExtra(BatteryManager.EXTRA_PLUGGED, 0) != 0
            val oldLevel = batteryLevel
            if (level >= 0 && scale > 0) batteryLevel = level.toFloat() / scale
            val was = plugged
            plugged = now
            if (!::webView.isInitialized) return
            if (was != null && was != now) {
                webView.evaluateJavascript("window.appCharging && window.appCharging($now, $batteryLevel)", null)
            } else if (batteryLevel >= 0 && batteryLevel != oldLevel) { // (this broadcast also comes for temperature etc.)
                webView.evaluateJavascript("window.appBattery && window.appBattery($batteryLevel, $now)", null)
            }
        }
    }

    /** The volume changed some other way (headphone buttons, the phone's quick settings): the page's sliders follow. */
    private val volumeWatch = object : BroadcastReceiver() {
        override fun onReceive(context: Context, intent: Intent) {
            if (intent.getIntExtra("android.media.EXTRA_VOLUME_STREAM_TYPE", -1) != AudioManager.STREAM_MUSIC) return
            if (SystemClock.uptimeMillis() < ownVolumeUntil) return
            tellVolume(false)
        }
    }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        // draw behind the system bars (and the camera notch), then hide the status bar
        enableEdgeToEdge(
            statusBarStyle = SystemBarStyle.dark(Color.TRANSPARENT),
            navigationBarStyle = SystemBarStyle.dark(Color.BLACK),
        )
        hideStatusBar()
        volumeControlStream = AudioManager.STREAM_MUSIC // volume buttons change the music volume
        // the page is a video + music player: don't let the screen switch off (and the music stop) while you watch it
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)

        if (applicationInfo.flags and ApplicationInfo.FLAG_DEBUGGABLE != 0) {
            WebView.setWebContentsDebuggingEnabled(true)
        }

        val root = FrameLayout(this).apply { setBackgroundColor(Color.BLACK) }
        setContentView(root)
        // keep the page above the 3-button navigation bar (with gesture navigation it fills the whole screen),
        // and hand the page only the insets that are left: the navigation bar is already out of its way, so the page
        // must not add that space again (it did: env(safe-area-inset-bottom) lifted the bottom bar a whole bar-height)
        ViewCompat.setOnApplyWindowInsetsListener(root) { view, insets ->
            val bars = insets.getInsets(WindowInsetsCompat.Type.tappableElement())
            view.setPadding(bars.left, 0, bars.right, bars.bottom)
            insets.inset(bars.left, 0, bars.right, bars.bottom)
        }
        createWebView(root)

        // back button: the page goes back first (closes the music player or a pop-up, leaves a screen, returns to
        // Home); only when it is already on Home (or does not answer) does the app close
        onBackPressedDispatcher.addCallback(this) {
            var answered = false
            val noAnswer = Runnable { if (!answered) { answered = true; finish() } }
            webView.postDelayed(noAnswer, 700)
            webView.evaluateJavascript("(window.appBack ? window.appBack() : false)") { result ->
                webView.removeCallbacks(noAnswer)
                if (!answered) {
                    answered = true
                    if (result != "true") finish()
                }
            }
        }
    }

    @SuppressLint("SetJavaScriptEnabled", "JavascriptInterface")
    private fun createWebView(root: FrameLayout) {
        webView = WebView(this).apply {
            setBackgroundColor(Color.BLACK)
            overScrollMode = View.OVER_SCROLL_NEVER
            isVerticalScrollBarEnabled = false
            isHorizontalScrollBarEnabled = false
            isLongClickable = false
            setOnLongClickListener { true } // no text-selection popup on long press

            settings.apply {
                javaScriptEnabled = true
                domStorageEnabled = true // localStorage: views counter, likes, settings, slider positions
                mediaPlaybackRequiresUserGesture = false
                useWideViewPort = true
                loadWithOverviewMode = true
                textZoom = 100 // ignore the phone's font-size setting so the layout stays as designed
                setSupportZoom(false)
                builtInZoomControls = false
                displayZoomControls = false
            }

            addJavascriptInterface(AudioBridge(), "AndroidAudio")
            addJavascriptInterface(HapticsBridge(), "AndroidHaptics")
            webViewClient = PageClient()
            webChromeClient = object : WebChromeClient() {
                // hides the grey "play" placeholder Android draws on videos before they start
                override fun getDefaultVideoPoster(): Bitmap = createBitmap(1, 1)
            }
        }
        root.addView(
            webView,
            FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT),
        )
        // the first time after the update, bring the saved settings over first (move.html then opens the page)
        webView.loadUrl(if (prefs.getBoolean(MOVED, false)) PAGE_URL else MOVE_URL)
    }

    private fun hideStatusBar() {
        WindowInsetsControllerCompat(window, window.decorView).apply {
            hide(WindowInsetsCompat.Type.statusBars())
            systemBarsBehavior = WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
        }
    }

    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
        if (hasFocus) hideStatusBar()
    }

    // pause the music/videos while the app is in the background, continue when you come back
    override fun onPause() {
        for (watch in listOf(volumeWatch, batteryWatch)) {
            try {
                unregisterReceiver(watch)
            } catch (ignored: IllegalArgumentException) {
            }
        }
        webView.evaluateJavascript("window.appPaused && window.appPaused()", null)
        webView.onPause()
        super.onPause()
    }

    override fun onResume() {
        super.onResume()
        webView.onResume()
        webView.evaluateJavascript("window.appResumed && window.appResumed()", null)
        ContextCompat.registerReceiver(
            this, volumeWatch, IntentFilter("android.media.VOLUME_CHANGED_ACTION"), ContextCompat.RECEIVER_NOT_EXPORTED,
        )
        // the battery's current state arrives straight away (a charger plugged in while away also plays the animation)
        ContextCompat.registerReceiver(
            this, batteryWatch, IntentFilter(Intent.ACTION_BATTERY_CHANGED), ContextCompat.RECEIVER_NOT_EXPORTED,
        )
    }

    override fun onDestroy() {
        (webView.parent as? ViewGroup)?.removeView(webView)
        webView.destroy()
        super.onDestroy()
    }

    // the volume buttons change the music volume quietly (no phone volume pop-up over the app):
    // the page shows its own red volume panel instead
    @SuppressLint("RestrictedApi") // overriding Activity.dispatchKeyEvent is normal; lint mistakes it for androidx-internal use
    override fun dispatchKeyEvent(event: KeyEvent): Boolean {
        val direction = when (event.keyCode) {
            KeyEvent.KEYCODE_VOLUME_UP -> AudioManager.ADJUST_RAISE
            KeyEvent.KEYCODE_VOLUME_DOWN -> AudioManager.ADJUST_LOWER
            else -> return super.dispatchKeyEvent(event)
        }
        if (event.action == KeyEvent.ACTION_DOWN) {
            ownVolumeUntil = SystemClock.uptimeMillis() + 500
            audio.adjustStreamVolume(AudioManager.STREAM_MUSIC, direction, 0)
            tellVolume(true)
        }
        return true
    }

    /** The phone's music volume, 0..1. */
    private fun musicVolume(): Float {
        val max = audio.getStreamMaxVolume(AudioManager.STREAM_MUSIC)
        return if (max > 0) audio.getStreamVolume(AudioManager.STREAM_MUSIC).toFloat() / max else 0f
    }

    /** Tells the page the phone's music volume ([fromKey]: after a volume button, so it shows its volume panel). */
    private fun tellVolume(fromKey: Boolean) {
        if (!::webView.isInitialized) return
        webView.evaluateJavascript("window.appVolume && window.appVolume(${musicVolume()}, $fromKey)", null)
    }

    /** window.AndroidHaptics in the page: a short buzz from the phone (the game uses it; follows the phone's touch-feedback setting). */
    private inner class HapticsBridge {
        @JavascriptInterface
        fun buzz(kind: String?) {
            if (!::webView.isInitialized) return
            val effect = when (kind) {
                "win" -> if (Build.VERSION.SDK_INT >= 30) HapticFeedbackConstants.CONFIRM else HapticFeedbackConstants.LONG_PRESS
                "lose" -> if (Build.VERSION.SDK_INT >= 30) HapticFeedbackConstants.REJECT else HapticFeedbackConstants.LONG_PRESS
                "soft" -> HapticFeedbackConstants.CLOCK_TICK
                else -> HapticFeedbackConstants.KEYBOARD_TAP
            }
            webView.post { webView.performHapticFeedback(effect) }
        }
    }

    /** window.AndroidAudio in the page: its volume sliders are the phone's music volume, so they always agree. */
    private inner class AudioBridge {
        @JavascriptInterface
        fun getVolume(): Float = musicVolume()

        @JavascriptInterface
        fun setVolume(level: Float) {
            if (level.isNaN()) return
            val f = level.coerceIn(0f, 1f)
            val max = audio.getStreamMaxVolume(AudioManager.STREAM_MUSIC)
            val index = (f * max).roundToInt().let { if (it == 0 && f > 0f) 1 else it }
            ownVolumeUntil = SystemClock.uptimeMillis() + 500
            try {
                audio.setStreamVolume(AudioManager.STREAM_MUSIC, index, 0)
            } catch (ignored: SecurityException) {
            }
        }
    }

    /**
     * Songs and videos, with "Range" support: the player asks for pieces of a file (to start quickly, and to jump to
     * any point in a song), which the standard asset handler can't answer - it always sends the whole file.
     * Every request gets its own stream, so a song and the videos can load at the same time.
     */
    private fun media(url: Uri, request: WebResourceRequest): WebResourceResponse? {
        val path = url.path ?: return null
        if (url.scheme != "https" || !path.startsWith("/assets/")) return null
        val type = MEDIA_TYPES[path.substringAfterLast('.', "").lowercase()] ?: return null
        val input = try {
            assets.open(path.removePrefix("/assets/"), AssetManager.ACCESS_RANDOM)
        } catch (e: IOException) {
            return null
        }
        val total = input.available().toLong() // the whole file (a fresh asset stream knows its exact size)
        val headers = mutableMapOf("Accept-Ranges" to "bytes")
        val range = request.requestHeaders.entries.firstOrNull { it.key.equals("Range", ignoreCase = true) }?.value
        if (range == null) {
            headers["Content-Length"] = total.toString()
            return WebResourceResponse(type, null, 200, "OK", headers, input)
        }
        val piece = parseByteRange(range, total)
        if (piece == null) {
            input.close()
            headers["Content-Range"] = "bytes */$total"
            return WebResourceResponse(type, null, 416, "Range Not Satisfiable", headers, ByteArrayInputStream(ByteArray(0)))
        }
        input.skipFully(piece.first)
        val length = piece.last - piece.first + 1
        headers["Content-Range"] = "bytes ${piece.first}-${piece.last}/$total"
        headers["Content-Length"] = length.toString()
        return WebResourceResponse(type, null, 206, "Partial Content", headers, LimitedStream(input, length))
    }

    /** Opens social links in their app (Discord, YouTube, TikTok...) or the browser. */
    private fun openOutside(uri: Uri) {
        val intent = if (uri.scheme == "intent") {
            try {
                Intent.parseUri(uri.toString(), Intent.URI_INTENT_SCHEME).apply {
                    addCategory(Intent.CATEGORY_BROWSABLE)
                    component = null
                    selector = null
                }
            } catch (e: Exception) {
                return
            }
        } else {
            Intent(Intent.ACTION_VIEW, uri)
        }
        try {
            startActivity(intent)
        } catch (e: ActivityNotFoundException) {
            val fallback = intent.getStringExtra("browser_fallback_url") ?: return
            try {
                startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(fallback)))
            } catch (ignored: ActivityNotFoundException) {
            }
        }
    }

    private inner class PageClient : WebViewClient() {

        override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
            val url = request.url
            if (url.host == HOST || url.scheme == "file") return false // our own page (and the one-time move page)
            openOutside(url)
            return true
        }

        override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest): WebResourceResponse? {
            val url = request.url
            // the page and its files, from inside the app
            if (url.host == HOST) return media(url, request) ?: assetLoader.shouldInterceptRequest(url)
            // Google Fonts + Font Awesome from the app itself too (works offline, loads faster)
            val asset = offlineFiles[url.toString()] ?: return null
            val css = asset.endsWith(".css")
            return try {
                WebResourceResponse(
                    if (css) "text/css" else "font/woff2",
                    if (css) "utf-8" else null,
                    200,
                    "OK",
                    mapOf("Access-Control-Allow-Origin" to "*", "Cache-Control" to "max-age=31536000"),
                    assets.open(asset),
                )
            } catch (e: IOException) {
                null
            }
        }

        override fun onPageFinished(view: WebView, url: String) {
            // the page has opened from its new address and kept the saved settings (move.html): no need to move again
            if (url.startsWith(PAGE_URL) && !prefs.getBoolean(MOVED, false)) prefs.edit { putBoolean(MOVED, true) }
        }

        // if Android kills the page in the background, start it again instead of crashing
        override fun onRenderProcessGone(view: WebView, detail: RenderProcessGoneDetail): Boolean {
            if (view !== webView) return true
            val root = view.parent as? FrameLayout ?: return false
            root.removeView(view)
            view.destroy()
            createWebView(root)
            return true
        }
    }
}

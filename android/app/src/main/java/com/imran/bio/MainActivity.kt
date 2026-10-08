package com.imran.bio

import android.annotation.SuppressLint
import android.content.ActivityNotFoundException
import android.content.Intent
import android.content.pm.ApplicationInfo
import android.graphics.Bitmap
import android.graphics.Color
import android.media.AudioManager
import android.net.Uri
import android.os.Bundle
import android.view.View
import android.view.ViewGroup
import android.view.WindowManager
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
import androidx.core.graphics.createBitmap
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import org.json.JSONObject
import java.io.IOException

/**
 * Full-screen WebView that shows assets/index.html (the website, copied from ../website).
 */
class MainActivity : ComponentActivity() {

    private lateinit var webView: WebView

    /** CDN address -> copy inside assets/offline, so the fonts and icons also work without internet. */
    private val offlineFiles: Map<String, String> by lazy {
        try {
            val json = JSONObject(assets.open("offline/map.json").bufferedReader().use { it.readText() })
            json.keys().asSequence().associateWith { json.getString(it) }
        } catch (e: Exception) {
            emptyMap()
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

        // back button: the page goes back first (closes a pop-up, leaves a screen, returns to Home);
        // only when it is already on Home (or does not answer) does the app close
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

    @SuppressLint("SetJavaScriptEnabled")
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
                domStorageEnabled = true // localStorage: views counter + slider positions
                mediaPlaybackRequiresUserGesture = false
                useWideViewPort = true
                loadWithOverviewMode = true
                textZoom = 100 // ignore the phone's font-size setting so the layout stays as designed
                setSupportZoom(false)
                builtInZoomControls = false
                displayZoomControls = false
            }

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
        webView.loadUrl("file:///android_asset/index.html")
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
        webView.evaluateJavascript("window.appPaused && window.appPaused()", null)
        webView.onPause()
        super.onPause()
    }

    override fun onResume() {
        super.onResume()
        webView.onResume()
        webView.evaluateJavascript("window.appResumed && window.appResumed()", null)
    }

    override fun onDestroy() {
        (webView.parent as? ViewGroup)?.removeView(webView)
        webView.destroy()
        super.onDestroy()
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
            if (request.url.scheme == "file") return false // our own page
            openOutside(request.url)
            return true
        }

        // serve Google Fonts + Font Awesome from the app itself (works offline, loads faster)
        override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest): WebResourceResponse? {
            val asset = offlineFiles[request.url.toString()] ?: return null
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

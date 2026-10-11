package com.weplay.guesserai.service

import android.app.Activity
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.content.res.Configuration
import android.media.projection.MediaProjectionManager
import android.os.PowerManager
import android.widget.Toast
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.ui.unit.dp
import androidx.core.app.NotificationCompat
import androidx.core.app.ServiceCompat
import androidx.core.content.IntentCompat
import androidx.lifecycle.LifecycleService
import androidx.lifecycle.lifecycleScope
import com.weplay.guesserai.R
import com.weplay.guesserai.WePlayGuesserApp
import com.weplay.guesserai.domain.RankedGuess
import com.weplay.guesserai.overlay.OverlayActions
import com.weplay.guesserai.overlay.OverlayRoot
import com.weplay.guesserai.overlay.OverlayWindow
import com.weplay.guesserai.ui.MainActivity
import kotlinx.coroutines.launch

/**
 * Foreground service (type mediaProjection) that owns the screen capture, the analysis loop and
 * the floating overlay. Runs only while the user has the assistant switched on.
 */
class AssistantService : LifecycleService() {

    private val container by lazy { (application as WePlayGuesserApp).container }
    private var capturer: ScreenCapturer? = null
    private var session: AssistantSession? = null
    private var overlay: OverlayWindow? = null
    private val minimized = mutableStateOf(false)

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        super.onStartCommand(intent, flags, startId)
        when (intent?.action) {
            ACTION_STOP -> { stopSelf(); return START_NOT_STICKY }
            ACTION_START -> {
                if (session != null) return START_NOT_STICKY
                val code = intent.getIntExtra(EXTRA_RESULT_CODE, Activity.RESULT_CANCELED)
                val data = IntentCompat.getParcelableExtra(intent, EXTRA_RESULT_DATA, Intent::class.java)
                if (code != Activity.RESULT_OK || data == null) { stopSelf(); return START_NOT_STICKY }
                // Must be in the foreground with the mediaProjection type *before* getMediaProjection().
                ServiceCompat.startForeground(this, NOTIF_ID, buildNotification(), ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PROJECTION)
                runCatching { begin(code, data) }.onFailure {
                    Toast.makeText(this, "Could not start screen capture: ${it.message}", Toast.LENGTH_LONG).show()
                    stopSelf()
                }
            }
        }
        // A projection token cannot be reused, so never restart automatically.
        return START_NOT_STICKY
    }

    private fun begin(code: Int, data: Intent) {
        val mpm = getSystemService(MediaProjectionManager::class.java)
        val projection = mpm.getMediaProjection(code, data) ?: error("permission was not granted")

        val window = OverlayWindow(this)
        val (sw, sh) = window.screenSize()
        val cap = ScreenCapturer(projection) { lifecycleScope.launch { stopSelf() } }
        cap.start(sw, sh, resources.displayMetrics.densityDpi)

        val power = getSystemService(PowerManager::class.java)
        val s = AssistantSession(
            scope = lifecycleScope,
            capturer = cap,
            analyzer = container.visionAnalyzer,
            history = container.history,
            settingsRepo = container.settings,
            wordBanks = container.wordBank,
            gameMonitor = GameAppMonitor(this),
            isScreenOn = { power.isInteractive },
            overlayRect = { window.bounds() },
        )

        val screenDp = sw / resources.displayMetrics.density
        // Compact: about a quarter of the screen, so the chat box stays free for pasting.
        val compactWidth = (screenDp * 0.27f).coerceIn(112f, 150f).dp
        val normalWidth = (screenDp * 0.32f).coerceIn(140f, 220f).dp

        window.show {
            val state by s.state.collectAsState()
            val settings by container.settings.settings.collectAsState()
            OverlayRoot(
                state = state,
                minimized = minimized.value,
                compact = settings.compactOverlay,
                width = if (settings.compactOverlay) compactWidth else normalWidth,
                actions = actionsFor(s, window),
            )
        }

        lifecycleScope.launch {
            s.state.collect { st ->
                st.toast?.let { Toast.makeText(this@AssistantService, it, Toast.LENGTH_SHORT).show(); s.consumeToast() }
            }
        }

        capturer = cap
        session = s
        overlay = window
        container.assistantRunning.value = true
        s.start()
    }

    private fun actionsFor(s: AssistantSession, window: OverlayWindow) = object : OverlayActions {
        override fun onMinimize() { minimized.value = true; window.snapToEdge = true; window.settle() }
        override fun onExpand() { minimized.value = false; window.snapToEdge = false; window.settle() }
        override fun onClose() { stopSelf() }
        override fun onNextGuess() { s.nextGuess()?.let { copy(it) } }
        override fun onRefresh() = s.refresh()
        override fun onTogglePause() = s.togglePause()
        override fun onCopy(guess: RankedGuess) { copy(guess.answer); s.markCopied(guess.answer) }
        override fun onMarkCorrect(guess: RankedGuess) = s.markCorrect(guess)
        override fun onAdjustHint(dWords: Int, dLetters: Int) = s.adjustHint(dWords, dLetters)
        override fun onAutoHint() = s.clearManualHint()
    }

    /** No toast: it would cover the chat box the answer is pasted into. The overlay shows a ✓ instead. */
    private fun copy(text: String) {
        getSystemService(ClipboardManager::class.java).setPrimaryClip(ClipData.newPlainText("guess", text))
    }

    override fun onConfigurationChanged(newConfig: Configuration) {
        super.onConfigurationChanged(newConfig)
        val window = overlay ?: return
        val (sw, sh) = window.screenSize()
        capturer?.resize(sw, sh, resources.displayMetrics.densityDpi)
        session?.onScreenChanged()
        window.settle()
    }

    override fun onDestroy() {
        session?.stop()
        overlay?.hide()
        capturer?.release()
        session = null; overlay = null; capturer = null
        container.assistantRunning.value = false
        super.onDestroy()
    }

    private fun buildNotification(): Notification {
        val nm = getSystemService(NotificationManager::class.java)
        nm.createNotificationChannel(
            NotificationChannel(CHANNEL, getString(R.string.notif_channel), NotificationManager.IMPORTANCE_LOW)
        )
        val open = PendingIntent.getActivity(
            this, 0, Intent(this, MainActivity::class.java), PendingIntent.FLAG_IMMUTABLE,
        )
        val stop = PendingIntent.getService(
            this, 1, Intent(this, AssistantService::class.java).setAction(ACTION_STOP), PendingIntent.FLAG_IMMUTABLE,
        )
        return NotificationCompat.Builder(this, CHANNEL)
            .setSmallIcon(R.drawable.ic_stat_ai)
            .setContentTitle(getString(R.string.notif_title))
            .setContentText(getString(R.string.notif_text))
            .setContentIntent(open)
            .addAction(0, getString(R.string.notif_stop), stop)
            .setOngoing(true)
            .setColor(0xFFA855F7.toInt())
            .build()
    }

    companion object {
        private const val CHANNEL = "overlay"
        private const val NOTIF_ID = 42
        const val ACTION_START = "com.weplay.guesserai.START"
        const val ACTION_STOP = "com.weplay.guesserai.STOP"
        const val EXTRA_RESULT_CODE = "result_code"
        const val EXTRA_RESULT_DATA = "result_data"

        fun start(context: Context, resultCode: Int, data: Intent) {
            context.startForegroundService(
                Intent(context, AssistantService::class.java)
                    .setAction(ACTION_START)
                    .putExtra(EXTRA_RESULT_CODE, resultCode)
                    .putExtra(EXTRA_RESULT_DATA, data)
            )
        }

        fun stop(context: Context) {
            context.startService(Intent(context, AssistantService::class.java).setAction(ACTION_STOP))
        }
    }
}

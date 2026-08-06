package com.alarmhandler.app.alarm

import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.os.PowerManager
import android.util.Log
import androidx.core.net.toUri
import com.alarmhandler.app.data.ServiceLocator
import com.alarmhandler.app.data.db.HistoryAction
import com.alarmhandler.app.data.model.Alarm
import com.alarmhandler.app.ui.ring.AlarmRingActivity
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch
import kotlinx.serialization.json.Json

/**
 * Keeps a ringing alarm alive.
 *
 * A foreground service is used only while an alarm actually rings -- scheduling
 * itself needs no service at all. It exists so audio, vibration and the wake
 * lock survive the screen being off and the app being swiped away.
 */
class AlarmService : Service() {

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)
    private val handler = Handler(Looper.getMainLooper())
    private val json = Json { ignoreUnknownKeys = true }

    private lateinit var player: AlarmPlayer
    private lateinit var notifications: NotificationHelper

    private var wakeLock: PowerManager.WakeLock? = null
    private var current: Alarm? = null
    private var scheduledFor: Long = 0L

    private val volumeTicker = object : Runnable {
        override fun run() {
            player.tick()
            handler.postDelayed(this, VOLUME_TICK_MS)
        }
    }

    private val autoSilence = Runnable { finishRinging(Outcome.MISSED) }

    override fun onCreate() {
        super.onCreate()
        ServiceLocator.init(applicationContext)
        player = AlarmPlayer(this)
        notifications = NotificationHelper(this)
        notifications.ensureChannels()
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            AlarmIntents.ACTION_FIRE -> handleFire(intent)
            AlarmIntents.ACTION_SNOOZE -> finishRinging(Outcome.SNOOZED)
            AlarmIntents.ACTION_DISMISS -> finishRinging(Outcome.DISMISSED)
            AlarmIntents.ACTION_AUTO_SILENCE -> finishRinging(Outcome.MISSED)
            else -> {
                // Restarted by the system with no intent and nothing ringing.
                if (current == null) stopSelf()
            }
        }
        return START_NOT_STICKY
    }

    private fun handleFire(intent: Intent) {
        val alarm = intent.getStringExtra(AlarmIntents.EXTRA_ALARM_JSON)
            ?.let { runCatching { json.decodeFromString(Alarm.serializer(), it) }.getOrNull() }
        if (alarm == null) {
            Log.e(TAG, "Fire intent carried no alarm; nothing to ring")
            if (current == null) stopSelf()
            return
        }
        val fromSnooze = intent.getBooleanExtra(AlarmIntents.EXTRA_FROM_SNOOZE, false)

        // Promote to the foreground before anything slow happens: Android gives
        // a newly started foreground service only a few seconds to post its
        // notification.
        startForegroundCompat(alarm)

        // A second alarm arriving while one already rings replaces it; the
        // first is recorded as missed so history stays honest.
        current?.let { previous ->
            if (previous.id != alarm.id) {
                recordHistory(previous, HistoryAction.MISSED)
            }
        }

        current = alarm
        scheduledFor = System.currentTimeMillis()
        acquireWakeLock()

        player.start(alarm)
        handler.removeCallbacks(volumeTicker)
        handler.postDelayed(volumeTicker, VOLUME_TICK_MS)

        RingingState.start(alarm, fromSnooze)
        recordHistory(alarm, HistoryAction.RANG)
        scheduleAutoSilence()
        launchRingScreen(alarm)
    }

    private fun startForegroundCompat(alarm: Alarm) {
        val notification = notifications.buildRingingNotification(alarm)
        runCatching {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                startForeground(
                    NotificationHelper.RINGING_NOTIFICATION_ID,
                    notification,
                    ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK,
                )
            } else {
                startForeground(NotificationHelper.RINGING_NOTIFICATION_ID, notification)
            }
        }.onFailure {
            // Notifications refused: the alarm still rings, it just cannot show
            // a shade entry. Never let this take the whole alarm down.
            Log.w(TAG, "Could not start in the foreground", it)
        }
    }

    /**
     * The full-screen intent on the ringing notification is the supported way
     * to reach the lock screen. Starting the activity directly as well covers
     * the unlocked case, where some OEM builds show only a heads-up banner.
     */
    private fun launchRingScreen(alarm: Alarm) {
        runCatching {
            startActivity(
                AlarmRingActivity.intent(this, alarm.id)
                    .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_NO_USER_ACTION)
            )
        }.onFailure { Log.i(TAG, "Direct activity start was refused; relying on the full-screen intent") }
    }

    private fun scheduleAutoSilence() {
        handler.removeCallbacks(autoSilence)
        scope.launch {
            val minutes = runCatching { ServiceLocator.settings.current().autoSilenceMinutes }
                .getOrDefault(10)
            handler.postDelayed(autoSilence, minutes * 60_000L)
        }
    }

    private enum class Outcome { SNOOZED, DISMISSED, MISSED }

    private fun finishRinging(outcome: Outcome) {
        val alarm = current
        if (alarm == null) {
            stopEverything()
            return
        }
        current = null

        handler.removeCallbacks(autoSilence)
        handler.removeCallbacks(volumeTicker)
        player.stop()

        when (outcome) {
            Outcome.SNOOZED -> {
                val until = System.currentTimeMillis() + alarm.snoozeMinutes * 60_000L
                RingingState.moveTo(RingingState.Phase.SNOOZED)
                recordHistory(alarm, HistoryAction.SNOOZED)
                scope.launch {
                    if (alarm.id != AlarmIntents.TEST_ALARM_ID) {
                        runCatching { ServiceLocator.alarms.snooze(alarm, until) }
                    }
                }
            }

            Outcome.DISMISSED -> {
                RingingState.moveTo(RingingState.Phase.DISMISSED)
                recordHistory(alarm, HistoryAction.DISMISSED)
                scope.launch {
                    if (alarm.id != AlarmIntents.TEST_ALARM_ID) {
                        runCatching { ServiceLocator.alarms.finishRinging(alarm.id) }
                    }
                }
            }

            Outcome.MISSED -> {
                RingingState.clear()
                recordHistory(alarm, HistoryAction.MISSED)
                notifications.showMissed(alarm)
                scope.launch {
                    if (alarm.id != AlarmIntents.TEST_ALARM_ID) {
                        runCatching { ServiceLocator.alarms.finishRinging(alarm.id) }
                    }
                }
            }
        }

        // Give the ringing screen a moment to show its closing mascot reaction
        // before the notification and the service disappear underneath it.
        val delay = if (outcome == Outcome.MISSED) 0L else CLOSING_ANIMATION_MS
        handler.postDelayed({
            RingingState.clear()
            stopEverything()
        }, delay)
    }

    private fun stopEverything() {
        handler.removeCallbacksAndMessages(null)
        player.stop()
        releaseWakeLock()
        notifications.cancelRinging()
        runCatching {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                stopForeground(STOP_FOREGROUND_REMOVE)
            } else {
                @Suppress("DEPRECATION")
                stopForeground(true)
            }
        }
        stopSelf()
    }

    private fun recordHistory(alarm: Alarm, action: HistoryAction) {
        if (alarm.id == AlarmIntents.TEST_ALARM_ID) return
        scope.launch {
            runCatching {
                ServiceLocator.history.record(alarm, action, scheduledFor)
            }
        }
    }

    private fun acquireWakeLock() {
        if (wakeLock?.isHeld == true) return
        val pm = getSystemService(Context.POWER_SERVICE) as PowerManager
        wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, WAKE_LOCK_TAG).apply {
            setReferenceCounted(false)
            runCatching { acquire(WAKE_LOCK_TIMEOUT_MS) }
        }
    }

    private fun releaseWakeLock() {
        wakeLock?.let { lock -> runCatching { if (lock.isHeld) lock.release() } }
        wakeLock = null
    }

    override fun onDestroy() {
        handler.removeCallbacksAndMessages(null)
        player.stop()
        releaseWakeLock()
        scope.cancel()
        super.onDestroy()
    }

    companion object {
        private const val TAG = "AlarmService"
        private const val WAKE_LOCK_TAG = "AlarmHandler:ringing"
        private const val WAKE_LOCK_TIMEOUT_MS = 15 * 60 * 1000L
        private const val VOLUME_TICK_MS = 500L
        private const val CLOSING_ANIMATION_MS = 1_400L

        /** Starts ringing [alarm]. The alarm travels whole so the service
         *  never has to touch the database on its critical path. */
        fun start(context: Context, alarm: Alarm, fromSnooze: Boolean) {
            val payload = Json.encodeToString(Alarm.serializer(), alarm)
            val intent = Intent(context, AlarmService::class.java).apply {
                action = AlarmIntents.ACTION_FIRE
                data = "alarmhandler://ring/${alarm.id}".toUri()
                putExtra(AlarmIntents.EXTRA_ALARM_JSON, payload)
                putExtra(AlarmIntents.EXTRA_ALARM_ID, alarm.id)
                putExtra(AlarmIntents.EXTRA_FROM_SNOOZE, fromSnooze)
            }
            startCompat(context, intent)
        }

        fun snooze(context: Context) = send(context, AlarmIntents.ACTION_SNOOZE)

        fun dismiss(context: Context) = send(context, AlarmIntents.ACTION_DISMISS)

        private fun send(context: Context, action: String) {
            val intent = Intent(context, AlarmService::class.java).apply {
                this.action = action
                data = "alarmhandler://action/$action".toUri()
            }
            startCompat(context, intent)
        }

        private fun startCompat(context: Context, intent: Intent) {
            runCatching {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    context.startForegroundService(intent)
                } else {
                    context.startService(intent)
                }
            }.onFailure { Log.e(TAG, "Could not start the alarm service", it) }
        }
    }
}

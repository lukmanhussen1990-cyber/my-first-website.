package com.imran.jarvis.service

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat
import com.imran.jarvis.JarvisApplication
import com.imran.jarvis.MainActivity
import com.imran.jarvis.R

/**
 * "Always on": keeps JARVIS running in the background with a small "JARVIS is on - tap to talk"
 * notification. Tapping it (or the Quick Settings tile) opens JARVIS straight into listening.
 *
 * The service itself never records audio: listening always happens with the app on screen, which is
 * what Android allows and what keeps the battery cost close to zero.
 */
class AlwaysOnService : Service() {

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent?.action == ACTION_TURN_OFF) {
            (application as JarvisApplication).container.settings.setAlwaysOn(false)
            stopForeground(STOP_FOREGROUND_REMOVE)
            stopSelf()
            return START_NOT_STICKY
        }

        val notification = AlwaysOnNotifications.ongoing(this)
        try {
            if (Build.VERSION.SDK_INT >= 34) {
                startForeground(AlwaysOnNotifications.ONGOING_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE)
            } else {
                startForeground(AlwaysOnNotifications.ONGOING_ID, notification)
            }
        } catch (e: Exception) {
            Log.w(TAG, "Could not start always-on mode", e)
            stopSelf()
            return START_NOT_STICKY
        }
        // If Android has to stop JARVIS to free memory, it brings it back later.
        return START_STICKY
    }

    companion object {
        private const val TAG = "AlwaysOnService"
        const val ACTION_TURN_OFF = "com.imran.jarvis.action.TURN_OFF_ALWAYS_ON"

        /** Starts always-on mode. Returns false if Android refused (for example straight after a reboot). */
        fun start(context: Context): Boolean = try {
            ContextCompat.startForegroundService(context, Intent(context, AlwaysOnService::class.java))
            true
        } catch (e: Exception) {
            Log.w(TAG, "Android did not allow always-on mode to start now", e)
            false
        }

        fun stop(context: Context) {
            context.stopService(Intent(context, AlwaysOnService::class.java))
        }
    }
}

/** The notifications that belong to always-on mode. */
object AlwaysOnNotifications {

    const val ONGOING_ID = 7
    private const val RESTART_ID = 8
    private const val CHANNEL_ID = "jarvis_always_on"

    /** The quiet, permanent "JARVIS is on" notification with Talk and Turn off buttons. */
    fun ongoing(context: Context): Notification {
        ensureChannel(context)
        val talk = PendingIntent.getActivity(
            context,
            1,
            MainActivity.listenIntent(context),
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
        )
        val turnOff = PendingIntent.getService(
            context,
            2,
            Intent(context, AlwaysOnService::class.java).setAction(AlwaysOnService.ACTION_TURN_OFF),
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
        )
        return NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_stat_jarvis)
            .setColor(0xFF2FD0FF.toInt())
            .setContentTitle("JARVIS is on")
            .setContentText("Tap to talk")
            .setContentIntent(talk)
            .setOngoing(true)
            .setShowWhen(false)
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setForegroundServiceBehavior(NotificationCompat.FOREGROUND_SERVICE_IMMEDIATE)
            .addAction(0, "Talk", talk)
            .addAction(0, "Turn off", turnOff)
            .build()
    }

    /**
     * Used after a restart if Android does not let JARVIS start by itself: one tap opens the app,
     * which switches always-on mode back on.
     */
    fun postRestartHint(context: Context) {
        ensureChannel(context)
        val open = PendingIntent.getActivity(
            context,
            3,
            MainActivity.listenIntent(context),
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
        )
        val notification = NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_stat_jarvis)
            .setColor(0xFF2FD0FF.toInt())
            .setContentTitle("JARVIS")
            .setContentText("Tap to switch JARVIS back on")
            .setContentIntent(open)
            .setAutoCancel(true)
            .build()
        try {
            context.getSystemService(NotificationManager::class.java)?.notify(RESTART_ID, notification)
        } catch (_: SecurityException) {
            // Notifications are switched off for JARVIS; nothing else to do.
        }
    }

    private fun ensureChannel(context: Context) {
        val manager = context.getSystemService(NotificationManager::class.java) ?: return
        if (manager.getNotificationChannel(CHANNEL_ID) != null) return
        manager.createNotificationChannel(
            NotificationChannel(CHANNEL_ID, "Always on", NotificationManager.IMPORTANCE_LOW).apply {
                description = "Keeps JARVIS ready so you can talk to it any time"
                setShowBadge(false)
            },
        )
    }
}

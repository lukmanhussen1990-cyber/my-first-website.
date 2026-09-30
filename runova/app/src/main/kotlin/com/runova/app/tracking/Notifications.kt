package com.runova.app.tracking

import android.Manifest
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import com.runova.app.R
import com.runova.app.ui.MainActivity
import com.runova.app.ui.model.LiveStatus
import com.runova.core.format.Fmt
import com.runova.core.model.UnitSystem

object Notifications {
    const val CHANNEL_RUN = "run"
    const val CHANNEL_PROGRESS = "progress"
    const val CHANNEL_REMINDERS = "reminders"
    const val RUN_ID = 1
    const val REMINDER_ID = 2
    private const val PROGRESS_BASE_ID = 1000
    const val EXTRA_ROUTE = "com.runova.app.ROUTE"

    private const val LIME = 0xFFCBFB4E.toInt()

    fun createChannels(context: Context) {
        val nm = context.getSystemService(NotificationManager::class.java)
        nm.createNotificationChannels(
            listOf(
                NotificationChannel(CHANNEL_RUN, context.getString(R.string.channel_run), NotificationManager.IMPORTANCE_LOW).apply {
                    description = context.getString(R.string.channel_run_desc)
                    setShowBadge(false)
                },
                NotificationChannel(CHANNEL_PROGRESS, context.getString(R.string.channel_progress), NotificationManager.IMPORTANCE_DEFAULT).apply {
                    description = context.getString(R.string.channel_progress_desc)
                },
                NotificationChannel(CHANNEL_REMINDERS, context.getString(R.string.channel_reminders), NotificationManager.IMPORTANCE_DEFAULT).apply {
                    description = context.getString(R.string.channel_reminders_desc)
                },
            ),
        )
    }

    fun canPost(context: Context): Boolean {
        if (Build.VERSION.SDK_INT >= 33 &&
            ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
        ) return false
        return NotificationManagerCompat.from(context).areNotificationsEnabled()
    }

    /** Opens the app, optionally on a route such as "running" or "notifications". */
    fun openApp(context: Context, route: String?, requestCode: Int = 0): PendingIntent {
        val intent = Intent(context, MainActivity::class.java)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP)
        if (route != null) intent.putExtra(EXTRA_ROUTE, route)
        return PendingIntent.getActivity(context, requestCode, intent, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
    }

    private fun serviceAction(context: Context, action: String, requestCode: Int): PendingIntent =
        PendingIntent.getService(
            context, requestCode,
            Intent(context, RunTrackingService::class.java).setAction(action),
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
        )

    fun run(context: Context, live: RunSession.Live?, units: UnitSystem): Notification {
        val b = NotificationCompat.Builder(context, CHANNEL_RUN)
            .setSmallIcon(R.drawable.ic_stat_runova)
            .setColor(LIME)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setSilent(true)
            .setCategory(NotificationCompat.CATEGORY_WORKOUT)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setForegroundServiceBehavior(NotificationCompat.FOREGROUND_SERVICE_IMMEDIATE)
            .setContentIntent(openApp(context, "running", requestCode = 1))
        val snap = live?.snapshot
        when {
            live == null || live.status == LiveStatus.COUNTDOWN || snap == null -> {
                b.setContentTitle("Getting ready…").setContentText("Waiting for the countdown and GPS")
            }
            else -> {
                val paused = live.status != LiveStatus.RUNNING
                val distance = Fmt.distance(snap.distanceM, units)
                b.setContentTitle(if (live.status == LiveStatus.AUTO_PAUSED) "Auto-paused • $distance" else if (paused) "Paused • $distance" else "Running • $distance")
                b.setContentText("${Fmt.clock(snap.movingTimeMs)} • ${Fmt.pace(snap.avgPaceSecPerKm, units)} ${Fmt.paceUnit(units)} avg")
                if (!paused) {
                    b.setUsesChronometer(true).setShowWhen(true).setWhen(System.currentTimeMillis() - snap.movingTimeMs)
                }
                if (live.status == LiveStatus.PAUSED) {
                    b.addAction(0, "Resume", serviceAction(context, RunTrackingService.ACTION_RESUME, 2))
                } else {
                    b.addAction(0, "Pause", serviceAction(context, RunTrackingService.ACTION_PAUSE, 3))
                }
                b.addAction(0, "Open", openApp(context, "running", requestCode = 4))
            }
        }
        return b.build()
    }

    /** Achievement, level or goal news; ids are spread so several can be shown at once. */
    fun progress(context: Context, title: String, body: String, index: Int) {
        if (!canPost(context)) return
        val n = NotificationCompat.Builder(context, CHANNEL_PROGRESS)
            .setSmallIcon(R.drawable.ic_stat_runova)
            .setColor(LIME)
            .setContentTitle(title)
            .setContentText(body)
            .setStyle(NotificationCompat.BigTextStyle().bigText(body))
            .setAutoCancel(true)
            .setContentIntent(openApp(context, "notifications", requestCode = 10))
            .build()
        post(context, PROGRESS_BASE_ID + index, n)
    }

    fun reminder(context: Context, title: String, body: String) {
        if (!canPost(context)) return
        val n = NotificationCompat.Builder(context, CHANNEL_REMINDERS)
            .setSmallIcon(R.drawable.ic_stat_runova)
            .setColor(LIME)
            .setContentTitle(title)
            .setContentText(body)
            .setStyle(NotificationCompat.BigTextStyle().bigText(body))
            .setAutoCancel(true)
            .setContentIntent(openApp(context, null, requestCode = 11))
            .build()
        post(context, REMINDER_ID, n)
    }

    private fun post(context: Context, id: Int, notification: Notification) {
        try {
            NotificationManagerCompat.from(context).notify(id, notification)
        } catch (e: SecurityException) {
            // Notification permission revoked between the check and the post.
        }
    }
}

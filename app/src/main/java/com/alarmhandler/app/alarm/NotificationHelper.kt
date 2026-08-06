package com.alarmhandler.app.alarm

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.graphics.BitmapFactory
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat
import androidx.core.net.toUri
import com.alarmhandler.app.MainActivity
import com.alarmhandler.app.R
import com.alarmhandler.app.data.model.Alarm
import com.alarmhandler.app.ui.ring.AlarmRingActivity

/**
 * Builds the alarm notifications.
 *
 * The ringing notification is what keeps the foreground service alive and what
 * carries the full-screen intent, so it is deliberately plain and always
 * actionable: Snooze and Dismiss work straight from the shade even if the user
 * never opens the ringing screen.
 */
class NotificationHelper(private val context: Context) {

    private val manager: NotificationManager =
        context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

    fun ensureChannels() {
        val ringing = NotificationChannel(
            CHANNEL_RINGING,
            context.getString(R.string.channel_alarm),
            NotificationManager.IMPORTANCE_HIGH,
        ).apply {
            description = context.getString(R.string.channel_alarm_desc)
            // The service plays the tone itself; a channel sound would double it.
            setSound(null, null)
            enableVibration(false)
            setBypassDnd(true)
            lockscreenVisibility = Notification.VISIBILITY_PUBLIC
            setShowBadge(false)
        }
        val missed = NotificationChannel(
            CHANNEL_MISSED,
            context.getString(R.string.channel_missed),
            NotificationManager.IMPORTANCE_DEFAULT,
        ).apply {
            description = context.getString(R.string.channel_missed_desc)
        }
        manager.createNotificationChannel(ringing)
        manager.createNotificationChannel(missed)
    }

    /** True when the system will actually launch our full-screen alarm UI. */
    fun canUseFullScreenIntent(): Boolean =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            manager.canUseFullScreenIntent()
        } else {
            true
        }

    fun buildRingingNotification(alarm: Alarm): Notification {
        val title = alarm.label.ifBlank { context.getString(R.string.ring_wake_up) }
        val fullScreen = PendingIntent.getActivity(
            context,
            REQ_FULL_SCREEN,
            AlarmRingActivity.intent(context, alarm.id),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )

        val builder = NotificationCompat.Builder(context, CHANNEL_RINGING)
            .setSmallIcon(R.drawable.ic_stat_alarm_handler)
            .setContentTitle(title)
            .setContentText(context.getString(R.string.notif_ringing))
            .setLargeIcon(
                BitmapFactory.decodeResource(context.resources, R.drawable.mascot)
            )
            .setCategory(NotificationCompat.CATEGORY_ALARM)
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setColor(ContextCompat.getColor(context, R.color.coral))
            .setColorized(true)
            .setOngoing(true)
            .setAutoCancel(false)
            .setSilent(true)
            .setContentIntent(fullScreen)
            .setFullScreenIntent(fullScreen, true)
            .addAction(
                0,
                context.getString(R.string.snooze),
                servicePendingIntent(alarm.id, AlarmIntents.ACTION_SNOOZE, REQ_SNOOZE),
            )
            .addAction(
                0,
                context.getString(R.string.dismiss),
                servicePendingIntent(alarm.id, AlarmIntents.ACTION_DISMISS, REQ_DISMISS),
            )

        if (!alarm.canSnooze) {
            builder.setSubText(context.getString(R.string.no_snoozes_left))
        }
        return builder.build()
    }

    fun showMissed(alarm: Alarm) {
        val open = PendingIntent.getActivity(
            context,
            REQ_OPEN_APP,
            Intent(context, MainActivity::class.java),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        val notification = NotificationCompat.Builder(context, CHANNEL_MISSED)
            .setSmallIcon(R.drawable.ic_stat_alarm_handler)
            .setContentTitle(context.getString(R.string.notif_missed))
            .setContentText(alarm.label.ifBlank { context.getString(R.string.app_name) })
            .setColor(ContextCompat.getColor(context, R.color.coral))
            .setAutoCancel(true)
            .setContentIntent(open)
            .build()
        // Posting is best effort: on Android 13+ the user may have refused
        // notifications, and an alarm app must not crash because of it.
        runCatching { manager.notify(missedIdFor(alarm.id), notification) }
    }

    fun cancelRinging() {
        runCatching { manager.cancel(RINGING_NOTIFICATION_ID) }
    }

    private fun servicePendingIntent(alarmId: Long, action: String, request: Int): PendingIntent {
        val intent = Intent(context, AlarmService::class.java).apply {
            this.action = action
            data = "alarmhandler://action/$action/$alarmId".toUri()
            putExtra(AlarmIntents.EXTRA_ALARM_ID, alarmId)
        }
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            PendingIntent.getForegroundService(
                context,
                request,
                intent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
            )
        } else {
            PendingIntent.getService(
                context,
                request,
                intent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
            )
        }
    }

    private fun missedIdFor(alarmId: Long) = MISSED_NOTIFICATION_BASE + alarmId.toInt()

    companion object {
        const val CHANNEL_RINGING = "alarm_ringing"
        const val CHANNEL_MISSED = "alarm_missed"
        const val RINGING_NOTIFICATION_ID = 1001
        private const val MISSED_NOTIFICATION_BASE = 2000
        private const val REQ_FULL_SCREEN = 10
        private const val REQ_SNOOZE = 11
        private const val REQ_DISMISS = 12
        private const val REQ_OPEN_APP = 13
    }
}

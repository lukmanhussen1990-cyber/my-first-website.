package com.imran.examcountdown.notify

import android.Manifest
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import com.imran.examcountdown.MainActivity
import com.imran.examcountdown.R
import com.imran.examcountdown.core.Choices
import com.imran.examcountdown.core.FocusMode
import com.imran.examcountdown.core.Formats
import com.imran.examcountdown.core.MINUTE
import com.imran.examcountdown.core.Profile
import com.imran.examcountdown.core.Reminder
import com.imran.examcountdown.core.ReminderKind
import com.imran.examcountdown.core.SeasonCalculator

/** Whether an activity of this app is on screen (then the UI reacts itself). */
object AppVisibility {
    @Volatile
    var resumed = false
}

object Notifier {
    const val CHANNEL_REMINDERS = "exam_reminders"
    const val CHANNEL_FOCUS = "focus_timer"
    private const val ID_FOCUS = 1
    private const val ID_EXAM_BASE = 100
    private const val ACCENT = 0xFF3B7BFF.toInt()

    fun createChannels(context: Context) {
        val nm = context.getSystemService(NotificationManager::class.java) ?: return
        val reminders = NotificationChannel(
            CHANNEL_REMINDERS,
            context.getString(R.string.channel_reminders),
            NotificationManager.IMPORTANCE_HIGH,
        ).apply { description = context.getString(R.string.channel_reminders_desc) }
        val focus = NotificationChannel(
            CHANNEL_FOCUS,
            context.getString(R.string.channel_focus),
            NotificationManager.IMPORTANCE_DEFAULT,
        ).apply { description = context.getString(R.string.channel_focus_desc) }
        nm.createNotificationChannels(listOf(reminders, focus))
    }

    /** True when Android will actually show this app's notifications. */
    fun canPost(context: Context): Boolean {
        if (Build.VERSION.SDK_INT >= 33 &&
            context.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
        ) {
            return false
        }
        return context.getSystemService(NotificationManager::class.java)?.areNotificationsEnabled() == true
    }

    fun showExamReminder(context: Context, reminder: Reminder, choices: Choices, profile: Profile, now: Long) {
        val exam = reminder.exam
        val name = exam.title(choices)
        val time = Formats.time(exam.start)
        val hall = if (profile.hall.isBlank()) "" else " · Hall ${profile.hall}"
        val title: String
        val body: String
        when (reminder.kind) {
            ReminderKind.DAY_BEFORE -> {
                val tomorrow = SeasonCalculator.todayInIndia(now).plusDays(1)
                val day = if (exam.date == tomorrow) "Tomorrow" else Formats.dateShort(exam.date)
                title = "$day: $name"
                body = "Starts at $time (India time)$hall. One chapter at a time — you’ve got this!"
            }
            ReminderKind.HOUR_BEFORE -> {
                val minutes = ((exam.startMillis - now + MINUTE - 1) / MINUTE).coerceAtLeast(0)
                val lead = when {
                    minutes in 55..65 -> "in 1 hour"
                    minutes > 1 -> "in $minutes minutes"
                    else -> "now"
                }
                title = "$name starts $lead"
                body = "$time (India time)$hall. Deep breath — you’re ready."
            }
        }
        val id = ID_EXAM_BASE + exam.subject.ordinal * 2 + reminder.kind.ordinal
        post(context, CHANNEL_REMINDERS, id, title, body, MainActivity.TAB_HOME)
    }

    fun showFocusDone(context: Context, mode: FocusMode) {
        val (title, body) = when (mode) {
            FocusMode.FOCUS -> "Focus session complete 🎉" to "25 minutes done. Time for a 5-minute break."
            FocusMode.BREAK -> "Break’s over" to "Ready for another 25-minute focus session?"
        }
        post(context, CHANNEL_FOCUS, ID_FOCUS, title, body, MainActivity.TAB_STUDY)
    }

    private fun post(context: Context, channel: String, id: Int, title: String, body: String, tab: Int) {
        if (!canPost(context)) return
        val nm = context.getSystemService(NotificationManager::class.java) ?: return
        val open = Intent(context, MainActivity::class.java)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP)
            .putExtra(MainActivity.EXTRA_TAB, tab)
        val pending = PendingIntent.getActivity(
            context, id, open, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
        )
        val notification = Notification.Builder(context, channel)
            .setSmallIcon(R.drawable.ic_stat_countdown)
            .setColor(ACCENT)
            .setContentTitle(title)
            .setContentText(body)
            .setStyle(Notification.BigTextStyle().bigText(body))
            .setCategory(if (channel == CHANNEL_REMINDERS) Notification.CATEGORY_REMINDER else Notification.CATEGORY_ALARM)
            .setAutoCancel(true)
            .setContentIntent(pending)
            .build()
        nm.notify(id, notification)
    }
}

package com.alarmhandler.app.alarm

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import android.util.Log
import androidx.core.net.toUri
import com.alarmhandler.app.MainActivity
import com.alarmhandler.app.data.model.Alarm
import kotlinx.serialization.json.Json
import java.time.ZonedDateTime

/**
 * Owns every interaction with [AlarmManager].
 *
 * Scheduling is idempotent: each alarm has exactly one pending intent for its
 * regular occurrence and one for a pending snooze, both keyed by request code
 * *and* by intent data. Re-scheduling therefore replaces rather than stacks,
 * which is what keeps duplicates from appearing after an edit or a reboot.
 */
class AlarmScheduler(private val context: Context) {

    private val alarmManager: AlarmManager =
        context.getSystemService(Context.ALARM_SERVICE) as AlarmManager

    private val json = Json { ignoreUnknownKeys = true }

    /** True when Android will let us ring at an exact minute. */
    fun canScheduleExactAlarms(): Boolean =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            alarmManager.canScheduleExactAlarms()
        } else {
            true
        }

    /**
     * Arms [alarm]'s regular occurrence and returns when it will ring, or null
     * if it never will (disabled, or no repeat day left).
     */
    fun schedule(alarm: Alarm, now: ZonedDateTime = ZonedDateTime.now()): Long? {
        cancelMain(alarm.id)
        if (!alarm.enabled) return null
        val triggerAt = AlarmSchedule.nextTriggerMillis(alarm, now, honorSnooze = false)
            ?: return null
        setExact(
            triggerAtMillis = triggerAt,
            operation = firePendingIntent(alarm.id, fromSnooze = false),
        )
        return triggerAt
    }

    /** Arms the snooze for [alarm] at [triggerAt]. */
    fun scheduleSnooze(alarm: Alarm, triggerAt: Long) {
        setExact(
            triggerAtMillis = triggerAt,
            operation = firePendingIntent(alarm.id, fromSnooze = true),
        )
    }

    /**
     * Fires a one-off alarm five seconds from now for the Settings test
     * button. The alarm travels inside the intent, so nothing is written to
     * the database and nothing appears in the user's list.
     */
    fun scheduleTest(alarm: Alarm, delayMillis: Long = 5_000L) {
        val payload = json.encodeToString(Alarm.serializer(), alarm.copy(id = AlarmIntents.TEST_ALARM_ID))
        val intent = Intent(context, AlarmReceiver::class.java).apply {
            action = AlarmIntents.ACTION_FIRE
            data = AlarmIntents.mainUri(AlarmIntents.TEST_ALARM_ID).toUri()
            putExtra(AlarmIntents.EXTRA_ALARM_ID, AlarmIntents.TEST_ALARM_ID)
            putExtra(AlarmIntents.EXTRA_ALARM_JSON, payload)
        }
        val operation = PendingIntent.getBroadcast(
            context,
            AlarmIntents.mainRequestCode(AlarmIntents.TEST_ALARM_ID),
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        setExact(System.currentTimeMillis() + delayMillis, operation)
    }

    fun cancel(alarmId: Long) {
        cancelMain(alarmId)
        cancelSnooze(alarmId)
    }

    fun cancelMain(alarmId: Long) {
        alarmManager.cancel(firePendingIntent(alarmId, fromSnooze = false))
    }

    fun cancelSnooze(alarmId: Long) {
        alarmManager.cancel(firePendingIntent(alarmId, fromSnooze = true))
    }

    /**
     * Re-arms every alarm from scratch. Used after boot, after a time zone or
     * clock change, and whenever the app starts, so the system's view can
     * never drift from the database.
     */
    fun rescheduleAll(alarms: List<Alarm>, now: ZonedDateTime = ZonedDateTime.now()) {
        alarms.forEach { alarm ->
            cancel(alarm.id)
            if (!alarm.enabled) return@forEach
            schedule(alarm, now)
            // A snooze that is still in the future survives the reschedule.
            if (alarm.snoozeUntil > System.currentTimeMillis()) {
                scheduleSnooze(alarm, alarm.snoozeUntil)
            }
        }
    }

    private fun firePendingIntent(alarmId: Long, fromSnooze: Boolean): PendingIntent {
        val intent = Intent(context, AlarmReceiver::class.java).apply {
            action = AlarmIntents.ACTION_FIRE
            // Extras are ignored when Android compares pending intents, so the
            // alarm id has to live in the data uri to keep them distinct.
            data = if (fromSnooze) {
                AlarmIntents.snoozeUri(alarmId).toUri()
            } else {
                AlarmIntents.mainUri(alarmId).toUri()
            }
            putExtra(AlarmIntents.EXTRA_ALARM_ID, alarmId)
            putExtra(AlarmIntents.EXTRA_FROM_SNOOZE, fromSnooze)
        }
        val requestCode = if (fromSnooze) {
            AlarmIntents.snoozeRequestCode(alarmId)
        } else {
            AlarmIntents.mainRequestCode(alarmId)
        }
        return PendingIntent.getBroadcast(
            context,
            requestCode,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
    }

    /**
     * `setAlarmClock` is the only scheduling call the system treats as a real
     * user-visible alarm: it survives Doze, it is exempt from app standby
     * buckets, and it puts the alarm icon in the status bar.
     *
     * If the user has revoked exact alarms we degrade rather than crash --
     * `setAndAllowWhileIdle` still wakes the device, just within a window the
     * system chooses. Settings shows a warning card whenever that happens.
     */
    private fun setExact(triggerAtMillis: Long, operation: PendingIntent) {
        try {
            if (canScheduleExactAlarms()) {
                val showIntent = PendingIntent.getActivity(
                    context,
                    0,
                    Intent(context, MainActivity::class.java),
                    PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
                )
                alarmManager.setAlarmClock(
                    AlarmManager.AlarmClockInfo(triggerAtMillis, showIntent),
                    operation,
                )
            } else {
                alarmManager.setAndAllowWhileIdle(
                    AlarmManager.RTC_WAKEUP,
                    triggerAtMillis,
                    operation,
                )
            }
        } catch (e: SecurityException) {
            // Exact-alarm access was revoked between the check and the call.
            Log.w(TAG, "Falling back to an inexact alarm", e)
            runCatching {
                alarmManager.setAndAllowWhileIdle(
                    AlarmManager.RTC_WAKEUP,
                    triggerAtMillis,
                    operation,
                )
            }
        }
    }

    private companion object {
        const val TAG = "AlarmScheduler"
    }
}

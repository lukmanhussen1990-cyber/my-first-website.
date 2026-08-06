package com.alarmhandler.app.alarm

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log
import com.alarmhandler.app.data.ServiceLocator
import com.alarmhandler.app.data.model.Alarm
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import kotlinx.serialization.json.Json

/**
 * Receives the AlarmManager broadcast and hands the alarm to [AlarmService].
 *
 * The database read happens here, inside `goAsync`, so the service starts with
 * the full alarm already in hand and can go foreground immediately.
 */
class AlarmReceiver : BroadcastReceiver() {

    private val json = Json { ignoreUnknownKeys = true }

    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != AlarmIntents.ACTION_FIRE) return

        val alarmId = intent.getLongExtra(AlarmIntents.EXTRA_ALARM_ID, 0L)
        val fromSnooze = intent.getBooleanExtra(AlarmIntents.EXTRA_FROM_SNOOZE, false)
        val inlineAlarm = intent.getStringExtra(AlarmIntents.EXTRA_ALARM_JSON)
            ?.let { runCatching { json.decodeFromString(Alarm.serializer(), it) }.getOrNull() }

        // The test alarm arrives complete inside the intent and never touches
        // the database, so it can ring without a round trip.
        if (inlineAlarm != null) {
            AlarmService.start(context, inlineAlarm, fromSnooze)
            return
        }

        ServiceLocator.init(context.applicationContext)
        val pending = goAsync()
        CoroutineScope(SupervisorJob() + Dispatchers.IO).launch {
            try {
                val alarm = ServiceLocator.alarms.getById(alarmId)
                if (alarm == null) {
                    Log.w(TAG, "Alarm $alarmId fired but no longer exists")
                    ServiceLocator.scheduler.cancel(alarmId)
                    return@launch
                }
                if (!alarm.enabled) {
                    Log.i(TAG, "Alarm $alarmId fired while switched off; ignoring")
                    return@launch
                }

                AlarmService.start(context, alarm, fromSnooze)

                // Repeating alarms are re-armed the moment they fire, so the
                // next occurrence exists even if the user never dismisses this
                // one. One-shot alarms are switched off when the ring ends.
                if (alarm.isRepeating) {
                    ServiceLocator.scheduler.schedule(alarm)
                }
            } catch (e: Exception) {
                Log.e(TAG, "Failed to handle alarm $alarmId", e)
            } finally {
                pending.finish()
            }
        }
    }

    private companion object {
        const val TAG = "AlarmReceiver"
    }
}

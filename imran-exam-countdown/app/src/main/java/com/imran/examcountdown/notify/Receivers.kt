package com.imran.examcountdown.notify

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/** Fired by the app's own alarm. */
class AlarmReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action == ReminderScheduler.ACTION_WAKE) ReminderScheduler.onWake(context)
    }
}

/**
 * Alarms don't survive a restart, and a clock or time-zone change moves every trigger
 * time, so re-check and re-arm after any of these system events.
 */
class SystemEventReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        when (intent.action) {
            Intent.ACTION_BOOT_COMPLETED,
            Intent.ACTION_MY_PACKAGE_REPLACED,
            Intent.ACTION_TIME_CHANGED,
            Intent.ACTION_TIMEZONE_CHANGED,
            -> ReminderScheduler.onWake(context)
        }
    }
}

package com.imran.examcountdown.notify

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import com.imran.examcountdown.core.FocusTimer
import com.imran.examcountdown.core.ReminderPlanner
import com.imran.examcountdown.data.AppClock
import com.imran.examcountdown.data.Store

/**
 * Keeps a single alarm set for the next thing that needs a notification: an exam reminder
 * or the end of a focus session. Uses inexact "allow while idle" alarms, which need no
 * special permission; see [ReminderPlanner.wakeAt] for how they stay close to on time.
 */
object ReminderScheduler {
    private const val REQUEST_WAKE = 7
    const val ACTION_WAKE = "com.imran.examcountdown.action.WAKE"

    /** Shows whatever is due, then arms the next alarm. Safe to call at any time. */
    fun onWake(context: Context) {
        val store = Store(context)
        val now = AppClock.now()
        val settings = store.reminders
        val canPost = Notifier.canPost(context)

        val plan = ReminderPlanner.plan(store.exams, settings)
        val delivered = store.delivered
        val due = ReminderPlanner.due(plan, now, delivered, settings.armedAt)
        if (due.isNotEmpty()) {
            if (canPost) {
                val choices = store.choices
                val profile = store.profile
                due.forEach { Notifier.showExamReminder(context, it, choices, profile, now) }
            }
            store.delivered = delivered + due.map { it.key }
        }

        val focus = store.focus
        val settled = FocusTimer.settle(focus, AppClock.moment(context), AppClock.localEpochDay())
        if (settled != focus) {
            store.focus = settled
            val justFinished = focus.running && !settled.running
            if (justFinished && settings.focusAlerts && canPost && !AppVisibility.resumed) {
                settled.finished?.let { Notifier.showFocusDone(context, it) }
            }
        }
        reschedule(context)
    }

    /** Arms (or cancels) the alarm for the next reminder or focus-session end. */
    fun reschedule(context: Context) {
        val store = Store(context)
        val now = AppClock.now()
        val settings = store.reminders
        val canPost = Notifier.canPost(context)

        val plan = ReminderPlanner.plan(store.exams, settings)
        // Forget delivery records for reminders that no longer exist (e.g. after an edit).
        val delivered = store.delivered
        val live = plan.map { it.key }.toSet()
        if (!live.containsAll(delivered)) store.delivered = delivered.intersect(live)

        val examTarget = if (canPost) ReminderPlanner.nextFireAt(plan, now, delivered, settings.armedAt) else null
        val focusTarget = if (canPost && settings.focusAlerts) {
            FocusTimer.endsAt(store.focus, AppClock.moment(context))
        } else {
            null
        }
        val target = listOfNotNull(examTarget, focusTarget).minOrNull()

        val alarms = context.getSystemService(AlarmManager::class.java) ?: return
        val wake = wakeIntent(context)
        if (target == null) {
            alarms.cancel(wake)
            return
        }
        val exact = Build.VERSION.SDK_INT < 31 || alarms.canScheduleExactAlarms()
        val at = ReminderPlanner.wakeAt(target, now, exact)
        if (exact && at == target) {
            alarms.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, wake)
        } else {
            alarms.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, wake)
        }
    }

    private fun wakeIntent(context: Context): PendingIntent = PendingIntent.getBroadcast(
        context,
        REQUEST_WAKE,
        Intent(context, AlarmReceiver::class.java).setAction(ACTION_WAKE),
        PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
    )
}

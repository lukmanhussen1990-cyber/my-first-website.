package com.runova.app.tracking

import android.Manifest
import android.app.AlarmManager
import android.app.PendingIntent
import android.app.job.JobInfo
import android.app.job.JobParameters
import android.app.job.JobScheduler
import android.app.job.JobService
import android.content.BroadcastReceiver
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import android.os.Build
import android.provider.Settings
import androidx.core.content.ContextCompat
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.ProcessLifecycleOwner
import com.runova.app.data.AppRepository
import com.runova.app.data.SettingsStore
import com.runova.app.graph
import com.runova.app.state.AppSettings
import com.runova.app.state.UiEnv
import com.runova.app.state.UiMapper
import com.runova.core.coach.CoachEngine
import com.runova.core.progress.Rewards
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withTimeoutOrNull
import java.time.LocalDate
import java.time.ZonedDateTime
import kotlin.coroutines.resume

private val backgroundScope = CoroutineScope(SupervisorJob() + Dispatchers.Default)

/**
 * Turns the hardware step counter (steps since boot) into steps per day. Samples come from the
 * run service while running and from [StepSamplerJob] in between.
 */
class StepsTracker(context: Context, private val repository: AppRepository) {
    private val app = context.applicationContext
    private val store: SettingsStore = repository.settings

    fun hasPermission(): Boolean = Build.VERSION.SDK_INT < 29 ||
        ContextCompat.checkSelfPermission(app, Manifest.permission.ACTIVITY_RECOGNITION) == PackageManager.PERMISSION_GRANTED

    fun hasSensor(): Boolean = app.getSystemService(SensorManager::class.java)?.getDefaultSensor(Sensor.TYPE_STEP_COUNTER) != null

    @Synchronized
    fun onCounter(counter: Long) {
        val boot = Settings.Global.getInt(app.contentResolver, Settings.Global.BOOT_COUNT, -1)
        val base = store.stepBaseline
        store.stepBaseline = SettingsStore.StepBaseline(counter, boot)
        if (base == null) return
        val delta = if (boot != base.bootCount || counter < base.counter) counter else counter - base.counter
        if (delta in 1..MAX_PLAUSIBLE_DELTA) {
            backgroundScope.launch { repository.addSteps(LocalDate.now(), delta.toInt()) }
        }
    }

    /** Reads the counter once (the sensor reports its current value right after registering). */
    suspend fun sample(): Boolean {
        if (!hasPermission()) return false
        val sm = app.getSystemService(SensorManager::class.java) ?: return false
        val sensor = sm.getDefaultSensor(Sensor.TYPE_STEP_COUNTER) ?: return false
        val value = withTimeoutOrNull(SAMPLE_TIMEOUT_MS) {
            suspendCancellableCoroutine { cont ->
                val listener = object : SensorEventListener {
                    override fun onSensorChanged(event: SensorEvent) {
                        sm.unregisterListener(this)
                        if (cont.isActive) cont.resume(event.values.firstOrNull()?.toLong())
                    }

                    override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) = Unit
                }
                sm.registerListener(listener, sensor, SensorManager.SENSOR_DELAY_NORMAL)
                cont.invokeOnCancellation { sm.unregisterListener(listener) }
            }
        } ?: return false
        onCounter(value)
        return true
    }

    private companion object {
        const val MAX_PLAUSIBLE_DELTA = 60_000L
        const val SAMPLE_TIMEOUT_MS = 5_000L
    }
}

/** Posts system notifications for rewards earned while the app isn't on screen. */
internal fun notifyRewards(context: Context, rewards: Rewards?) {
    if (rewards == null || rewards.isEmpty) return
    val visible = ProcessLifecycleOwner.get().lifecycle.currentState.isAtLeast(Lifecycle.State.STARTED)
    if (visible) return
    var i = 0
    for (g in rewards.goals) Notifications.progress(context, "${g.label} complete! 🎯", "Nice work. +${g.xp} XP", i++)
    for (a in rewards.achievements) Notifications.progress(context, "Achievement unlocked: ${a.title} 🏅", "${a.unlockText} +${a.xp} XP", i++)
    if (rewards.leveledUp) Notifications.progress(context, "Level up! 🚀", "You reached Level ${rewards.levelAfter.level}.", i)
}

/** Periodically samples the step counter so daily steps and step goals stay current. */
class StepSamplerJob : JobService() {
    override fun onStartJob(params: JobParameters): Boolean {
        val graph = applicationContext.graph
        backgroundScope.launch {
            try {
                graph.repository.loaded.first { it }
                graph.steps.sample()
                notifyRewards(applicationContext, graph.repository.settlePendingRewards())
            } finally {
                jobFinished(params, false)
            }
        }
        return true
    }

    override fun onStopJob(params: JobParameters): Boolean = true

    companion object {
        private const val JOB_ID = 42

        fun schedule(context: Context) {
            val js = context.getSystemService(JobScheduler::class.java) ?: return
            if (js.getPendingJob(JOB_ID) != null) return
            js.schedule(
                JobInfo.Builder(JOB_ID, ComponentName(context, StepSamplerJob::class.java))
                    .setPeriodic(30 * 60_000L)
                    .setPersisted(true)
                    .build(),
            )
        }
    }
}

object Reminders {
    private fun intent(context: Context): PendingIntent = PendingIntent.getBroadcast(
        context, 0, Intent(context, ReminderReceiver::class.java),
        PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
    )

    fun nextTrigger(settings: AppSettings, now: ZonedDateTime = ZonedDateTime.now()): ZonedDateTime {
        val today = now.withHour(settings.reminderHour).withMinute(settings.reminderMinute).withSecond(0).withNano(0)
        return if (today.isAfter(now)) today else today.plusDays(1)
    }

    /** (Re)schedules the daily reminder, or cancels it when turned off. Inexact, so no special permission. */
    fun schedule(context: Context, settings: AppSettings) {
        val am = context.getSystemService(AlarmManager::class.java) ?: return
        val pi = intent(context)
        am.cancel(pi)
        if (!settings.reminderEnabled) return
        am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, nextTrigger(settings).toInstant().toEpochMilli(), pi)
    }
}

class ReminderReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val pending = goAsync()
        val graph = context.applicationContext.graph
        backgroundScope.launch {
            try {
                graph.repository.loaded.first { it }
                val data = graph.repository.snapshot()
                val env = UiEnv.system()
                val ranToday = UiMapper.dayActivity(data, env.today, env).runs > 0
                if (data.settings.reminderEnabled && !ranToday && !graph.session.isActive) {
                    val tip = CoachEngine.insights(UiMapper.coachSnapshot(data, env)).firstOrNull()?.text
                    val streak = UiMapper.currentStreak(data, env)
                    val title = if (streak > 0) "Keep your $streak-day streak alive 🔥" else "Time for a run, ${data.settings.profile.firstName}? 🏃"
                    Notifications.reminder(context, title, tip ?: "A short, easy run counts. Your future self will thank you.")
                }
                Reminders.schedule(context, data.settings)
            } finally {
                pending.finish()
            }
        }
    }
}

/** Restores the reminder and step sampling after a reboot, an update or a time-zone change. */
class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val graph = context.applicationContext.graph
        Reminders.schedule(context, graph.settings.load())
        StepSamplerJob.schedule(context)
    }
}

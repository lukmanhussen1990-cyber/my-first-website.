package com.alarmhandler.app.util

import android.Manifest
import android.app.AlarmManager
import android.app.NotificationManager
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.PowerManager
import android.provider.Settings
import androidx.core.content.ContextCompat

/**
 * A snapshot of every system permission that can stop an alarm from ringing.
 *
 * The app is fully usable with all of these denied -- alarms degrade to
 * inexact scheduling and a plain notification -- so this exists to tell the
 * user what is currently limiting them, not to gate the UI.
 */
data class AlarmPermissionState(
    val notificationsGranted: Boolean,
    val exactAlarmsGranted: Boolean,
    val fullScreenIntentGranted: Boolean,
    val ignoringBatteryOptimisations: Boolean,
) {
    val allGood: Boolean
        get() = notificationsGranted &&
            exactAlarmsGranted &&
            fullScreenIntentGranted &&
            ignoringBatteryOptimisations

    /** Problems worth interrupting the user about, worst first. */
    val blockingIssues: List<AlarmPermissionIssue>
        get() = buildList {
            if (!notificationsGranted) add(AlarmPermissionIssue.NOTIFICATIONS)
            if (!exactAlarmsGranted) add(AlarmPermissionIssue.EXACT_ALARMS)
            if (!fullScreenIntentGranted) add(AlarmPermissionIssue.FULL_SCREEN)
            if (!ignoringBatteryOptimisations) add(AlarmPermissionIssue.BATTERY)
        }
}

enum class AlarmPermissionIssue { NOTIFICATIONS, EXACT_ALARMS, FULL_SCREEN, BATTERY }

object AlarmPermissions {

    fun read(context: Context): AlarmPermissionState = AlarmPermissionState(
        notificationsGranted = notificationsGranted(context),
        exactAlarmsGranted = exactAlarmsGranted(context),
        fullScreenIntentGranted = fullScreenIntentGranted(context),
        ignoringBatteryOptimisations = ignoringBatteryOptimisations(context),
    )

    fun notificationsGranted(context: Context): Boolean =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            ContextCompat.checkSelfPermission(
                context,
                Manifest.permission.POST_NOTIFICATIONS,
            ) == PackageManager.PERMISSION_GRANTED
        } else {
            true
        }

    fun exactAlarmsGranted(context: Context): Boolean =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            val am = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
            am.canScheduleExactAlarms()
        } else {
            true
        }

    fun fullScreenIntentGranted(context: Context): Boolean =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            nm.canUseFullScreenIntent()
        } else {
            true
        }

    fun ignoringBatteryOptimisations(context: Context): Boolean = runCatching {
        val pm = context.getSystemService(Context.POWER_SERVICE) as PowerManager
        pm.isIgnoringBatteryOptimizations(context.packageName)
    }.getOrDefault(true)

    /**
     * The settings screen to send the user to for [issue], or null when the
     * platform has no such screen (in which case the app already has it).
     *
     * Every intent is checked for a receiver before being offered, because
     * several of these are missing on some manufacturer builds.
     */
    fun intentFor(context: Context, issue: AlarmPermissionIssue): Intent? {
        val intent = when (issue) {
            AlarmPermissionIssue.NOTIFICATIONS ->
                Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS)
                    .putExtra(Settings.EXTRA_APP_PACKAGE, context.packageName)

            AlarmPermissionIssue.EXACT_ALARMS ->
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                    Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM)
                        .setData(Uri.fromParts("package", context.packageName, null))
                } else {
                    null
                }

            AlarmPermissionIssue.FULL_SCREEN ->
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
                    Intent(Settings.ACTION_MANAGE_APP_USE_FULL_SCREEN_INTENT)
                        .setData(Uri.fromParts("package", context.packageName, null))
                } else {
                    null
                }

            AlarmPermissionIssue.BATTERY ->
                @Suppress("BatteryLife")
                Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS)
                    .setData(Uri.fromParts("package", context.packageName, null))
        } ?: return null

        return if (intent.resolveActivity(context.packageManager) != null) {
            intent
        } else {
            // Fall back to the app's own settings page, which always exists.
            appSettingsIntent(context).takeIf {
                it.resolveActivity(context.packageManager) != null
            }
        }
    }

    fun appSettingsIntent(context: Context): Intent =
        Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS)
            .setData(Uri.fromParts("package", context.packageName, null))
}

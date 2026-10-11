package com.imran.jarvis.ui

import android.content.ActivityNotFoundException
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import com.imran.jarvis.service.JarvisNotificationListener

/** Opens the phone's own Settings pages that the user has to visit to grant special permissions. */
object SystemSettings {

    /** "Notification access": the page where the user switches JARVIS on to read notifications. */
    fun openNotificationAccess(context: Context) {
        val general = Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS)
        if (Build.VERSION.SDK_INT >= 30) {
            val component = ComponentName(context, JarvisNotificationListener::class.java)
            val detail = Intent(Settings.ACTION_NOTIFICATION_LISTENER_DETAIL_SETTINGS)
                .putExtra(Settings.EXTRA_NOTIFICATION_LISTENER_COMPONENT_NAME, component.flattenToString())
            startFirstThatWorks(context, detail, general)
        } else {
            startFirstThatWorks(context, general)
        }
    }

    /** JARVIS's own page in Settings > Apps, where permissions can be switched on again. */
    fun openAppInfo(context: Context) {
        val intent = Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.fromParts("package", context.packageName, null))
        startFirstThatWorks(context, intent)
    }

    /**
     * The list where the user can let JARVIS keep running in the background ("Don't optimize" /
     * "Unrestricted"). Some phone brands stop background apps aggressively otherwise.
     */
    fun openBatterySettings(context: Context) {
        val appInfo = Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.fromParts("package", context.packageName, null))
        startFirstThatWorks(context, Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS), appInfo)
    }

    private fun startFirstThatWorks(context: Context, vararg intents: Intent) {
        for (intent in intents) {
            try {
                context.startActivity(intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
                return
            } catch (_: ActivityNotFoundException) {
                // try the next one
            }
        }
    }
}

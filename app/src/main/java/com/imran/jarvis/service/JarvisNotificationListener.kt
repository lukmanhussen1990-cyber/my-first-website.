package com.imran.jarvis.service

import android.app.Notification
import android.content.pm.PackageManager
import android.os.Build
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import com.imran.jarvis.i18n.NotificationLine

/**
 * Lets JARVIS read the notifications that are currently showing, when the user asks.
 * It only works after the user switches on "Notification access" for JARVIS in system Settings.
 * Notification text is read out loud on the phone; it is never sent to the AI.
 */
class JarvisNotificationListener : NotificationListenerService() {

    override fun onListenerConnected() {
        instance = this
    }

    override fun onListenerDisconnected() {
        if (instance === this) instance = null
    }

    override fun onDestroy() {
        if (instance === this) instance = null
        super.onDestroy()
    }

    /** The newest [max] notifications, skipping ongoing ones (music, downloads) and group summaries. */
    fun latest(max: Int): List<NotificationLine> {
        val active = try {
            activeNotifications
        } catch (_: RuntimeException) {
            null
        } ?: return emptyList()

        return active
            .filter { it.packageName != packageName && !it.isOngoing }
            .filter { it.notification.flags and Notification.FLAG_GROUP_SUMMARY == 0 }
            .sortedByDescending { it.postTime }
            .mapNotNull { toLine(it) }
            .distinct()
            .take(max)
    }

    private fun toLine(sbn: StatusBarNotification): NotificationLine? {
        val extras = sbn.notification.extras ?: return null
        val title = extras.getCharSequence(Notification.EXTRA_TITLE)?.toString().orEmpty().trim()
        val text = (
            extras.getCharSequence(Notification.EXTRA_TEXT)
                ?: extras.getCharSequence(Notification.EXTRA_BIG_TEXT)
            )?.toString().orEmpty().trim()
        if (title.isEmpty() && text.isEmpty()) return null
        return NotificationLine(appLabel(sbn.packageName), title.take(MAX_PART), text.take(MAX_PART))
    }

    private fun appLabel(pkg: String): String = try {
        val info = if (Build.VERSION.SDK_INT >= 33) {
            packageManager.getApplicationInfo(pkg, PackageManager.ApplicationInfoFlags.of(0))
        } else {
            @Suppress("DEPRECATION")
            packageManager.getApplicationInfo(pkg, 0)
        }
        packageManager.getApplicationLabel(info).toString()
    } catch (_: PackageManager.NameNotFoundException) {
        pkg.substringAfterLast('.')
    }

    companion object {
        private const val MAX_PART = 120

        /** The running service, or null when notification access is off or not connected yet. */
        @Volatile
        var instance: JarvisNotificationListener? = null
            private set
    }
}

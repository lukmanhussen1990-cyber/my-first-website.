package com.weplay.guesserai.service

import android.app.AppOpsManager
import android.app.usage.UsageEvents
import android.app.usage.UsageStatsManager
import android.content.Context
import android.content.Intent
import android.os.Process

/** Finds the WePlay app and tells whether it is the app currently on screen. */
class GameAppMonitor(private val context: Context) {
    private val usm = context.getSystemService(UsageStatsManager::class.java)
    private var lastForeground: String? = null

    fun hasUsageAccess(): Boolean {
        val ops = context.getSystemService(AppOpsManager::class.java)
        @Suppress("DEPRECATION")
        val mode = ops.unsafeCheckOpNoThrow(AppOpsManager.OPSTR_GET_USAGE_STATS, Process.myUid(), context.packageName)
        return mode == AppOpsManager.MODE_ALLOWED
    }

    /**
     * Package of the app in the foreground, from usage events of the last minute; falls back to
     * the last one seen. Null without usage access.
     */
    fun foregroundPackage(): String? {
        if (!hasUsageAccess()) return null
        val now = System.currentTimeMillis()
        val events = usm.queryEvents(now - 60_000, now)
        val e = UsageEvents.Event()
        while (events.hasNextEvent()) {
            events.getNextEvent(e)
            if (e.eventType == UsageEvents.Event.ACTIVITY_RESUMED) lastForeground = e.packageName
        }
        return lastForeground
    }

    /** True / false when known; null when we cannot tell (no usage access or no game configured). */
    fun isGameInForeground(gamePackage: String): Boolean? {
        if (gamePackage.isBlank()) return null
        val fg = foregroundPackage() ?: return null
        // Our own settings screen counts as "still playing" so the user can tweak things mid-game.
        return fg == gamePackage || fg == context.packageName
    }

    companion object {
        /** Installed launcher apps whose label or package mentions WePlay. */
        fun findWePlayApps(context: Context): List<Pair<String, String>> {
            val pm = context.packageManager
            val intent = Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER)
            return pm.queryIntentActivities(intent, 0)
                .map { it.activityInfo.packageName to it.loadLabel(pm).toString() }
                .filter { (pkg, label) -> label.contains("weplay", true) || pkg.contains("weplay", true) }
                .distinctBy { it.first }
        }
    }
}

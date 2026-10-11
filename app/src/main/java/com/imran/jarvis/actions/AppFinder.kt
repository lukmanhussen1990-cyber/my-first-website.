package com.imran.jarvis.actions

import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.provider.AlarmClock
import android.provider.MediaStore
import android.provider.Settings

/** An installed app (or a standard phone screen) that JARVIS can open. */
data class AppTarget(val label: String, val intent: Intent)

/** Finds an installed app by the name the user said, e.g. "chrome" -> Google Chrome. */
class AppFinder(private val context: Context) {

    private data class LauncherApp(val label: String, val packageName: String, val activity: String)

    fun find(spokenName: String): AppTarget? {
        val query = AppAliases.canonical(spokenName.trim())
        if (query.isBlank()) return null

        val apps = launcherApps()
        val best = apps
            .map { it to matchScore(query, it) }
            .filter { it.second > 0 }
            .maxByOrNull { it.second }

        // 1. A clear match on an installed app's name wins.
        if (best != null && best.second >= STRONG_MATCH) return best.first.toTarget()

        // 2. Common phone apps (camera, settings, messages...) by their role, whichever app the phone uses.
        genericIntent(query)?.let { return AppTarget(spokenName.trim(), it) }

        // 3. A weaker name match is better than nothing.
        if (best != null && best.second >= WEAK_MATCH) return best.first.toTarget()
        return null
    }

    private fun matchScore(query: String, app: LauncherApp): Int {
        val byLabel = TextMatching.score(query, app.label)
        // Package names like "com.whatsapp" help when the label is in another language; capped so labels win.
        val byPackage = minOf(TextMatching.score(query, app.packageName.substringAfterLast('.')), 75)
        return maxOf(byLabel, byPackage)
    }

    private fun LauncherApp.toTarget(): AppTarget = AppTarget(
        label = label,
        intent = Intent(Intent.ACTION_MAIN)
            .addCategory(Intent.CATEGORY_LAUNCHER)
            .setComponent(ComponentName(packageName, activity))
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_RESET_TASK_IF_NEEDED),
    )

    private fun launcherApps(): List<LauncherApp> {
        val pm = context.packageManager
        val main = Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER)
        val infos = if (Build.VERSION.SDK_INT >= 33) {
            pm.queryIntentActivities(main, PackageManager.ResolveInfoFlags.of(0))
        } else {
            @Suppress("DEPRECATION")
            pm.queryIntentActivities(main, 0)
        }
        return infos.mapNotNull { info ->
            val activity = info.activityInfo ?: return@mapNotNull null
            if (activity.packageName == context.packageName) return@mapNotNull null // never "open JARVIS" from JARVIS
            LauncherApp(info.loadLabel(pm).toString(), activity.packageName, activity.name)
        }
    }

    private fun genericIntent(query: String): Intent? {
        val key = TextMatching.normalize(query)
        val intent = when (key) {
            "camera" -> Intent(MediaStore.INTENT_ACTION_STILL_IMAGE_CAMERA)
            "settings", "setting" -> Intent(Settings.ACTION_SETTINGS)
            "phone", "dialer", "call" -> Intent(Intent.ACTION_DIAL)
            "clock", "alarm", "alarms" -> Intent(AlarmClock.ACTION_SHOW_ALARMS)
            "gallery", "photos", "photo" -> category(Intent.CATEGORY_APP_GALLERY)
            "messages", "message", "messaging", "sms" -> category(Intent.CATEGORY_APP_MESSAGING)
            "calculator" -> category(Intent.CATEGORY_APP_CALCULATOR)
            "browser", "internet" -> category(Intent.CATEGORY_APP_BROWSER)
            "maps", "map" -> category(Intent.CATEGORY_APP_MAPS)
            "music" -> category(Intent.CATEGORY_APP_MUSIC)
            "email", "mail" -> category(Intent.CATEGORY_APP_EMAIL)
            "calendar" -> category(Intent.CATEGORY_APP_CALENDAR)
            "contacts", "contact" -> category(Intent.CATEGORY_APP_CONTACTS)
            else -> return null
        }
        return intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    }

    private fun category(category: String): Intent = Intent.makeMainSelectorActivity(Intent.ACTION_MAIN, category)

    private companion object {
        const val STRONG_MATCH = 78
        const val WEAK_MATCH = 40
    }
}

/** Hindi spellings and short names mapped to the English app names the phone uses. */
object AppAliases {
    private val aliases = mapOf(
        "यूट्यूब" to "youtube",
        "यू ट्यूब" to "youtube",
        "व्हाट्सएप" to "whatsapp",
        "व्हाट्सऐप" to "whatsapp",
        "वॉट्सऐप" to "whatsapp",
        "वाट्सएप" to "whatsapp",
        "व्हाट्स अप" to "whatsapp",
        "कैमरा" to "camera",
        "सेटिंग" to "settings",
        "सेटिंग्स" to "settings",
        "क्रोम" to "chrome",
        "गूगल" to "google",
        "फोन" to "phone",
        "फ़ोन" to "phone",
        "गैलरी" to "gallery",
        "कैलकुलेटर" to "calculator",
        "घड़ी" to "clock",
        "मैप्स" to "maps",
        "जीमेल" to "gmail",
        "फेसबुक" to "facebook",
        "इंस्टाग्राम" to "instagram",
        "टेलीग्राम" to "telegram",
        "स्पॉटिफाई" to "spotify",
        "नेटफ्लिक्स" to "netflix",
        "प्ले स्टोर" to "play store",
        "मैसेज" to "messages",
        "संदेश" to "messages",
        "कॉन्टैक्ट्स" to "contacts",
        "फोटोज" to "photos",
    )

    fun canonical(name: String): String = aliases[TextMatching.normalize(name)] ?: name
}

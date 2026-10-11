package com.imran.jarvis.actions

import android.Manifest
import android.content.ActivityNotFoundException
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.PackageManager
import android.media.AudioManager
import android.net.Uri
import android.os.BatteryManager
import android.os.Build
import android.provider.AlarmClock
import android.provider.Settings
import com.imran.jarvis.ai.JarvisAction
import com.imran.jarvis.ai.JarvisReply
import com.imran.jarvis.data.AppSettings
import com.imran.jarvis.i18n.Phrases
import com.imran.jarvis.service.JarvisNotificationListener
import java.time.LocalDate
import java.time.LocalTime
import kotlin.math.roundToInt

/** The result of trying to do what the AI asked. */
sealed interface ActionOutcome {

    /** Already done. [spoken] replaces the AI's sentence (used for time, battery, notifications). */
    data class Done(val spoken: String? = null) : ActionOutcome

    /**
     * Ready to open another screen or app. JARVIS finishes speaking first, THEN starts [intent]
     * (otherwise the new app would cut the voice off). [fallback] is tried if [intent] has no taker.
     */
    data class Launch(
        val intent: Intent,
        val spoken: String? = null,
        val fallback: Intent? = null,
    ) : ActionOutcome

    /** Could not do it. [spoken] explains why; the flags say what the user could grant to fix it. */
    data class Problem(
        val spoken: String,
        val permissions: List<String> = emptyList(),
        val needsNotificationAccess: Boolean = false,
    ) : ActionOutcome
}

/** The buttons on the Home screen. */
enum class QuickAction { CALL, WHATSAPP, YOUTUBE, FLASHLIGHT, ALARM }

/** Turns the AI's "action" + "target" into real things on the phone. */
class ActionExecutor(
    private val context: Context,
    private val torch: TorchController,
) {
    private val apps = AppFinder(context)
    private val contacts = ContactFinder(context)

    suspend fun execute(reply: JarvisReply, settings: AppSettings, phrases: Phrases): ActionOutcome {
        val target = reply.target
        return when (reply.action) {
            JarvisAction.NONE -> ActionOutcome.Done()

            // Hardware and information: no other app is opened.
            JarvisAction.FLASHLIGHT_ON -> flashlight(true, phrases)
            JarvisAction.FLASHLIGHT_OFF -> flashlight(false, phrases)
            JarvisAction.VOLUME_UP -> volume(up = true)
            JarvisAction.VOLUME_DOWN -> volume(up = false)
            JarvisAction.TIME -> time(target, phrases)
            JarvisAction.BATTERY -> battery(phrases)
            JarvisAction.READ_NOTIFICATIONS -> notifications(settings, phrases)

            // Calls and WhatsApp have their own permission checks.
            JarvisAction.CALL -> call(target, settings, phrases)
            JarvisAction.WHATSAPP -> whatsapp(target, settings, phrases)

            // These open another app or a system screen, so they need the "Open Apps" switch.
            JarvisAction.OPEN_APP -> openApps(settings, phrases) { openApp(target, phrases) }
            JarvisAction.YOUTUBE_SEARCH -> openApps(settings, phrases) { youtubeSearch(target) }
            JarvisAction.GOOGLE_SEARCH -> openApps(settings, phrases) { googleSearch(target) }
            JarvisAction.SET_ALARM -> openApps(settings, phrases) { alarm(target, phrases) }
            JarvisAction.SET_TIMER -> openApps(settings, phrases) { timer(target, phrases) }
            JarvisAction.OPEN_WIFI -> openApps(settings, phrases) { wifiSettings() }
            JarvisAction.OPEN_BLUETOOTH -> openApps(settings, phrases) {
                ActionOutcome.Launch(Intent(Settings.ACTION_BLUETOOTH_SETTINGS))
            }
        }
    }

    private inline fun openApps(settings: AppSettings, phrases: Phrases, block: () -> ActionOutcome): ActionOutcome =
        if (settings.openAppsEnabled) block() else ActionOutcome.Problem(phrases.openAppsOff)

    /** Starts [intent] from outside an Activity. Returns false if nothing on the phone can handle it. */
    fun start(intent: Intent, fallback: Intent? = null): Boolean {
        for (candidate in listOfNotNull(intent, fallback)) {
            try {
                context.startActivity(Intent(candidate).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
                return true
            } catch (_: ActivityNotFoundException) {
                // try the next one
            } catch (_: SecurityException) {
                // try the next one
            }
        }
        return false
    }

    /** What the Home screen buttons open. Flashlight is handled by [TorchController] instead. */
    fun quickIntent(action: QuickAction): Intent? = when (action) {
        QuickAction.CALL -> Intent(Intent.ACTION_DIAL)
        QuickAction.WHATSAPP -> whatsappPackage()?.let { launcherIntent(it) }
        QuickAction.YOUTUBE -> youtubeHome()
        QuickAction.ALARM -> Intent(AlarmClock.ACTION_SHOW_ALARMS)
        QuickAction.FLASHLIGHT -> null
    }

    // ---------- Simple things on the phone ----------

    private fun flashlight(on: Boolean, phrases: Phrases): ActionOutcome =
        if (torch.set(on)) ActionOutcome.Done() else ActionOutcome.Problem(phrases.noFlashlight)

    private fun volume(up: Boolean): ActionOutcome {
        val audio = context.getSystemService(AudioManager::class.java) ?: return ActionOutcome.Done()
        val max = audio.getStreamMaxVolume(AudioManager.STREAM_MUSIC)
        val step = maxOf(1, (max * 0.2f).roundToInt())
        val target = (audio.getStreamVolume(AudioManager.STREAM_MUSIC) + if (up) step else -step).coerceIn(0, max)
        try {
            audio.setStreamVolume(AudioManager.STREAM_MUSIC, target, AudioManager.FLAG_SHOW_UI)
        } catch (_: SecurityException) {
            // Some phones block volume changes in Do Not Disturb. Nothing more we can do.
        }
        return ActionOutcome.Done()
    }

    private fun time(target: String, phrases: Phrases): ActionOutcome {
        val text = target.lowercase()
        val wantsDate = listOf("date", "day", "तारीख", "तारिख", "दिन").any { it in text }
        return ActionOutcome.Done(if (wantsDate) phrases.dateToday(LocalDate.now()) else phrases.timeNow(LocalTime.now()))
    }

    private fun battery(phrases: Phrases): ActionOutcome {
        // The battery state is a "sticky" broadcast: registering with no receiver just returns the latest value.
        val intent = context.registerReceiver(null, IntentFilter(Intent.ACTION_BATTERY_CHANGED))
        val level = intent?.getIntExtra(BatteryManager.EXTRA_LEVEL, -1) ?: -1
        val scale = intent?.getIntExtra(BatteryManager.EXTRA_SCALE, -1) ?: -1
        val percent = if (level >= 0 && scale > 0) level * 100 / scale else {
            context.getSystemService(BatteryManager::class.java)
                ?.getIntProperty(BatteryManager.BATTERY_PROPERTY_CAPACITY) ?: 0
        }
        val status = intent?.getIntExtra(BatteryManager.EXTRA_STATUS, -1) ?: -1
        val charging = status == BatteryManager.BATTERY_STATUS_CHARGING || status == BatteryManager.BATTERY_STATUS_FULL
        return ActionOutcome.Done(phrases.battery(percent.coerceIn(0, 100), charging))
    }

    private fun notifications(settings: AppSettings, phrases: Phrases): ActionOutcome {
        if (!settings.notificationsEnabled) return ActionOutcome.Problem(phrases.notificationsOff)
        if (!Permissions.hasNotificationAccess(context)) {
            return ActionOutcome.Problem(phrases.notificationsOff, needsNotificationAccess = true)
        }
        val listener = JarvisNotificationListener.instance
            ?: return ActionOutcome.Problem(phrases.notificationsNotConnected)
        val items = listener.latest(MAX_NOTIFICATIONS_READ)
        return ActionOutcome.Done(
            if (items.isEmpty()) phrases.noNotifications else phrases.notificationsSummary(items),
        )
    }

    // ---------- Calls and WhatsApp ----------

    private suspend fun call(target: String, settings: AppSettings, phrases: Phrases): ActionOutcome {
        if (!settings.callsEnabled) return ActionOutcome.Problem(phrases.callsOff)
        val missing = Permissions.CALLS.filter { !Permissions.has(context, it) }
        if (missing.isNotEmpty()) return ActionOutcome.Problem(phrases.callsNeedPermission, missing)

        val name = target.trim()
        if (name.isEmpty()) return ActionOutcome.Launch(Intent(Intent.ACTION_DIAL)) // "call someone" -> open the dialer

        val number = if (looksLikePhoneNumber(name)) {
            name.filter { it.isDigit() || it == '+' }
        } else {
            when (val found = contacts.find(name)) {
                is ContactFinder.Result.Found -> found.contact.number.filter { it.isDigit() || it == '+' }
                is ContactFinder.Result.Ambiguous -> return ActionOutcome.Problem(phrases.contactAmbiguous(found.names))
                ContactFinder.Result.NotFound -> return ActionOutcome.Problem(phrases.contactNotFound(name))
            }
        }
        return ActionOutcome.Launch(Intent(Intent.ACTION_CALL, Uri.fromParts("tel", number, null)))
    }

    private suspend fun whatsapp(target: String, settings: AppSettings, phrases: Phrases): ActionOutcome {
        if (!settings.openAppsEnabled) return ActionOutcome.Problem(phrases.openAppsOff)
        val pkg = whatsappPackage() ?: return ActionOutcome.Problem(phrases.whatsappMissing)

        val name = target.substringBefore('|').trim()
        val message = target.substringAfter('|', "").trim()
        if (name.isEmpty()) {
            return launcherIntent(pkg)?.let { ActionOutcome.Launch(it) } ?: ActionOutcome.Problem(phrases.cantOpen)
        }

        if (!settings.callsEnabled) return ActionOutcome.Problem(phrases.callsOff)
        if (!Permissions.has(context, Manifest.permission.READ_CONTACTS)) {
            return ActionOutcome.Problem(phrases.callsNeedPermission, listOf(Manifest.permission.READ_CONTACTS))
        }

        val digits: String? = if (looksLikePhoneNumber(name)) {
            contacts.digitsForWhatsapp(name)
        } else {
            when (val found = contacts.find(name)) {
                is ContactFinder.Result.Found -> contacts.whatsappNumber(found.contact)
                is ContactFinder.Result.Ambiguous -> return ActionOutcome.Problem(phrases.contactAmbiguous(found.names))
                ContactFinder.Result.NotFound -> return ActionOutcome.Problem(phrases.contactNotFound(name))
            }
        }
        if (digits == null) return ActionOutcome.Problem(phrases.contactNotFound(name))

        val uri = Uri.parse("https://wa.me/$digits").buildUpon()
            .apply { if (message.isNotEmpty()) appendQueryParameter("text", message) }
            .build()
        return ActionOutcome.Launch(Intent(Intent.ACTION_VIEW, uri).setPackage(pkg))
    }

    // ---------- Apps, searches, alarms, settings ----------

    private fun openApp(target: String, phrases: Phrases): ActionOutcome {
        val app = apps.find(target) ?: return ActionOutcome.Problem(phrases.appNotFound(target.trim()))
        return ActionOutcome.Launch(app.intent)
    }

    private fun youtubeSearch(target: String): ActionOutcome {
        val query = target.trim()
        if (query.isEmpty()) return ActionOutcome.Launch(youtubeHome())
        val uri = Uri.parse("https://www.youtube.com/results?search_query=${Uri.encode(query)}")
        val intent = Intent(Intent.ACTION_VIEW, uri)
        if (isInstalled(YOUTUBE_PACKAGE)) intent.setPackage(YOUTUBE_PACKAGE)
        return ActionOutcome.Launch(intent)
    }

    private fun googleSearch(target: String): ActionOutcome {
        val uri = Uri.parse("https://www.google.com/search?q=${Uri.encode(target.trim())}")
        return ActionOutcome.Launch(Intent(Intent.ACTION_VIEW, uri))
    }

    private fun alarm(target: String, phrases: Phrases): ActionOutcome {
        val spec = TimeParsing.parseAlarm(target)
            ?: return ActionOutcome.Launch(Intent(AlarmClock.ACTION_SHOW_ALARMS), spoken = phrases.alarmTimeUnclear)
        val intent = Intent(AlarmClock.ACTION_SET_ALARM)
            .putExtra(AlarmClock.EXTRA_HOUR, spec.hour)
            .putExtra(AlarmClock.EXTRA_MINUTES, spec.minute)
            .putExtra(AlarmClock.EXTRA_MESSAGE, spec.label.ifBlank { "JARVIS" })
            .putExtra(AlarmClock.EXTRA_SKIP_UI, true)
        return ActionOutcome.Launch(intent, fallback = Intent(AlarmClock.ACTION_SHOW_ALARMS))
    }

    private fun timer(target: String, phrases: Phrases): ActionOutcome {
        val seconds = TimeParsing.parseTimerSeconds(target) ?: return ActionOutcome.Problem(phrases.timerUnclear)
        val intent = Intent(AlarmClock.ACTION_SET_TIMER)
            .putExtra(AlarmClock.EXTRA_LENGTH, seconds)
            .putExtra(AlarmClock.EXTRA_MESSAGE, "JARVIS")
            .putExtra(AlarmClock.EXTRA_SKIP_UI, true)
        return ActionOutcome.Launch(intent, fallback = Intent(AlarmClock.ACTION_SHOW_ALARMS))
    }

    private fun wifiSettings(): ActionOutcome {
        val wifi = Intent(Settings.ACTION_WIFI_SETTINGS)
        return if (Build.VERSION.SDK_INT >= 29) {
            // A small pop-up panel with the Wi-Fi switch, instead of a full Settings page.
            ActionOutcome.Launch(Intent(Settings.Panel.ACTION_INTERNET_CONNECTIVITY), fallback = wifi)
        } else {
            ActionOutcome.Launch(wifi)
        }
    }

    // ---------- Helpers ----------

    private fun youtubeHome(): Intent =
        launcherIntent(YOUTUBE_PACKAGE) ?: Intent(Intent.ACTION_VIEW, Uri.parse("https://www.youtube.com"))

    private fun whatsappPackage(): String? = WHATSAPP_PACKAGES.firstOrNull { isInstalled(it) }

    private fun launcherIntent(pkg: String): Intent? = context.packageManager.getLaunchIntentForPackage(pkg)

    private fun isInstalled(pkg: String): Boolean = try {
        if (Build.VERSION.SDK_INT >= 33) {
            context.packageManager.getPackageInfo(pkg, PackageManager.PackageInfoFlags.of(0))
        } else {
            @Suppress("DEPRECATION")
            context.packageManager.getPackageInfo(pkg, 0)
        }
        true
    } catch (_: PackageManager.NameNotFoundException) {
        false
    }

    private fun looksLikePhoneNumber(text: String): Boolean =
        PHONE_NUMBER.matches(text) && text.count { it.isDigit() } >= 5

    private companion object {
        const val YOUTUBE_PACKAGE = "com.google.android.youtube"
        val WHATSAPP_PACKAGES = listOf("com.whatsapp", "com.whatsapp.w4b")
        const val MAX_NOTIFICATIONS_READ = 3
        val PHONE_NUMBER = Regex("^[+()\\-\\s\\d]+$")
    }
}

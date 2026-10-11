package com.imran.jarvis.service

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import com.imran.jarvis.JarvisApplication

/** Turns always-on mode back on after the phone restarts or the app is updated. */
class BootReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != Intent.ACTION_BOOT_COMPLETED && intent.action != Intent.ACTION_MY_PACKAGE_REPLACED) return

        val app = context.applicationContext as? JarvisApplication ?: return
        if (!app.container.settings.settings.value.alwaysOn) return

        // Some Android versions do not let an app start itself at boot. Then a one-tap notification is shown instead.
        if (!AlwaysOnService.start(context)) AlwaysOnNotifications.postRestartHint(context)
    }
}

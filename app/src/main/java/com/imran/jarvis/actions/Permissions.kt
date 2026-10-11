package com.imran.jarvis.actions

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat

/** Simple "do we have this permission?" checks used by the actions and the Settings screen. */
object Permissions {

    /** Making a call needs the phone permission; finding "Rahul" in the address book needs contacts. */
    val CALLS = listOf(Manifest.permission.CALL_PHONE, Manifest.permission.READ_CONTACTS)

    fun has(context: Context, permission: String): Boolean =
        ContextCompat.checkSelfPermission(context, permission) == PackageManager.PERMISSION_GRANTED

    fun hasCalls(context: Context): Boolean = CALLS.all { has(context, it) }

    fun hasMic(context: Context): Boolean = has(context, Manifest.permission.RECORD_AUDIO)

    /** "Notification access" is a special permission the user switches on in system Settings. */
    fun hasNotificationAccess(context: Context): Boolean =
        NotificationManagerCompat.getEnabledListenerPackages(context).contains(context.packageName)
}

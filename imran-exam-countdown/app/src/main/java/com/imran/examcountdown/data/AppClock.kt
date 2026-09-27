package com.imran.examcountdown.data

import android.content.Context
import android.os.SystemClock
import android.provider.Settings
import com.imran.examcountdown.core.Moment
import java.time.Instant
import java.time.ZoneId

/** Current time for the whole app. Countdowns are always computed from this, never stored. */
object AppClock {
    /** Lets tests and screenshots pin the wall clock to a known moment. */
    @Volatile
    var pinnedWall: Long? = null

    fun now(): Long = pinnedWall ?: System.currentTimeMillis()

    fun moment(context: Context): Moment = Moment(now(), SystemClock.elapsedRealtime(), bootCount(context))

    /** Today's date on the device (used for "sessions today"). */
    fun localEpochDay(): Long = Instant.ofEpochMilli(now()).atZone(ZoneId.systemDefault()).toLocalDate().toEpochDay()

    private fun bootCount(context: Context): Int =
        try {
            Settings.Global.getInt(context.contentResolver, Settings.Global.BOOT_COUNT, -1)
        } catch (e: RuntimeException) {
            -1
        }
}

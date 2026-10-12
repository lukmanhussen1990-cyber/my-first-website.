package com.weplay.guesserai

import android.content.Context
import android.os.Build
import java.io.File
import java.io.PrintWriter
import java.io.StringWriter
import java.util.Date

/**
 * Keeps the last crash on the phone (it is never sent anywhere) so Home can show it and the user
 * can copy it: Android shows nothing for a first crash in the background, so the floating window
 * would just vanish without a word.
 */
object CrashLog {
    private const val FILE = "last_crash.txt"
    private const val MAX_CHARS = 8_000

    @Volatile private var app: Context? = null

    /** Safe to call again (tests start the app many times): one handler, and only the latest app is kept. */
    fun install(context: Context) {
        app = context.applicationContext
        val current = Thread.getDefaultUncaughtExceptionHandler()
        if (current !is Recorder) Thread.setDefaultUncaughtExceptionHandler(Recorder(current))
    }

    private class Recorder(private val previous: Thread.UncaughtExceptionHandler?) : Thread.UncaughtExceptionHandler {
        override fun uncaughtException(thread: Thread, e: Throwable) {
            app?.let { a -> runCatching { File(a.filesDir, FILE).writeText(report(a, thread, e)) } }
            // Then crash as before.
            if (previous != null) {
                previous.uncaughtException(thread, e)
            } else {
                System.err.print("Exception in thread \"${thread.name}\" ")
                e.printStackTrace()
            }
        }
    }

    /** The last crash report, or null; reads a file, so call it off the main thread. */
    fun read(context: Context): String? =
        runCatching { File(context.filesDir, FILE).takeIf { it.exists() }?.readText() }.getOrNull()

    fun clear(context: Context) {
        File(context.filesDir, FILE).delete()
    }

    internal fun report(context: Context, thread: Thread, e: Throwable): String {
        val version = runCatching { context.packageManager.getPackageInfo(context.packageName, 0).versionName }.getOrNull()
        val trace = StringWriter().also { e.printStackTrace(PrintWriter(it)) }.toString()
        return buildString {
            append("WePlay AI ").append(version).append(" · Android ").append(Build.VERSION.RELEASE)
            append(" · ").append(Build.MANUFACTURER).append(' ').append(Build.MODEL).append('\n')
            append(Date()).append(" · thread ").append(thread.name).append('\n')
            append(trace)
        }
            // A key never belongs in a report, whatever an error message carried.
            .replace(Regex("sk-ant-[A-Za-z0-9_\\-]+"), "sk-ant-…")
            .take(MAX_CHARS)
    }
}

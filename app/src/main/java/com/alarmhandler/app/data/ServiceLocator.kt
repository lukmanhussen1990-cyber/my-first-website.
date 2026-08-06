package com.alarmhandler.app.data

import android.content.Context
import com.alarmhandler.app.alarm.AlarmScheduler
import com.alarmhandler.app.data.backup.BackupManager
import com.alarmhandler.app.data.db.AlarmDatabase
import com.alarmhandler.app.data.prefs.SettingsRepository
import com.alarmhandler.app.data.repo.AlarmRepository
import com.alarmhandler.app.data.repo.HistoryRepository

/**
 * Hand-rolled dependency graph.
 *
 * The app has one database and one scheduler; a full DI framework would add a
 * build step and a lot of indirection for six objects. Everything is created
 * lazily from the application context so broadcast receivers and services can
 * reach it without the Activity being alive.
 */
object ServiceLocator {

    @Volatile
    private var appContext: Context? = null

    fun init(context: Context) {
        appContext = context.applicationContext
    }

    private fun requireContext(): Context = checkNotNull(appContext) {
        "ServiceLocator.init() must be called from Application.onCreate()"
    }

    private val database: AlarmDatabase by lazy { AlarmDatabase.get(requireContext()) }

    val scheduler: AlarmScheduler by lazy { AlarmScheduler(requireContext()) }

    val alarms: AlarmRepository by lazy { AlarmRepository(database.alarmDao(), scheduler) }

    val history: HistoryRepository by lazy { HistoryRepository(database.historyDao()) }

    val settings: SettingsRepository by lazy { SettingsRepository(requireContext()) }

    val backup: BackupManager by lazy { BackupManager(requireContext(), alarms, settings) }

    /** Entry point for components that only hold a Context. */
    fun from(context: Context): ServiceLocator {
        if (appContext == null) init(context)
        return this
    }
}

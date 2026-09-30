package com.runova.app

import android.app.Application
import com.runova.app.coach.CoachRepository
import com.runova.app.data.AppRepository
import com.runova.app.data.RunovaDatabase
import com.runova.app.data.SecretStore
import com.runova.app.data.SettingsStore
import com.runova.app.map.CartoTileProvider
import com.runova.app.tracking.HeartRateMonitor
import com.runova.app.tracking.Notifications
import com.runova.app.tracking.Reminders
import com.runova.app.tracking.RunSession
import com.runova.app.tracking.StepSamplerJob
import com.runova.app.tracking.StepsTracker
import com.runova.app.tracking.VoiceFeedback
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob

/** Process-wide objects, created once when the app starts. */
class AppGraph(val app: Application) {
    val scope = CoroutineScope(SupervisorJob() + Dispatchers.Default)
    val database = RunovaDatabase(app)
    val settings = SettingsStore(app)
    val secrets = SecretStore(app)
    val repository = AppRepository(app, database, settings, scope)
    val steps = StepsTracker(app, repository)
    val heartRate = HeartRateMonitor(app, scope)
    val voice = VoiceFeedback(app)
    val session = RunSession(app, repository, heartRate, voice, scope)
    val coach = CoachRepository(repository, secrets, scope)
    val darkTiles = CartoTileProvider(app, CartoTileProvider.Style.DARK, scope)
    val lightTiles = CartoTileProvider(app, CartoTileProvider.Style.LIGHT, scope)
}

class RunovaApp : Application() {
    lateinit var graph: AppGraph
        private set

    override fun onCreate() {
        super.onCreate()
        graph = AppGraph(this)
        Notifications.createChannels(this)
        Reminders.schedule(this, graph.settings.load())
        StepSamplerJob.schedule(this)
    }
}

val android.content.Context.graph: AppGraph get() = (applicationContext as RunovaApp).graph

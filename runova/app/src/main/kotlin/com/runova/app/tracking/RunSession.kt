package com.runova.app.tracking

import android.app.Application
import android.location.Location
import android.os.SystemClock
import com.runova.app.data.AppRepository
import com.runova.app.data.FinishedRun
import com.runova.app.data.LiveRow
import com.runova.app.data.PhotoRow
import com.runova.app.state.AppSettings
import com.runova.app.state.GpsQuality
import com.runova.app.state.RunVoice
import com.runova.app.state.UiEnv
import com.runova.app.state.recoverySummary
import com.runova.app.ui.model.GpsSignal
import com.runova.app.ui.model.LiveStatus
import com.runova.core.format.UnitConv
import com.runova.core.geo.LatLng
import com.runova.core.tracking.LocationSample
import com.runova.core.tracking.RunStatus
import com.runova.core.tracking.RunTracker
import com.runova.core.tracking.TrackerSnapshot
import com.runova.core.tracking.TrackingConfig
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlin.math.max

/**
 * The run being recorded. Owns the [RunTracker], feeds it GPS, step and heart-rate data, runs
 * the countdown and the one-second clock, speaks splits and checkpoints everything to the
 * database so a run survives the app being killed.
 *
 * All methods must be called on the main thread (sensor callbacks are delivered there too).
 */
class RunSession(
    private val app: Application,
    private val repository: AppRepository,
    private val heartRate: HeartRateMonitor,
    private val voice: VoiceFeedback,
    private val scope: CoroutineScope,
) {
    data class Live(
        val status: LiveStatus,
        val countdown: Int?,
        val startWallMs: Long,
        val snapshot: TrackerSnapshot?,
        val route: List<List<LatLng>>,
        val current: LatLng?,
        val gps: GpsSignal,
        val splitToast: String?,
        val photos: Int,
        /** Location access or the GPS provider is unavailable. */
        val gpsProblem: GpsProblem? = null,
    )

    enum class GpsProblem { NO_PERMISSION, PROVIDER_OFF }

    data class Recovery(val row: LiveRow, val summary: String)

    private val main = Dispatchers.Main.immediate
    private val liveState = MutableStateFlow<Live?>(null)
    val live: StateFlow<Live?> = liveState.asStateFlow()

    private val recoveryState = MutableStateFlow<Recovery?>(null)
    val recovery: StateFlow<Recovery?> = recoveryState.asStateFlow()

    private var tracker: RunTracker? = null
    private var lastFix: LocationSample? = null
    private var gpsProblem: GpsProblem? = null
    private var persistedPoints = 0
    private val photos = ArrayList<PhotoRow>()
    private var countdownJob: Job? = null
    private var tickJob: Job? = null
    private var toastJob: Job? = null
    private var splitToast: String? = null
    private var gpsLostAnnounced = false
    private var settings: AppSettings = repository.settings.load()

    // Route cache so each publish only converts the points that arrived since the last one.
    private val routeCache = ArrayList<ArrayList<LatLng>>()
    private var routeConsumed = 0
    private var lastSegment = -1
    private var publishedRoute: List<List<LatLng>> = emptyList()

    val isActive: Boolean get() = liveState.value != null

    init {
        scope.launch(main) {
            repository.settings.flow.collect { s ->
                settings = s
                tracker?.updateConfig(configFor(s))
            }
        }
        scope.launch(main) {
            heartRate.state.map { it.bpm }.distinctUntilChanged().collect { bpm ->
                val t = tracker ?: return@collect
                if (bpm == null) t.clearHeartRate() else t.onHeartRate(bpm, SystemClock.elapsedRealtime())
            }
        }
        scope.launch(main) {
            // Wait for the database, then look for a run that was interrupted by process death.
            repository.loaded.collect { loaded -> if (loaded) checkRecovery() }
        }
    }

    private fun configFor(s: AppSettings) = TrackingConfig(autoPause = s.autoPause, splitLengthM = UnitConv.unitMeters(s.units))

    // ---------------------------------------------------------------- control

    fun start() {
        if (isActive || recoveryState.value != null) return
        val s = settings
        gpsLostAnnounced = false
        liveState.value = Live(
            status = if (s.countdown) LiveStatus.COUNTDOWN else LiveStatus.RUNNING,
            countdown = if (s.countdown) 3 else null,
            startWallMs = System.currentTimeMillis(),
            snapshot = null,
            route = emptyList(),
            current = lastFix?.let { LatLng(it.lat, it.lng) },
            gps = gpsSignal(),
            splitToast = null,
            photos = 0,
            gpsProblem = gpsProblem,
        )
        // The service starts GPS now so the fix is ready when the countdown ends.
        RunTrackingService.start(app)
        if (s.voice) voice.prepare()
        heartRate.connectSaved(s)
        if (s.countdown) {
            countdownJob = scope.launch(main) {
                for (i in 3 downTo 1) {
                    liveState.value = liveState.value?.copy(countdown = i, gps = gpsSignal()) ?: return@launch
                    if (settings.voice) voice.speak(i.toString(), flush = true)
                    delay(1_000)
                }
                beginTracking()
            }
        } else {
            beginTracking()
        }
    }

    private fun beginTracking() {
        if (!isActive) return
        val s = settings
        val t = RunTracker(System.currentTimeMillis(), SystemClock.elapsedRealtime(), s.profile.body, configFor(s))
        tracker = t
        resetRoute()
        persistedPoints = 0
        photos.clear()
        if (s.voice) voice.speak("Run started. Let's go!", flush = true)
        publish()
        startTicker()
        persist()
    }

    fun pause() {
        val t = tracker ?: return
        if (t.status == RunStatus.PAUSED) return
        t.pause(SystemClock.elapsedRealtime())
        if (settings.voice) voice.speak(RunVoice.PAUSED, flush = true)
        publish()
        persist()
    }

    fun resume() {
        val t = tracker ?: return
        if (t.status == RunStatus.RUNNING) return
        t.resume(SystemClock.elapsedRealtime())
        if (settings.voice) voice.speak(RunVoice.RESUMED, flush = true)
        publish()
        persist()
    }

    /** Ends the run and stores it. Returns null when no run was being recorded. */
    suspend fun finish(): FinishedRun? {
        countdownJob?.cancel()
        val t = tracker
        if (t == null) {
            discard()
            return null
        }
        val summary = t.finish(SystemClock.elapsedRealtime(), System.currentTimeMillis())
        val points = t.points.toList()
        val runPhotos = photos.toList()
        stopRecording()
        if (settings.voice) voice.speak(RunVoice.finishAnnouncement(summary.distanceM, summary.movingTimeMs, settings.units), flush = true)
        return repository.saveRun(summary, points, runPhotos)
    }

    /** Throws the run away without saving it. */
    fun discard() {
        countdownJob?.cancel()
        stopRecording()
        scope.launch(repository.io) { repository.clearLive() }
    }

    private fun stopRecording() {
        tickJob?.cancel()
        toastJob?.cancel()
        tracker = null
        splitToast = null
        liveState.value = null
        resetRoute()
        photos.clear()
        RunTrackingService.stop(app)
        heartRate.releaseForRun()
    }

    // ---------------------------------------------------------------- sensor input

    fun onLocation(location: Location) {
        val sample = LocationSample(
            elapsedMs = location.elapsedRealtimeNanos / 1_000_000,
            wallTimeMs = location.time,
            lat = location.latitude,
            lng = location.longitude,
            altitude = if (location.hasAltitude()) location.altitude else null,
            horizontalAccuracy = if (location.hasAccuracy()) location.accuracy else null,
            verticalAccuracy = if (location.hasVerticalAccuracy()) location.verticalAccuracyMeters else null,
            speed = if (location.hasSpeed()) location.speed else null,
        )
        lastFix = sample
        gpsProblem = null
        gpsLostAnnounced = false
        val t = tracker
        if (t == null) {
            liveState.value = liveState.value?.copy(current = LatLng(sample.lat, sample.lng), gps = gpsSignal(), gpsProblem = null)
            return
        }
        val before = t.status
        t.onLocation(sample)
        onStatusChange(before, t.status)
        announceSplits(t)
        publish()
    }

    fun onStepCounter(totalSinceBoot: Long) {
        tracker?.onStepCounter(totalSinceBoot)
    }

    fun onGpsProblem(problem: GpsProblem?) {
        gpsProblem = problem
        liveState.value = liveState.value?.copy(gpsProblem = problem, gps = gpsSignal())
    }

    /** Called when the foreground service could not start (e.g. location permission revoked). */
    fun onServiceFailed() {
        countdownJob?.cancel()
        onGpsProblem(GpsProblem.NO_PERMISSION)
        val t = tracker
        if (t != null && t.status == RunStatus.RUNNING) pause()
    }

    suspend fun addPhoto(path: String) {
        val fix = lastFix
        val row = repository.addLivePhoto(path, System.currentTimeMillis(), fix?.lat, fix?.lng)
        if (!isActive) return
        photos.add(row)
        publish()
    }

    // ---------------------------------------------------------------- clock & publishing

    private fun startTicker() {
        tickJob?.cancel()
        tickJob = scope.launch(main) {
            var n = 0
            while (isActive) {
                delay(1_000)
                val t = tracker ?: break
                val before = t.status
                t.tick(SystemClock.elapsedRealtime())
                onStatusChange(before, t.status)
                checkGpsLost(t)
                publish()
                if (++n % CHECKPOINT_SECONDS == 0) persist()
            }
        }
    }

    private fun onStatusChange(before: RunStatus, after: RunStatus) {
        if (before == after || !settings.voice) return
        when {
            after == RunStatus.AUTO_PAUSED -> voice.speak(RunVoice.AUTO_PAUSED)
            before == RunStatus.AUTO_PAUSED && after == RunStatus.RUNNING -> voice.speak(RunVoice.RESUMED)
        }
    }

    private fun checkGpsLost(t: RunTracker) {
        if (t.status != RunStatus.RUNNING || gpsLostAnnounced) return
        val since = lastFix?.let { (SystemClock.elapsedRealtime() - it.elapsedMs) / 1000 } ?: return
        if (since >= 20) {
            gpsLostAnnounced = true
            if (settings.voice) voice.speak(RunVoice.GPS_LOST)
        }
    }

    private fun announceSplits(t: RunTracker) {
        val events = t.drainSplitEvents()
        if (events.isEmpty()) return
        val e = events.last()
        val units = settings.units
        splitToast = RunVoice.splitToast(e, units)
        if (settings.voice) voice.speak(RunVoice.splitAnnouncement(e, units))
        toastJob?.cancel()
        toastJob = scope.launch(main) {
            delay(4_000)
            splitToast = null
            publish()
        }
    }

    private fun gpsSignal(now: Long = SystemClock.elapsedRealtime()): GpsSignal {
        if (gpsProblem != null) return GpsSignal.NONE
        val fix = lastFix ?: return GpsSignal.NONE
        return GpsQuality.classify(fix.horizontalAccuracy, (now - fix.elapsedMs) / 1000)
    }

    private fun publish() {
        val t = tracker ?: return
        val now = SystemClock.elapsedRealtime()
        val snap = t.snapshot(now)
        liveState.value = Live(
            status = when (t.status) {
                RunStatus.RUNNING -> LiveStatus.RUNNING
                RunStatus.AUTO_PAUSED -> LiveStatus.AUTO_PAUSED
                else -> LiveStatus.PAUSED
            },
            countdown = null,
            startWallMs = t.startWallTimeMs,
            snapshot = snap,
            route = route(t),
            current = lastFix?.let { LatLng(it.lat, it.lng) } ?: snap.lastLocation,
            gps = gpsSignal(now),
            splitToast = splitToast,
            photos = photos.size,
            gpsProblem = gpsProblem,
        )
    }

    private fun resetRoute() {
        routeCache.clear()
        routeConsumed = 0
        lastSegment = -1
        publishedRoute = emptyList()
    }

    private fun route(t: RunTracker): List<List<LatLng>> {
        val points = t.points
        if (routeConsumed == points.size) return publishedRoute
        while (routeConsumed < points.size) {
            val p = points[routeConsumed++]
            if (routeCache.isEmpty() || p.segment != lastSegment) {
                routeCache.add(ArrayList())
                lastSegment = p.segment
            }
            routeCache.last().add(LatLng(p.lat, p.lng))
        }
        publishedRoute = routeCache.map { it.toList() }
        return publishedRoute
    }

    private fun persist() {
        val t = tracker ?: return
        val points = t.points
        val from = persistedPoints
        val fresh = if (points.size > from) points.subList(from, points.size).toList() else emptyList()
        persistedPoints = points.size
        val checkpoint = t.checkpoint(SystemClock.elapsedRealtime())
        val paused = t.status != RunStatus.RUNNING
        val start = t.startWallTimeMs
        // Same serial dispatcher as saveRun/clearLive, so a late checkpoint can't outlive the run.
        scope.launch(repository.io) { repository.saveLive(start, paused, checkpoint, fresh, from) }
    }

    // ---------------------------------------------------------------- recovery

    private suspend fun checkRecovery() {
        if (isActive || recoveryState.value != null) return
        val row = repository.loadLive() ?: return
        if (isActive) return
        if (row.points.isEmpty() && row.checkpoint.movingTimeMs < 10_000) {
            repository.clearLive()
            return
        }
        val summary = recoverySummary(row.startWallMs, row.checkpoint.distanceM, row.checkpoint.movingTimeMs, settings.units, UiEnv.system())
        recoveryState.value = Recovery(row, summary)
    }

    private fun restore(row: LiveRow): RunTracker =
        RunTracker.restore(row.startWallMs, SystemClock.elapsedRealtime(), settings.profile.body, configFor(settings), row.points, row.checkpoint)

    /** Continues the interrupted run in a new route segment. */
    fun resumeRecovered() {
        val r = recoveryState.value ?: return
        recoveryState.value = null
        val t = restore(r.row)
        tracker = t
        resetRoute()
        persistedPoints = r.row.points.size
        photos.clear()
        photos.addAll(r.row.photos)
        liveState.value = Live(LiveStatus.PAUSED, null, t.startWallTimeMs, t.snapshot(), emptyList(), null, gpsSignal(), null, photos.size, gpsProblem)
        RunTrackingService.start(app)
        if (settings.voice) voice.prepare()
        heartRate.connectSaved(settings)
        t.resume(SystemClock.elapsedRealtime())
        publish()
        startTicker()
        persist()
    }

    /** Saves the interrupted run as it was when it stopped. */
    suspend fun saveRecovered(): FinishedRun? {
        val r = recoveryState.value ?: return null
        recoveryState.value = null
        val t = restore(r.row)
        val endWall = max(r.row.updatedMs, r.row.points.lastOrNull()?.wallTimeMs ?: r.row.startWallMs)
        val summary = t.finish(SystemClock.elapsedRealtime(), endWall)
        return repository.saveRun(summary, r.row.points, r.row.photos)
    }

    fun discardRecovered() {
        if (recoveryState.value == null) return
        recoveryState.value = null
        scope.launch(repository.io) { repository.clearLive() }
    }

    private companion object {
        const val CHECKPOINT_SECONDS = 5
    }
}

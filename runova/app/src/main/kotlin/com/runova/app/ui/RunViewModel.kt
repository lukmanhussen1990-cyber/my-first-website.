package com.runova.app.ui

import android.app.Application
import android.content.Intent
import androidx.compose.ui.graphics.asImageBitmap
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.runova.app.graph
import com.runova.app.share.Images
import com.runova.app.share.Sharing
import com.runova.app.state.AppSettings
import com.runova.app.state.UiEnv
import com.runova.app.state.UiMapper
import com.runova.app.tracking.HeartRateMonitor
import com.runova.app.tracking.RunSession
import com.runova.app.ui.model.HrConnection
import com.runova.app.ui.model.PhotoUi
import com.runova.app.ui.model.RunCompleteUiState
import com.runova.app.ui.model.RunDetailsUiState
import com.runova.app.ui.model.RunningUiState
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.io.File

/** The live run, the post-run summary and run details. */
class RunViewModel(app: Application) : AndroidViewModel(app) {
    private val graph = app.graph
    private val session = graph.session
    private val repo = graph.repository

    val running: StateFlow<RunningUiState?> = combine(session.live, repo.data.map { it.settings }, graph.heartRate.state) { live, s, hr ->
        live?.let { toUi(it, s, hr) }
    }.stateIn(viewModelScope, SharingStarted.Eagerly, null)

    val recovery: StateFlow<RunSession.Recovery?> = session.recovery

    private val completionState = MutableStateFlow<RunCompleteUiState?>(null)
    val completion: StateFlow<RunCompleteUiState?> = completionState.asStateFlow()

    private val savingState = MutableStateFlow(false)
    val saving: StateFlow<Boolean> = savingState.asStateFlow()

    private fun toUi(live: RunSession.Live, s: AppSettings, hr: HeartRateMonitor.State): RunningUiState {
        val snap = live.snapshot
        val problem = when (live.gpsProblem) {
            RunSession.GpsProblem.NO_PERMISSION -> "Allow precise location to track your route"
            RunSession.GpsProblem.PROVIDER_OFF -> "Location is off. Turn it on to track your route"
            null -> null
        }
        return RunningUiState(
            status = live.status,
            countdown = live.countdown,
            distanceM = snap?.distanceM ?: 0.0,
            movingTimeMs = snap?.movingTimeMs ?: 0,
            currentPaceSecPerKm = snap?.currentPaceSecPerKm,
            avgPaceSecPerKm = snap?.avgPaceSecPerKm,
            calories = snap?.calories ?: 0.0,
            heartRate = hr.bpm ?: snap?.heartRate,
            heartRateConnected = hr.connection == HrConnection.CONNECTED,
            steps = snap?.steps ?: 0,
            stepsEstimated = snap?.stepsEstimated ?: false,
            gps = live.gps,
            route = live.route,
            current = live.current,
            units = s.units,
            photos = live.photos,
            splitToast = live.splitToast ?: problem,
            voiceEnabled = s.voice,
            autoPauseEnabled = s.autoPause,
            keepScreenOn = s.keepScreenOn,
        )
    }

    // ---------------------------------------------------------------- live run control

    fun start() = session.start()
    fun pause() = session.pause()
    fun resume() = session.resume()
    fun discard() = session.discard()

    /** Saves the run; [onSaved] receives the new run's id once the summary is ready. */
    fun finish(onSaved: (Long) -> Unit) {
        if (savingState.value) return
        savingState.value = true
        // The app scope keeps saving even if this screen goes away.
        graph.scope.launch(Dispatchers.Main.immediate) {
            try {
                val finished = session.finish() ?: return@launch
                completionState.value = UiMapper.runComplete(finished.run, finished.rewards, repo.settings.load().units)
                onSaved(finished.run.id)
            } finally {
                savingState.value = false
            }
        }
    }

    fun resumeRecovered() = session.resumeRecovered()
    fun discardRecovered() = session.discardRecovered()

    fun saveRecovered(onSaved: (Long) -> Unit) {
        graph.scope.launch(Dispatchers.Main.immediate) {
            val finished = session.saveRecovered() ?: return@launch
            completionState.value = UiMapper.runComplete(finished.run, finished.rewards, repo.settings.load().units)
            onSaved(finished.run.id)
        }
    }

    fun clearCompletion() {
        completionState.value = null
    }

    fun setVoice(on: Boolean) {
        repo.updateSettings { it.copy(voice = on) }
    }

    fun setAutoPause(on: Boolean) {
        repo.updateSettings { it.copy(autoPause = on) }
    }

    fun setKeepScreenOn(on: Boolean) {
        repo.updateSettings { it.copy(keepScreenOn = on) }
    }

    fun newPhotoFile(): File = Images.newPhotoFile(getApplication())

    fun photoTaken(file: File, ok: Boolean) {
        viewModelScope.launch {
            if (ok && file.length() > 0) session.addPhoto(file.path) else withContext(Dispatchers.IO) { file.delete() }
        }
    }

    // ---------------------------------------------------------------- details

    private val detailsCache = HashMap<Long, MutableStateFlow<RunDetailsUiState?>>()

    fun details(runId: Long): StateFlow<RunDetailsUiState?> {
        detailsCache[runId]?.let { return it }
        val flow = MutableStateFlow<RunDetailsUiState?>(null)
        detailsCache[runId] = flow
        viewModelScope.launch {
            val run = repo.run(runId) ?: return@launch
            val points = repo.points(runId)
            val units = repo.settings.load().units
            val photos = withContext(Dispatchers.IO) {
                repo.photos(runId).map { PhotoUi(it.id, Images.decodeSampled(it.path, 720)?.asImageBitmap()) }
            }
            flow.value = withContext(Dispatchers.Default) { UiMapper.runDetails(run, points, photos, units, UiEnv.system()) }
        }
        return flow
    }

    /** Units changed or a run was edited: drop cached details. */
    fun invalidateDetails() = detailsCache.clear()

    suspend fun shareIntent(runId: Long): Intent? = withContext(Dispatchers.IO) {
        val run = repo.run(runId) ?: return@withContext null
        val route = UiMapper.thumbnailRoute(repo.points(runId))
        Sharing.runCard(getApplication(), run, route, repo.settings.load().units, UiMapper.runDateText(run.startTimeMs, UiEnv.system()))
    }

    suspend fun gpxIntent(runId: Long): Intent? = withContext(Dispatchers.IO) {
        val run = repo.run(runId) ?: return@withContext null
        Sharing.gpx(getApplication(), run, repo.points(runId))
    }

    fun deleteRun(runId: Long, onDone: () -> Unit) {
        viewModelScope.launch {
            repo.deleteRun(runId)
            detailsCache.remove(runId)
            onDone()
        }
    }
}

package com.runova.app.ui

import android.app.Application
import android.content.Intent
import android.net.Uri
import androidx.compose.ui.graphics.ImageBitmap
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.runova.app.BuildConfig
import com.runova.app.graph
import com.runova.app.share.Images
import com.runova.app.share.Sharing
import com.runova.app.state.AppData
import com.runova.app.state.AppSettings
import com.runova.app.state.UiEnv
import com.runova.app.state.UiMapper
import com.runova.app.tracking.Reminders
import com.runova.app.ui.model.AchievementsUiState
import com.runova.app.ui.model.ActiveRunBanner
import com.runova.app.ui.model.GoalsUiState
import com.runova.app.ui.model.HeartRateUiState
import com.runova.app.ui.model.HistoryFilter
import com.runova.app.ui.model.HistorySort
import com.runova.app.ui.model.HistoryUiState
import com.runova.app.ui.model.HomeUiState
import com.runova.app.ui.model.HrConnection
import com.runova.app.ui.model.InboxItemUi
import com.runova.app.ui.model.LiveStatus
import com.runova.app.ui.model.MapStyle
import com.runova.app.ui.model.PersonalInfoUiState
import com.runova.app.ui.model.ProfileUiState
import com.runova.app.ui.model.SettingsUiState
import com.runova.app.ui.model.StatsMetric
import com.runova.app.ui.model.StatsUiState
import com.runova.app.ui.model.ThemeMode
import com.runova.app.ui.screens.OnboardingDraft
import com.runova.app.state.UserProfile
import com.runova.core.coach.CoachEngine
import com.runova.core.model.GoalPeriod
import com.runova.core.model.GoalTargets
import com.runova.core.model.UnitSystem
import com.runova.core.progress.Achievements
import com.runova.core.stats.StatsRange
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.flow
import kotlinx.coroutines.flow.flowOn
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

/** State and actions for the tab screens, progress, profile and settings. */
class MainViewModel(app: Application) : AndroidViewModel(app) {
    private val graph = app.graph
    private val repo = graph.repository

    val data: StateFlow<AppData> = repo.data
    val loaded: StateFlow<Boolean> = repo.loaded

    /** Re-emits every minute so greetings and relative times stay current. */
    private val clock: StateFlow<UiEnv> = flow {
        while (true) {
            emit(UiEnv.system())
            delay(60_000)
        }
    }.stateIn(viewModelScope, SharingStarted.Eagerly, UiEnv.system())

    private fun <T> Flow<T>.state(initial: T): StateFlow<T> = flowOn(Dispatchers.Default).stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), initial)

    // ---------------------------------------------------------------- home

    private val selectedDay = MutableStateFlow<Int?>(null)

    private val coachTip: StateFlow<String?> = combine(data, clock) { d, env ->
        CoachEngine.insights(UiMapper.coachSnapshot(d, env)).firstOrNull()?.text
    }.state(null)

    private val activeRun: Flow<ActiveRunBanner?> = graph.session.live.map { live ->
        val snap = live?.snapshot
        if (live == null) null
        else ActiveRunBanner(snap?.distanceM ?: 0.0, snap?.movingTimeMs ?: 0, live.status != LiveStatus.RUNNING && live.status != LiveStatus.COUNTDOWN)
    }

    val home: StateFlow<HomeUiState?> = combine(data, clock, selectedDay, activeRun, coachTip) { d, env, day, run, tip ->
        UiMapper.home(d, env, day, run, tip)
    }.state(null)

    fun selectDay(index: Int) {
        selectedDay.value = index.takeIf { it != UiMapper.todayIndex(clock.value) }
    }

    // ---------------------------------------------------------------- stats

    private val statsRange = MutableStateFlow(StatsRange.WEEK)
    private val statsMetric = MutableStateFlow(StatsMetric.CALORIES)
    private val statsOffset = MutableStateFlow(0)

    val stats: StateFlow<StatsUiState?> = combine(data, clock, statsRange, statsMetric, statsOffset) { d, env, range, metric, offset ->
        UiMapper.stats(d, env, range, metric, offset)
    }.state(null)

    fun setStatsRange(range: StatsRange) {
        statsRange.value = range
        statsOffset.value = 0
    }

    fun setStatsMetric(metric: StatsMetric) {
        statsMetric.value = metric
    }

    fun shiftStats(by: Int) {
        statsOffset.value = (statsOffset.value + by).coerceAtMost(0)
    }

    // ---------------------------------------------------------------- history

    private val historySort = MutableStateFlow(HistorySort.NEWEST)
    private val historyFilter = MutableStateFlow(HistoryFilter.ALL)

    val history: StateFlow<HistoryUiState?> = combine(data, clock, historySort, historyFilter) { d, env, sort, filter ->
        UiMapper.history(d, env, sort, filter)
    }.state(null)

    fun setHistorySort(sort: HistorySort) {
        historySort.value = sort
    }

    fun setHistoryFilter(filter: HistoryFilter) {
        historyFilter.value = filter
    }

    // ---------------------------------------------------------------- goals

    private val goalsPeriod = MutableStateFlow(GoalPeriod.DAILY)

    val goals: StateFlow<GoalsUiState?> = combine(data, clock, goalsPeriod) { d, env, p -> UiMapper.goals(d, env, p) }.state(null)

    fun setGoalsPeriod(period: GoalPeriod) {
        goalsPeriod.value = period
    }

    fun saveTargets(period: GoalPeriod, targets: GoalTargets) {
        repo.updateSettings { it.copy(goals = it.goals.with(period, targets)) }
        // A lowered target can be complete already.
        settlePending()
    }

    fun settlePending() {
        viewModelScope.launch { repo.settlePendingRewards() }
    }

    // ---------------------------------------------------------------- achievements

    private val featured = MutableStateFlow<String?>(null)
    private val celebrate = MutableStateFlow(false)

    val achievements: StateFlow<AchievementsUiState?> = combine(data, clock, featured, celebrate) { d, env, f, c ->
        UiMapper.achievements(d, env, f, c)
    }.state(null)

    /** Opens the achievements screen celebrating the newest unseen unlock, if any. */
    fun prepareAchievements(celebrateNew: Boolean) {
        val d = data.value
        val newest = d.progress.unlocked.filterKeys { it !in d.progress.acknowledged }.maxByOrNull { it.value }?.key
        featured.value = newest
        celebrate.value = celebrateNew && newest != null
    }

    fun selectAchievement(id: String) {
        featured.value = id
        celebrate.value = false
    }

    fun acknowledgeAchievements() {
        celebrate.value = false
        val d = data.value
        val unseen = d.progress.unlocked.keys - d.progress.acknowledged
        viewModelScope.launch { repo.acknowledgeAchievements(unseen) }
    }

    fun shareAchievement(id: String): Intent? {
        val def = Achievements.def(id) ?: return null
        val unlocked = id in data.value.progress.unlocked
        val text = if (unlocked) "🏅 I unlocked \"${def.title}\" on RUNOVA! ${def.unlockText} #RunBurnLevelUp"
        else "🎯 Working towards \"${def.title}\" on RUNOVA: ${def.description}"
        return Sharing.text(text, "Share achievement")
    }

    // ---------------------------------------------------------------- profile & personal info

    private val avatar = MutableStateFlow<ImageBitmap?>(null)

    init {
        reloadAvatar()
    }

    private fun reloadAvatar() {
        viewModelScope.launch { avatar.value = withContext(Dispatchers.IO) { Images.loadAvatar(getApplication()) } }
    }

    fun setAvatar(uri: Uri) {
        viewModelScope.launch {
            val ok = withContext(Dispatchers.IO) { Images.saveAvatar(getApplication(), uri) }
            if (ok) reloadAvatar()
        }
    }

    fun removeAvatar() {
        viewModelScope.launch {
            withContext(Dispatchers.IO) { Images.removeAvatar(getApplication()) }
            avatar.value = null
        }
    }

    private fun heartRateStatus(s: AppSettings, hr: com.runova.app.tracking.HeartRateMonitor.State): String = when (hr.connection) {
        HrConnection.CONNECTED -> hr.bpm?.let { "Connected • $it bpm" } ?: "Connected"
        HrConnection.CONNECTING -> "Connecting…"
        HrConnection.DISCONNECTED -> s.heartRateName?.let { "$it (not connected)" } ?: "Not connected"
    }

    val profile: StateFlow<ProfileUiState?> = combine(data, clock, avatar, graph.heartRate.state) { d, env, a, hr ->
        UiMapper.profile(d, env, a, heartRateStatus(d.settings, hr), hr.connection == HrConnection.CONNECTED)
    }.state(null)

    val personal: StateFlow<PersonalInfoUiState?> = combine(data, avatar) { d, a -> UiMapper.personalInfo(d, a) }.state(null)

    fun savePersonal(p: PersonalInfoUiState) {
        repo.updateSettings {
            it.copy(
                profile = UserProfile(p.name.trim().take(40), p.sex, p.age.coerceIn(10, 100), p.heightCm.coerceIn(100.0, 250.0), p.weightKg.coerceIn(25.0, 350.0)),
                units = p.units,
            )
        }
    }

    // ---------------------------------------------------------------- heart rate

    val heartRate: StateFlow<HeartRateUiState> = graph.heartRate.state.map { s ->
        HeartRateUiState(s.supported, s.bluetoothOn, s.permissionGranted, s.scanning, s.devices, s.connection, s.deviceName, s.bpm)
    }.state(HeartRateUiState(false, false, false, false, emptyList(), HrConnection.DISCONNECTED, null, null))

    fun refreshHeartRate() = graph.heartRate.refresh()
    fun scanHeartRate() = graph.heartRate.startScan()
    fun stopHeartRateScan() = graph.heartRate.stopScan()

    fun connectHeartRate(address: String) {
        val name = graph.heartRate.state.value.devices.firstOrNull { it.address == address }?.name
        repo.updateSettings { it.copy(heartRateAddress = address, heartRateName = name) }
        graph.heartRate.connect(address, name)
    }

    fun disconnectHeartRate() {
        graph.heartRate.disconnect()
        repo.updateSettings { it.copy(heartRateAddress = null, heartRateName = null) }
    }

    // ---------------------------------------------------------------- notifications

    val inbox: StateFlow<List<InboxItemUi>> = combine(data, clock) { d, env -> UiMapper.inbox(d, env) }.state(emptyList())

    fun markAllRead() {
        viewModelScope.launch { repo.markInboxRead(null) }
    }

    fun markRead(id: Long) {
        viewModelScope.launch { repo.markInboxRead(id) }
    }

    /** Where an inbox item leads: a run, the achievements, or the goals. */
    fun inboxTarget(id: Long): String? {
        val ref = data.value.inbox.firstOrNull { it.id == id }?.ref ?: return null
        return when {
            ref.startsWith("run:") -> ref.removePrefix("run:").toLongOrNull()?.let { Routes.details(it) }
            ref.startsWith("achievement:") -> Routes.ACHIEVEMENTS.also { selectAchievement(ref.removePrefix("achievement:")) }
            ref.startsWith("goal:") -> Routes.GOALS
            else -> null
        }
    }

    // ---------------------------------------------------------------- settings

    private val claudeTestResult = MutableStateFlow<String?>(null)
    private val claudeTesting = MutableStateFlow(false)

    val settings: StateFlow<SettingsUiState> = combine(data, graph.secrets.hasApiKey, claudeTestResult, claudeTesting) { d, key, result, testing ->
        UiMapper.settings(d, key, result, testing, BuildConfig.VERSION_NAME)
    }.state(UiMapper.settings(data.value, false, null, false, BuildConfig.VERSION_NAME))

    fun update(transform: (AppSettings) -> AppSettings) {
        val next = repo.updateSettings(transform)
        Reminders.schedule(getApplication(), next)
    }

    fun setUnits(u: UnitSystem) = update { it.copy(units = u) }
    fun setVoice(on: Boolean) = update { it.copy(voice = on) }
    fun setAutoPause(on: Boolean) = update { it.copy(autoPause = on) }
    fun setKeepScreenOn(on: Boolean) = update { it.copy(keepScreenOn = on) }
    fun setCountdown(on: Boolean) = update { it.copy(countdown = on) }
    fun setTheme(t: ThemeMode) = update { it.copy(theme = t) }
    fun setMapStyle(m: MapStyle) = update { it.copy(mapStyle = m) }
    fun setReminder(on: Boolean) = update { it.copy(reminderEnabled = on) }
    fun setReminderTime(h: Int, m: Int) = update { it.copy(reminderHour = h, reminderMinute = m) }

    fun setModel(id: String) {
        update { it.copy(claudeModel = id) }
        claudeTestResult.value = null
    }

    fun saveApiKey(key: String) {
        val trimmed = key.trim()
        if (trimmed.length < 20) return
        viewModelScope.launch {
            withContext(Dispatchers.IO) { graph.secrets.setApiKey(trimmed) }
            testApi()
        }
    }

    fun clearApiKey() {
        graph.coach.forgetKey()
        claudeTestResult.value = null
    }

    fun testApi() {
        if (claudeTesting.value) return
        claudeTesting.value = true
        claudeTestResult.value = null
        viewModelScope.launch {
            try {
                claudeTestResult.value = graph.coach.testConnection()
            } finally {
                claudeTesting.value = false
            }
        }
    }

    suspend fun exportAll(): Intent? = withContext(Dispatchers.IO) {
        val runs = data.value.runs
        if (runs.isEmpty()) return@withContext null
        Sharing.allGpx(getApplication(), runs.map { it to repo.points(it.id) })
    }

    /** Wipes all data; [onDone] runs on the main thread afterwards. */
    fun deleteEverything(onDone: () -> Unit) {
        viewModelScope.launch {
            graph.session.discard()
            graph.heartRate.disconnect()
            graph.coach.clear()
            graph.coach.forgetKey()
            repo.deleteEverything()
            avatar.value = null
            Reminders.schedule(getApplication(), repo.settings.load())
            onDone()
        }
    }

    // ---------------------------------------------------------------- onboarding

    fun finishOnboarding(draft: OnboardingDraft) {
        update { s ->
            val daily = s.goals.daily.copy(distanceKm = draft.dailyDistanceKm, calories = draft.dailyCalories)
            s.copy(
                onboarded = true,
                profile = UserProfile(draft.name.trim().take(40), draft.sex, draft.age, draft.heightCm, draft.weightKg),
                units = draft.units,
                goals = s.goals.copy(daily = daily),
            )
        }
    }
}

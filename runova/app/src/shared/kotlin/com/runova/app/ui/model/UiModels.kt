package com.runova.app.ui.model

import androidx.compose.runtime.Immutable
import androidx.compose.ui.graphics.ImageBitmap
import com.runova.core.coach.CoachInsight
import com.runova.core.geo.LatLng
import com.runova.core.model.GoalMetric
import com.runova.core.model.GoalPeriod
import com.runova.core.model.GoalTargets
import com.runova.core.model.UnitSystem
import com.runova.core.progress.AchievementDef
import com.runova.core.progress.LevelProgress
import com.runova.core.stats.StatsRange
import com.runova.core.tracking.SeriesPoint
import com.runova.core.tracking.Split

// ------------------------------------------------------------------------------------ home

@Immutable
data class DayChip(val label: String, val isToday: Boolean, val hasActivity: Boolean, val isFuture: Boolean)

@Immutable
data class DaySummaryUi(
    val calories: Int,
    val caloriesGoal: Int,
    val steps: Int,
    val stepsEstimated: Boolean,
    val distanceM: Double,
    val activeMinutes: Int,
    /** Average completion of the four daily goals, 0..1. */
    val progress: Float,
)

@Immutable
data class ActiveRunBanner(val distanceM: Double, val movingTimeMs: Long, val paused: Boolean)

@Immutable
data class HomeUiState(
    val greeting: String,
    val name: String,
    val hasUnread: Boolean,
    val week: List<DayChip>,
    val selectedDay: Int,
    val day: DaySummaryUi,
    val coachTip: String?,
    val activeRun: ActiveRunBanner?,
    val units: UnitSystem,
    val streak: Int,
)

// ------------------------------------------------------------------------------------ running

enum class GpsSignal { NONE, WEAK, FAIR, GOOD }

enum class LiveStatus { COUNTDOWN, RUNNING, PAUSED, AUTO_PAUSED }

@Immutable
data class RunningUiState(
    val status: LiveStatus,
    val countdown: Int? = null,
    val distanceM: Double = 0.0,
    val movingTimeMs: Long = 0,
    val currentPaceSecPerKm: Double? = null,
    val avgPaceSecPerKm: Double? = null,
    val calories: Double = 0.0,
    val heartRate: Int? = null,
    val heartRateConnected: Boolean = false,
    val steps: Int = 0,
    val stepsEstimated: Boolean = false,
    val gps: GpsSignal = GpsSignal.NONE,
    val route: List<List<LatLng>> = emptyList(),
    val current: LatLng? = null,
    val units: UnitSystem = UnitSystem.METRIC,
    val photos: Int = 0,
    val splitToast: String? = null,
    val voiceEnabled: Boolean = true,
    val autoPauseEnabled: Boolean = false,
    val keepScreenOn: Boolean = true,
)

// ------------------------------------------------------------------------------------ run complete

@Immutable
data class XpLine(val label: String, val amount: Int)

@Immutable
data class RunCompleteUiState(
    val runId: Long,
    val distanceM: Double,
    val movingTimeMs: Long,
    val avgPaceSecPerKm: Double?,
    val calories: Double,
    val units: UnitSystem,
    val xpLines: List<XpLine>,
    val xpGained: Int,
    val levelBefore: LevelProgress,
    val levelAfter: LevelProgress,
    val newAchievements: List<AchievementDef>,
    val goalsCompleted: List<String>,
)

// ------------------------------------------------------------------------------------ details

@Immutable
data class PhotoUi(val id: Long, val image: ImageBitmap?)

@Immutable
data class RunDetailsUiState(
    val runId: Long,
    val title: String,
    val dateText: String,
    val distanceM: Double,
    val movingTimeMs: Long,
    val elapsedTimeMs: Long,
    val avgPaceSecPerKm: Double?,
    val calories: Double,
    val steps: Int?,
    val stepsEstimated: Boolean,
    val elevationGainM: Double,
    val elevationLossM: Double,
    val maxSpeedMps: Double,
    val avgHeartRate: Int?,
    val maxHeartRate: Int?,
    val xpEarned: Int,
    val route: List<List<LatLng>>,
    val splits: List<Split>,
    val paceSeries: List<SeriesPoint>,
    val elevationSeries: List<SeriesPoint>,
    val heartRateSeries: List<SeriesPoint>,
    val photos: List<PhotoUi>,
    val units: UnitSystem,
)

// ------------------------------------------------------------------------------------ achievements

@Immutable
data class AchievementItemUi(
    val def: AchievementDef,
    val fraction: Float,
    val unlocked: Boolean,
    val unlockedText: String?,
    val progressText: String,
    val isNew: Boolean,
)

@Immutable
data class AchievementsUiState(
    val items: List<AchievementItemUi>,
    val featuredId: String?,
    val celebrate: Boolean,
) {
    val featured: AchievementItemUi? get() = items.firstOrNull { it.def.id == featuredId } ?: items.firstOrNull()
    val unlockedCount: Int get() = items.count { it.unlocked }
}

// ------------------------------------------------------------------------------------ goals

@Immutable
data class GoalItemUi(val metric: GoalMetric, val current: Double, val target: Double) {
    val fraction: Float get() = if (target > 0) (current / target).toFloat().coerceIn(0f, 1f) else 0f
}

@Immutable
data class GoalsUiState(val period: GoalPeriod, val items: List<GoalItemUi>, val targets: GoalTargets, val units: UnitSystem)

// ------------------------------------------------------------------------------------ coach

enum class ChatRole { USER, COACH }

@Immutable
data class ChatMessageUi(val id: Long, val role: ChatRole, val text: String)

@Immutable
data class CoachUiState(
    val insights: List<CoachInsight>,
    val messages: List<ChatMessageUi>,
    val thinking: Boolean,
    val usingClaude: Boolean,
    val error: String? = null,
)

// ------------------------------------------------------------------------------------ stats

enum class StatsMetric { CALORIES, DISTANCE, TIME }

@Immutable
data class StatsUiState(
    val range: StatsRange,
    val metric: StatsMetric,
    val periodLabel: String,
    val canGoForward: Boolean,
    val bars: List<Double>,
    val labels: List<String>,
    val labelEvery: Int,
    val highlight: Int?,
    val totalValue: String,
    val totalUnit: String,
    val distanceValue: String,
    val distanceUnit: String,
    val timeText: String,
    val paceValue: String,
    val paceUnit: String,
    val activeDays: Int,
    val totalDays: Int,
    val runs: Int,
    val barValueLabels: List<String>,
)

// ------------------------------------------------------------------------------------ history

enum class HistorySort { NEWEST, OLDEST, LONGEST, FASTEST }

enum class HistoryFilter { ALL, WEEK, MONTH, YEAR }

@Immutable
data class HistoryItemUi(
    val id: Long,
    val distanceM: Double,
    val dateText: String,
    val durationText: String,
    val calories: Int,
    val route: List<List<LatLng>>,
    val highlighted: Boolean,
)

@Immutable
data class HistoryUiState(
    val items: List<HistoryItemUi>,
    val sort: HistorySort,
    val filter: HistoryFilter,
    val units: UnitSystem,
    val totalRuns: Int,
)

// ------------------------------------------------------------------------------------ profile

@Immutable
data class ProfileUiState(
    val name: String,
    val avatar: ImageBitmap?,
    val level: LevelProgress,
    val levelTitle: String,
    val runs: Int,
    val distanceM: Double,
    val calories: Int,
    val units: UnitSystem,
    val heartRateStatus: String,
    val heartRateConnected: Boolean,
    val themeLabel: String,
    val achievementsUnlocked: Int,
    val achievementsTotal: Int,
    val streak: Int,
)

// ------------------------------------------------------------------------------------ notifications

enum class InboxKind { ACHIEVEMENT, LEVEL, GOAL, RUN, TIP, REMINDER }

@Immutable
data class InboxItemUi(val id: Long, val kind: InboxKind, val title: String, val body: String, val timeText: String, val unread: Boolean)

// ------------------------------------------------------------------------------------ settings

enum class ThemeMode { DARK, LIGHT, SYSTEM }

enum class MapStyle { AUTO, DARK, LIGHT }

@Immutable
data class ClaudeModelOption(val id: String, val label: String)

@Immutable
data class SettingsUiState(
    val units: UnitSystem,
    val voice: Boolean,
    val autoPause: Boolean,
    val keepScreenOn: Boolean,
    val countdown: Boolean,
    val theme: ThemeMode,
    val mapStyle: MapStyle,
    val reminderEnabled: Boolean,
    val reminderHour: Int,
    val reminderMinute: Int,
    val claudeKeySet: Boolean,
    val claudeModel: String,
    val claudeModels: List<ClaudeModelOption>,
    val claudeTestResult: String?,
    val claudeTesting: Boolean,
    val version: String,
)

@Immutable
data class PersonalInfoUiState(
    val name: String,
    val sex: com.runova.core.model.Sex?,
    val age: Int,
    val heightCm: Double,
    val weightKg: Double,
    val units: UnitSystem,
    val avatar: ImageBitmap?,
)

// ------------------------------------------------------------------------------------ heart rate

@Immutable
data class BleDeviceUi(val address: String, val name: String, val rssi: Int)

enum class HrConnection { DISCONNECTED, CONNECTING, CONNECTED }

@Immutable
data class HeartRateUiState(
    val supported: Boolean,
    val bluetoothOn: Boolean,
    val permissionGranted: Boolean,
    val scanning: Boolean,
    val devices: List<BleDeviceUi>,
    val connection: HrConnection,
    val deviceName: String?,
    val bpm: Int?,
)

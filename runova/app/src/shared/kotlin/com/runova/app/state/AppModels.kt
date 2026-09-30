package com.runova.app.state

import com.runova.app.ui.model.InboxKind
import com.runova.app.ui.model.MapStyle
import com.runova.app.ui.model.ThemeMode
import com.runova.core.geo.LatLng
import com.runova.core.model.BodyProfile
import com.runova.core.model.Goals
import com.runova.core.model.RunRecord
import com.runova.core.model.Sex
import com.runova.core.model.UnitSystem
import java.time.DayOfWeek
import java.time.LocalDate
import java.time.ZoneId
import java.time.ZonedDateTime
import java.time.temporal.WeekFields
import java.util.Locale

/** Who the runner is. Height and weight feed the calorie and stride estimates. */
data class UserProfile(
    val name: String = "",
    val sex: Sex? = null,
    val age: Int = 30,
    val heightCm: Double = 175.0,
    val weightKg: Double = 70.0,
) {
    val body: BodyProfile get() = BodyProfile(weightKg.coerceIn(25.0, 350.0), heightCm.coerceIn(100.0, 250.0), age, sex)
    val displayName: String get() = name.trim().ifEmpty { "Runner" }
    val firstName: String get() = displayName.substringBefore(' ')
}

/** Everything the user can change in the app. Stored locally. */
data class AppSettings(
    val onboarded: Boolean = false,
    val profile: UserProfile = UserProfile(),
    val units: UnitSystem = UnitSystem.METRIC,
    val goals: Goals = Goals(),
    val voice: Boolean = true,
    val autoPause: Boolean = false,
    val keepScreenOn: Boolean = true,
    val countdown: Boolean = true,
    val theme: ThemeMode = ThemeMode.DARK,
    val mapStyle: MapStyle = MapStyle.AUTO,
    val reminderEnabled: Boolean = false,
    val reminderHour: Int = 18,
    val reminderMinute: Int = 0,
    val claudeModel: String = DEFAULT_CLAUDE_MODEL,
    val heartRateAddress: String? = null,
    val heartRateName: String? = null,
) {
    companion object {
        const val DEFAULT_CLAUDE_MODEL = "claude-opus-5-5"
    }
}

/** XP ledger and unlock state. */
data class ProgressState(
    val totalXp: Long = 0,
    /** Achievement id to unlock time. */
    val unlocked: Map<String, Long> = emptyMap(),
    /** Unlocked achievements the user has already seen celebrated. */
    val acknowledged: Set<String> = emptySet(),
    val awardedGoalKeys: Set<String> = emptySet(),
)

data class InboxEntry(
    val id: Long,
    val timeMs: Long,
    val kind: InboxKind,
    val title: String,
    val body: String,
    val read: Boolean,
    /** Optional target: a run id ("run:12") or an achievement id ("achievement:first_5k"). */
    val ref: String? = null,
)

/** A snapshot of all persisted data the screens are built from. */
data class AppData(
    val settings: AppSettings = AppSettings(),
    /** Finished runs, newest first. */
    val runs: List<RunRecord> = emptyList(),
    /** Step-counter totals per day (only days with sensor data). */
    val stepsByDay: Map<LocalDate, Int> = emptyMap(),
    val progress: ProgressState = ProgressState(),
    /** Newest first. */
    val inbox: List<InboxEntry> = emptyList(),
    /** Simplified route segments per run id, for thumbnails. */
    val routes: Map<Long, List<List<LatLng>>> = emptyMap(),
)

/** Clock, zone and locale used for building screens, injectable for tests. */
data class UiEnv(val now: ZonedDateTime, val locale: Locale) {
    val zone: ZoneId get() = now.zone
    val today: LocalDate get() = now.toLocalDate()
    val firstDayOfWeek: DayOfWeek get() = WeekFields.of(locale).firstDayOfWeek

    companion object {
        fun system(): UiEnv = UiEnv(ZonedDateTime.now(), Locale.getDefault())
    }
}

package com.runova.app.state

import androidx.compose.ui.graphics.ImageBitmap
import com.runova.app.ui.model.AchievementItemUi
import com.runova.app.ui.model.AchievementsUiState
import com.runova.app.ui.model.ActiveRunBanner
import com.runova.app.ui.model.ClaudeModelOption
import com.runova.app.ui.model.DayChip
import com.runova.app.ui.model.DaySummaryUi
import com.runova.app.ui.model.GoalItemUi
import com.runova.app.ui.model.GoalsUiState
import com.runova.app.ui.model.HistoryFilter
import com.runova.app.ui.model.HistoryItemUi
import com.runova.app.ui.model.HistorySort
import com.runova.app.ui.model.HistoryUiState
import com.runova.app.ui.model.HomeUiState
import com.runova.app.ui.model.InboxItemUi
import com.runova.app.ui.model.PersonalInfoUiState
import com.runova.app.ui.model.PhotoUi
import com.runova.app.ui.model.ProfileUiState
import com.runova.app.ui.model.RunCompleteUiState
import com.runova.app.ui.model.RunDetailsUiState
import com.runova.app.ui.model.SettingsUiState
import com.runova.app.ui.model.StatsMetric
import com.runova.app.ui.model.StatsUiState
import com.runova.app.ui.model.ThemeMode
import com.runova.app.ui.model.XpLine
import com.runova.core.coach.CoachEngine
import com.runova.core.coach.CoachSnapshot
import com.runova.core.format.Fmt
import com.runova.core.format.UnitConv
import com.runova.core.geo.Simplifier
import com.runova.core.model.GoalMetric
import com.runova.core.model.GoalPeriod
import com.runova.core.model.RunRecord
import com.runova.core.model.UnitSystem
import com.runova.core.progress.AchievementInput
import com.runova.core.progress.AchievementProgress
import com.runova.core.progress.Achievements
import com.runova.core.progress.Levels
import com.runova.core.progress.ProgressUnit
import com.runova.core.progress.Rewards
import com.runova.core.progress.RewardsInput
import com.runova.core.progress.Streaks
import com.runova.core.progress.XpKind
import com.runova.core.stats.DayActivity
import com.runova.core.stats.GoalProgress
import com.runova.core.stats.StatsCalculator
import com.runova.core.stats.StatsRange
import com.runova.core.tracking.RunAnalysis
import com.runova.core.tracking.TrackPoint
import java.time.Instant
import java.time.LocalDate
import java.time.ZonedDateTime
import java.time.format.DateTimeFormatter
import java.time.format.FormatStyle
import java.time.format.TextStyle
import java.time.temporal.ChronoUnit
import java.util.Locale
import kotlin.math.roundToInt

/** Builds screen state from [AppData]. Pure functions: no I/O, no Android APIs. */
object UiMapper {

    val claudeModels: List<ClaudeModelOption> = listOf(
        ClaudeModelOption("claude-opus-5-5", "Opus 5.5"),
        ClaudeModelOption("claude-sonnet-5-5", "Sonnet 5.5"),
        ClaudeModelOption("claude-haiku-4-5", "Haiku 4.5"),
    )

    // ------------------------------------------------------------------ shared

    private fun dateOf(ms: Long, env: UiEnv): LocalDate = StatsCalculator.day(ms, env.zone)

    private fun zoned(ms: Long, env: UiEnv): ZonedDateTime = Instant.ofEpochMilli(ms).atZone(env.zone)

    fun dayActivity(data: AppData, date: LocalDate, env: UiEnv): DayActivity =
        StatsCalculator.dayActivity(date, data.runs, env.zone, data.stepsByDay[date], data.settings.profile.body)

    fun currentStreak(data: AppData, env: UiEnv): Int = Streaks.current(Streaks.activeDays(data.runs, env.zone), env.today)

    fun longestStreak(data: AppData, env: UiEnv): Int = Streaks.longest(Streaks.activeDays(data.runs, env.zone))

    fun goalProgress(data: AppData, period: GoalPeriod, env: UiEnv, date: LocalDate = env.today): List<GoalProgress> =
        StatsCalculator.goalProgress(period, date, data.runs, env.zone, data.stepsByDay, data.settings.profile.body, data.settings.goals, env.firstDayOfWeek)

    fun achievementProgress(data: AppData, env: UiEnv): List<AchievementProgress> {
        val s = data.settings
        val perfect = StatsCalculator.perfectDays(data.runs, env.zone, data.stepsByDay, s.profile.body, s.goals)
        val input = AchievementInput(data.runs, longestStreak(data, env), Levels.levelFor(data.progress.totalXp), perfect, env.zone)
        return Achievements.evaluate(input, data.progress.unlocked)
    }

    fun rewardsInput(data: AppData, env: UiEnv): RewardsInput = RewardsInput(
        runs = data.runs,
        stepsByDay = data.stepsByDay,
        profile = data.settings.profile.body,
        goals = data.settings.goals,
        zone = env.zone,
        today = env.today,
        unlockedAchievements = data.progress.unlocked.keys,
        awardedGoalKeys = data.progress.awardedGoalKeys,
        totalXp = data.progress.totalXp,
        firstDayOfWeek = env.firstDayOfWeek,
    )

    fun coachSnapshot(data: AppData, env: UiEnv): CoachSnapshot = CoachSnapshot(
        now = env.now.toLocalDateTime(),
        zone = env.zone,
        name = data.settings.profile.firstName,
        units = data.settings.units,
        profile = data.settings.profile.body,
        goals = data.settings.goals,
        runs = data.runs,
        today = dayActivity(data, env.today, env),
        daily = goalProgress(data, GoalPeriod.DAILY, env),
        weekly = goalProgress(data, GoalPeriod.WEEKLY, env),
        monthly = goalProgress(data, GoalPeriod.MONTHLY, env),
        currentStreak = currentStreak(data, env),
        longestStreak = longestStreak(data, env),
        level = Levels.progress(data.progress.totalXp),
        achievements = achievementProgress(data, env),
        firstDayOfWeek = env.firstDayOfWeek,
    )

    // ------------------------------------------------------------------ home

    fun greeting(hour: Int): String = when (hour) {
        in 5..11 -> "Good morning,"
        in 12..17 -> "Good afternoon,"
        else -> "Good evening,"
    }

    fun weekStart(env: UiEnv): LocalDate = StatsCalculator.rangeStart(StatsRange.WEEK, env.today, env.firstDayOfWeek)

    fun todayIndex(env: UiEnv): Int = ChronoUnit.DAYS.between(weekStart(env), env.today).toInt()

    fun home(data: AppData, env: UiEnv, selectedDay: Int?, activeRun: ActiveRunBanner?, coachTip: String?): HomeUiState {
        val start = weekStart(env)
        val runDays = data.runs.map { dateOf(it.startTimeMs, env) }.toSet()
        val week = (0 until 7).map { i ->
            val d = start.plusDays(i.toLong())
            DayChip(d.dayOfWeek.getDisplayName(TextStyle.SHORT, env.locale), d == env.today, d in runDays, d.isAfter(env.today))
        }
        val selected = (selectedDay ?: todayIndex(env)).coerceIn(0, 6)
        val date = start.plusDays(selected.toLong())
        val a = dayActivity(data, date, env)
        val targets = data.settings.goals.daily
        val progress = GoalMetric.entries.map { GoalProgress(it, a.value(it), targets.target(it)) }
        return HomeUiState(
            greeting = greeting(env.now.hour),
            name = data.settings.profile.firstName,
            hasUnread = data.inbox.any { !it.read },
            week = week,
            selectedDay = selected,
            day = DaySummaryUi(
                calories = a.calories.roundToInt(),
                caloriesGoal = targets.calories,
                steps = a.steps,
                stepsEstimated = a.stepsEstimated,
                distanceM = a.distanceM,
                activeMinutes = a.activeMinutes,
                progress = CoachEngine.overallDailyProgress(progress),
            ),
            coachTip = coachTip,
            activeRun = activeRun,
            units = data.settings.units,
            streak = currentStreak(data, env),
        )
    }

    // ------------------------------------------------------------------ goals

    fun goals(data: AppData, env: UiEnv, period: GoalPeriod): GoalsUiState = GoalsUiState(
        period = period,
        items = goalProgress(data, period, env).map { GoalItemUi(it.metric, it.current, it.target) },
        targets = data.settings.goals.of(period),
        units = data.settings.units,
    )

    // ------------------------------------------------------------------ stats

    fun stats(data: AppData, env: UiEnv, range: StatsRange, metric: StatsMetric, offset: Int): StatsUiState {
        val units = data.settings.units
        val anchor = StatsCalculator.shift(range, env.today, offset.toLong())
        val rs = StatsCalculator.compute(range, anchor, data.runs, env.zone, env.locale, env.firstDayOfWeek)
        val unitM = UnitConv.unitMeters(units)
        val bars = rs.buckets.map {
            when (metric) {
                StatsMetric.CALORIES -> it.calories
                StatsMetric.DISTANCE -> it.distanceM / unitM
                StatsMetric.TIME -> it.movingTimeMs / 60_000.0
            }
        }
        val labels = rs.buckets.map { it.label }
        val (total, totalUnit) = when (metric) {
            StatsMetric.CALORIES -> Fmt.calories(rs.calories, env.locale) to "kcal"
            StatsMetric.DISTANCE -> Fmt.distanceValue(rs.distanceM, units, 1) to Fmt.distanceUnit(units)
            StatsMetric.TIME -> Fmt.durationWords(rs.movingTimeMs) to ""
        }
        return StatsUiState(
            range = range,
            metric = metric,
            periodLabel = periodLabel(range, rs.start, offset, env),
            canGoForward = offset < 0,
            bars = bars,
            labels = labels,
            labelEvery = when (range) {
                StatsRange.WEEK -> 1
                StatsRange.MONTH -> 5
                StatsRange.YEAR -> 1
            },
            highlight = bars.indices.maxByOrNull { bars[it] }?.takeIf { bars[it] > 0 },
            totalValue = total,
            totalUnit = totalUnit,
            distanceValue = Fmt.distanceValue(rs.distanceM, units, 1),
            distanceUnit = Fmt.distanceUnit(units),
            timeText = Fmt.durationWords(rs.movingTimeMs),
            paceValue = Fmt.pace(rs.avgPaceSecPerKm, units),
            paceUnit = "/ ${Fmt.distanceUnit(units)}",
            activeDays = rs.activeDays,
            totalDays = rs.totalDays,
            runs = rs.runs,
            barValueLabels = bars.map { v ->
                when (metric) {
                    StatsMetric.CALORIES -> Fmt.integer(v.roundToInt(), env.locale)
                    StatsMetric.DISTANCE -> String.format(Locale.US, "%.1f", v)
                    StatsMetric.TIME -> Fmt.durationWords((v * 60_000).toLong())
                }
            },
        )
    }

    fun periodLabel(range: StatsRange, start: LocalDate, offset: Int, env: UiEnv): String = when {
        offset == 0 -> when (range) {
            StatsRange.WEEK -> "This week"
            StatsRange.MONTH -> "This month"
            StatsRange.YEAR -> "This year"
        }
        offset == -1 && range == StatsRange.WEEK -> "Last week"
        offset == -1 && range == StatsRange.MONTH -> "Last month"
        offset == -1 && range == StatsRange.YEAR -> "Last year"
        range == StatsRange.WEEK -> {
            val end = start.plusDays(6)
            val day = DateTimeFormatter.ofPattern("d MMM", env.locale)
            val first = if (start.month == end.month) start.dayOfMonth.toString() else start.format(day)
            "$first – ${end.format(day)}" + if (end.year != env.today.year) " ${end.year}" else ""
        }
        range == StatsRange.MONTH -> start.format(DateTimeFormatter.ofPattern("LLLL yyyy", env.locale))
        else -> start.year.toString()
    }

    // ------------------------------------------------------------------ history

    fun history(data: AppData, env: UiEnv, sort: HistorySort, filter: HistoryFilter): HistoryUiState {
        val from: LocalDate? = when (filter) {
            HistoryFilter.ALL -> null
            HistoryFilter.WEEK -> StatsCalculator.rangeStart(StatsRange.WEEK, env.today, env.firstDayOfWeek)
            HistoryFilter.MONTH -> StatsCalculator.rangeStart(StatsRange.MONTH, env.today)
            HistoryFilter.YEAR -> StatsCalculator.rangeStart(StatsRange.YEAR, env.today)
        }
        val filtered = data.runs.filter { from == null || !dateOf(it.startTimeMs, env).isBefore(from) }
        val sorted = when (sort) {
            HistorySort.NEWEST -> filtered.sortedByDescending { it.startTimeMs }
            HistorySort.OLDEST -> filtered.sortedBy { it.startTimeMs }
            HistorySort.LONGEST -> filtered.sortedByDescending { it.distanceM }
            HistorySort.FASTEST -> filtered.sortedWith(compareBy(nullsLast()) { it.avgPaceSecPerKm })
        }
        val newestId = data.runs.maxByOrNull { it.startTimeMs }?.id
        return HistoryUiState(
            items = sorted.map { r ->
                HistoryItemUi(
                    id = r.id,
                    distanceM = r.distanceM,
                    dateText = shortDate(r.startTimeMs, env),
                    durationText = Fmt.clock(r.movingTimeMs),
                    calories = r.calories.roundToInt(),
                    route = data.routes[r.id].orEmpty(),
                    highlighted = r.id == newestId,
                )
            },
            sort = sort,
            filter = filter,
            units = data.settings.units,
            totalRuns = filtered.size,
        )
    }

    fun shortDate(ms: Long, env: UiEnv): String {
        val d = zoned(ms, env)
        val pattern = if (d.year == env.today.year) "EEE, d MMM" else "EEE, d MMM yyyy"
        return d.format(DateTimeFormatter.ofPattern(pattern, env.locale))
    }

    // ------------------------------------------------------------------ run details

    fun runTitle(startMs: Long, env: UiEnv): String = when (zoned(startMs, env).hour) {
        in 5..10 -> "Morning Run"
        in 11..13 -> "Lunch Run"
        in 14..16 -> "Afternoon Run"
        in 17..20 -> "Evening Run"
        else -> "Night Run"
    }

    fun runDateText(startMs: Long, env: UiEnv): String {
        val d = zoned(startMs, env)
        val date = d.format(DateTimeFormatter.ofPattern("EEE, d MMM yyyy", env.locale))
        val time = d.format(DateTimeFormatter.ofLocalizedTime(FormatStyle.SHORT).withLocale(env.locale))
        return "$date • $time"
    }

    fun runDetails(run: RunRecord, points: List<TrackPoint>, photos: List<PhotoUi>, units: UnitSystem, env: UiEnv): RunDetailsUiState = RunDetailsUiState(
        runId = run.id,
        title = run.title ?: runTitle(run.startTimeMs, env),
        dateText = runDateText(run.startTimeMs, env),
        distanceM = run.distanceM,
        movingTimeMs = run.movingTimeMs,
        elapsedTimeMs = (run.endTimeMs - run.startTimeMs).coerceAtLeast(run.movingTimeMs),
        avgPaceSecPerKm = run.avgPaceSecPerKm,
        calories = run.calories,
        steps = run.steps,
        stepsEstimated = run.stepsEstimated,
        elevationGainM = run.elevationGainM,
        elevationLossM = run.elevationLossM,
        maxSpeedMps = run.maxSpeedMps,
        avgHeartRate = run.avgHeartRate,
        maxHeartRate = run.maxHeartRate,
        xpEarned = run.xpEarned,
        route = RunAnalysis.segments(points).map { Simplifier.simplify(it, 1.0) }.filter { it.size >= 2 },
        splits = RunAnalysis.splits(points, UnitConv.unitMeters(units), run.movingTimeMs),
        paceSeries = RunAnalysis.paceSeries(points),
        elevationSeries = RunAnalysis.elevationSeries(points),
        heartRateSeries = RunAnalysis.heartRateSeries(points),
        photos = photos,
        units = units,
    )

    /** Simplified route used for list thumbnails and share cards. */
    fun thumbnailRoute(points: List<TrackPoint>): List<List<com.runova.core.geo.LatLng>> =
        RunAnalysis.segments(points).map { Simplifier.simplify(it, 4.0) }.filter { it.size >= 2 }

    // ------------------------------------------------------------------ run complete

    fun xpLabel(kind: XpKind, label: String): String = when (kind) {
        XpKind.ACHIEVEMENT -> "Achievement: $label"
        else -> label
    }

    fun runComplete(run: RunRecord, rewards: Rewards, units: UnitSystem): RunCompleteUiState = RunCompleteUiState(
        runId = run.id,
        distanceM = run.distanceM,
        movingTimeMs = run.movingTimeMs,
        avgPaceSecPerKm = run.avgPaceSecPerKm,
        calories = run.calories,
        units = units,
        xpLines = rewards.awards.map { XpLine(xpLabel(it.kind, it.label), it.amount) },
        xpGained = rewards.xpGained.toInt(),
        levelBefore = rewards.levelBefore,
        levelAfter = rewards.levelAfter,
        newAchievements = rewards.achievements,
        goalsCompleted = rewards.goals.map { "${it.label} complete" },
    )

    // ------------------------------------------------------------------ achievements

    fun achievements(data: AppData, env: UiEnv, featuredId: String?, celebrate: Boolean): AchievementsUiState {
        val progress = achievementProgress(data, env)
        val acknowledged = data.progress.acknowledged
        val ordered = progress.sortedWith(
            compareByDescending<AchievementProgress> { it.isUnlocked }
                .thenByDescending { it.unlockedAtMs ?: 0L }
                .thenByDescending { it.fraction },
        )
        val items = ordered.map { p ->
            AchievementItemUi(
                def = p.def,
                fraction = if (p.isUnlocked) 1f else p.fraction,
                unlocked = p.isUnlocked,
                unlockedText = p.unlockedAtMs?.let { "Unlocked " + zoned(it, env).format(DateTimeFormatter.ofPattern("d MMM yyyy", env.locale)) },
                progressText = progressText(p, data.settings.units, env.locale),
                isNew = p.isUnlocked && p.def.id !in acknowledged,
            )
        }
        val featured = featuredId?.takeIf { id -> items.any { it.def.id == id } }
            ?: items.firstOrNull { it.isNew }?.def?.id
            ?: items.firstOrNull { it.unlocked }?.def?.id
            ?: items.firstOrNull()?.def?.id
        return AchievementsUiState(items, featured, celebrate)
    }

    fun progressText(p: AchievementProgress, units: UnitSystem, locale: Locale): String {
        if (p.isUnlocked) return "Complete"
        val d = p.def
        return when (d.unit) {
            ProgressUnit.METERS -> "${Fmt.distanceValue(p.current.coerceAtMost(d.target), units, 1)} / ${Fmt.distanceSpoken(d.target, units)}"
            ProgressUnit.DAYS -> "${p.current.toInt()} / ${d.target.toInt()} days"
            ProgressUnit.KCAL -> "${Fmt.integer(p.current.roundToInt(), locale)} / ${Fmt.integer(d.target.roundToInt(), locale)} kcal"
            ProgressUnit.LEVEL -> "Level ${p.current.toInt()} / ${d.target.toInt()}"
            ProgressUnit.MINUTES -> "${p.current.roundToInt()} / ${d.target.roundToInt()} min"
            ProgressUnit.COUNT -> if (d.target <= 1.0) "Not yet" else "${p.current.toInt()} / ${d.target.toInt()}"
        }
    }

    // ------------------------------------------------------------------ profile & settings

    fun themeLabel(mode: ThemeMode): String = when (mode) {
        ThemeMode.DARK -> "Dark"
        ThemeMode.LIGHT -> "Light"
        ThemeMode.SYSTEM -> "System"
    }

    fun profile(data: AppData, env: UiEnv, avatar: ImageBitmap?, heartRateStatus: String, heartRateConnected: Boolean): ProfileUiState {
        val level = Levels.progress(data.progress.totalXp)
        val known = Achievements.all.map { it.id }.toSet()
        return ProfileUiState(
            name = data.settings.profile.displayName,
            avatar = avatar,
            level = level,
            levelTitle = Levels.title(level.level),
            runs = data.runs.size,
            distanceM = data.runs.sumOf { it.distanceM },
            calories = data.runs.sumOf { it.calories }.roundToInt(),
            units = data.settings.units,
            heartRateStatus = heartRateStatus,
            heartRateConnected = heartRateConnected,
            themeLabel = themeLabel(data.settings.theme),
            achievementsUnlocked = data.progress.unlocked.keys.count { it in known },
            achievementsTotal = Achievements.all.size,
            streak = currentStreak(data, env),
        )
    }

    fun settings(data: AppData, claudeKeySet: Boolean, testResult: String?, testing: Boolean, version: String): SettingsUiState {
        val s = data.settings
        return SettingsUiState(
            units = s.units,
            voice = s.voice,
            autoPause = s.autoPause,
            keepScreenOn = s.keepScreenOn,
            countdown = s.countdown,
            theme = s.theme,
            mapStyle = s.mapStyle,
            reminderEnabled = s.reminderEnabled,
            reminderHour = s.reminderHour,
            reminderMinute = s.reminderMinute,
            claudeKeySet = claudeKeySet,
            claudeModel = claudeModels.firstOrNull { it.id == s.claudeModel }?.id ?: AppSettings.DEFAULT_CLAUDE_MODEL,
            claudeModels = claudeModels,
            claudeTestResult = testResult,
            claudeTesting = testing,
            version = version,
        )
    }

    fun personalInfo(data: AppData, avatar: ImageBitmap?): PersonalInfoUiState {
        val p = data.settings.profile
        return PersonalInfoUiState(p.name, p.sex, p.age, p.heightCm, p.weightKg, data.settings.units, avatar)
    }

    fun reminderText(s: AppSettings): String =
        if (s.reminderEnabled) String.format(Locale.US, "Daily reminder at %02d:%02d", s.reminderHour, s.reminderMinute) else "Daily reminder is off"

    // ------------------------------------------------------------------ inbox

    fun inbox(data: AppData, env: UiEnv): List<InboxItemUi> = data.inbox.map { e ->
        InboxItemUi(e.id, e.kind, e.title, e.body, relativeTime(e.timeMs, env), !e.read)
    }

    fun relativeTime(ms: Long, env: UiEnv): String {
        val t = zoned(ms, env)
        val days = ChronoUnit.DAYS.between(t.toLocalDate(), env.today)
        return when {
            days <= 0L -> "Today, " + t.format(DateTimeFormatter.ofLocalizedTime(FormatStyle.SHORT).withLocale(env.locale))
            days == 1L -> "Yesterday"
            days < 7L -> t.dayOfWeek.getDisplayName(TextStyle.SHORT, env.locale)
            t.year == env.today.year -> t.format(DateTimeFormatter.ofPattern("d MMM", env.locale))
            else -> t.format(DateTimeFormatter.ofPattern("d MMM yyyy", env.locale))
        }
    }
}

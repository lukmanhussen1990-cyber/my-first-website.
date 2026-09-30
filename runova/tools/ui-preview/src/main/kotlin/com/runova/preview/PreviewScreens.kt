package com.runova.preview

import com.runova.app.ui.model.DayChip
import com.runova.app.ui.model.DaySummaryUi
import com.runova.app.ui.model.HomeUiState
import com.runova.core.model.UnitSystem

object Fake {
    val week = listOf("Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun").mapIndexed { i, l ->
        DayChip(l, isToday = i == 1, hasActivity = i == 0, isFuture = i > 1)
    }

    val home = HomeUiState(
        greeting = "Good evening,",
        name = "Imran",
        hasUnread = true,
        week = week,
        selectedDay = 1,
        day = DaySummaryUi(calories = 436, caloriesGoal = 650, steps = 7_842, stepsEstimated = false, distanceM = 5_400.0, activeMinutes = 42, progress = 0.67f),
        coachTip = "You're 1.2 km away from your daily goal. Keep going! 🔥",
        activeRun = null,
        units = UnitSystem.METRIC,
        streak = 3,
    )
}

object FakeRun {
    val route = demoLoop(points = 520)
    // the live screen shows ~85% of the loop, ending at the current position
    val partial = route.take((route.size * 0.86).toInt())
    val running = com.runova.app.ui.model.RunningUiState(
        status = com.runova.app.ui.model.LiveStatus.RUNNING,
        distanceM = 5_210.0,
        movingTimeMs = (32 * 60 + 18) * 1000L,
        currentPaceSecPerKm = 371.0,
        avgPaceSecPerKm = 372.0,
        calories = 312.0,
        heartRate = 128,
        heartRateConnected = true,
        steps = 7_842,
        gps = com.runova.app.ui.model.GpsSignal.GOOD,
        route = listOf(partial),
        current = partial.last(),
    )
}

object FakeMore {
    private fun trackPoints(route: List<com.runova.core.geo.LatLng>, secPerKm: Double, seed: Int = 1): List<com.runova.core.tracking.TrackPoint> {
        val rnd = kotlin.random.Random(seed)
        var dist = 0.0
        var t = 0L
        val out = ArrayList<com.runova.core.tracking.TrackPoint>()
        route.forEachIndexed { i, p ->
            if (i > 0) {
                val d = com.runova.core.geo.GeoMath.distanceMeters(route[i - 1], p)
                dist += d
                val pace = secPerKm * (1 + 0.08 * kotlin.math.sin(i / 25.0) + (rnd.nextDouble() - 0.5) * 0.04)
                t += (d / 1000.0 * pace * 1000).toLong()
            }
            val alt = 42 + 10 * kotlin.math.sin(i / 60.0) + 4 * kotlin.math.sin(i / 13.0)
            out.add(com.runova.core.tracking.TrackPoint(1_790_000_000_000 + t, p.lat, p.lng, alt, 5f, 3f, 0, dist, t, heartRate = (128 + 12 * kotlin.math.sin(i / 40.0)).toInt()))
        }
        return out
    }

    val detailRoute = demoLine(lengthM = 5210.0, points = 360)
    val detailPoints = trackPoints(detailRoute, 372.0)

    val details = com.runova.app.ui.model.RunDetailsUiState(
        runId = 1,
        title = "Morning Run",
        dateText = "Tue, 30 Sep 2026 • 6:32 AM",
        distanceM = 5_210.0,
        movingTimeMs = (32 * 60 + 18) * 1000L,
        elapsedTimeMs = (33 * 60 + 40) * 1000L,
        avgPaceSecPerKm = 372.0,
        calories = 312.0,
        steps = 7_842,
        stepsEstimated = false,
        elevationGainM = 24.0,
        elevationLossM = 21.0,
        maxSpeedMps = 3.9,
        avgHeartRate = 128,
        maxHeartRate = 151,
        xpEarned = 401,
        route = listOf(detailRoute),
        splits = com.runova.core.tracking.RunAnalysis.splits(detailPoints, 1000.0),
        paceSeries = com.runova.core.tracking.RunAnalysis.paceSeries(detailPoints),
        elevationSeries = com.runova.core.tracking.RunAnalysis.elevationSeries(detailPoints),
        heartRateSeries = com.runova.core.tracking.RunAnalysis.heartRateSeries(detailPoints),
        photos = emptyList(),
        units = com.runova.core.model.UnitSystem.METRIC,
    )

    private val unlockedIds = setOf("first_run", "first_5k", "streak_7", "kcal_10000", "night_runner", "early_bird", "half_marathon", "streak_3", "first_10k", "runs_10")
    val achievements = com.runova.app.ui.model.AchievementsUiState(
        items = com.runova.core.progress.Achievements.all.sortedByDescending { it.id in unlockedIds }.map { def ->
            val unlocked = def.id in unlockedIds
            com.runova.app.ui.model.AchievementItemUi(
                def = def,
                fraction = if (unlocked) 1f else 0.42f,
                unlocked = unlocked,
                unlockedText = if (unlocked) "Unlocked 30 Sep 2026" else null,
                progressText = if (unlocked) "Complete" else "42%",
                isNew = def.id == "first_5k",
            )
        },
        featuredId = "first_5k",
        celebrate = true,
    )

    val goals = com.runova.app.ui.model.GoalsUiState(
        period = com.runova.core.model.GoalPeriod.DAILY,
        items = listOf(
            com.runova.app.ui.model.GoalItemUi(com.runova.core.model.GoalMetric.CALORIES, 436.0, 650.0),
            com.runova.app.ui.model.GoalItemUi(com.runova.core.model.GoalMetric.DISTANCE, 5.4, 8.0),
            com.runova.app.ui.model.GoalItemUi(com.runova.core.model.GoalMetric.STEPS, 7_842.0, 10_000.0),
            com.runova.app.ui.model.GoalItemUi(com.runova.core.model.GoalMetric.ACTIVE_MINUTES, 42.0, 60.0),
        ),
        targets = com.runova.core.model.Goals().daily,
        units = com.runova.core.model.UnitSystem.METRIC,
    )

    val coach = com.runova.app.ui.model.CoachUiState(
        insights = listOf(
            com.runova.core.coach.CoachInsight(com.runova.core.coach.InsightKind.GOAL, "You're 1.2 km away from your daily goal. Keep going! 🔥", 95),
            com.runova.core.coach.CoachInsight(com.runova.core.coach.InsightKind.TREND, "Your pace improved by 12% compared to last week. Great progress!", 85),
            com.runova.core.coach.CoachInsight(com.runova.core.coach.InsightKind.SUGGESTION, "Based on your activity, try a 6 km run tomorrow.", 65),
            com.runova.core.coach.CoachInsight(com.runova.core.coach.InsightKind.RECOVERY, "Remember to stay hydrated and get enough sleep for better recovery.", 20),
        ),
        messages = emptyList(),
        thinking = false,
        usingClaude = false,
    )

    val coachChat = coach.copy(
        insights = coach.insights.take(1),
        messages = listOf(
            com.runova.app.ui.model.ChatMessageUi(1, com.runova.app.ui.model.ChatRole.USER, "How far did I run this week?"),
            com.runova.app.ui.model.ChatMessageUi(2, com.runova.app.ui.model.ChatRole.COACH, "This week you've run 28.4 km over 5 runs. You need another 1.6 km to hit your weekly goal."),
            com.runova.app.ui.model.ChatMessageUi(3, com.runova.app.ui.model.ChatRole.USER, "Suggest a workout"),
        ),
        thinking = true,
    )

    val stats = com.runova.app.ui.model.StatsUiState(
        range = com.runova.core.stats.StatsRange.WEEK,
        metric = com.runova.app.ui.model.StatsMetric.CALORIES,
        periodLabel = "This week",
        canGoForward = false,
        bars = listOf(310.0, 450.0, 380.0, 350.0, 420.0, 520.0, 430.0),
        labels = listOf("Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"),
        labelEvery = 1,
        highlight = 5,
        totalValue = "2,980",
        totalUnit = "kcal",
        distanceValue = "28.4",
        distanceUnit = "km",
        timeText = "3h 12m",
        paceValue = "6:45",
        paceUnit = "/ km",
        activeDays = 5,
        totalDays = 7,
        runs = 5,
        barValueLabels = listOf("310", "450", "380", "350", "420", "520", "430"),
    )

    val history = com.runova.app.ui.model.HistoryUiState(
        items = listOf(
            Triple(5_210.0, "Tue, 30 Sep" to "00:32:18", 312),
            Triple(3_120.0, "Sun, 28 Sep" to "00:21:05", 186),
            Triple(7_030.0, "Fri, 26 Sep" to "00:45:12", 428),
            Triple(4_110.0, "Wed, 24 Sep" to "00:26:30", 250),
            Triple(6_500.0, "Mon, 22 Sep" to "00:40:18", 398),
        ).mapIndexed { i, (d, dt, kcal) ->
            com.runova.app.ui.model.HistoryItemUi(
                id = i.toLong(),
                distanceM = d,
                dateText = dt.first,
                durationText = dt.second,
                calories = kcal,
                route = listOf(if (i == 2) demoLine(lengthM = 2500.0, points = 120, seed = 4) else demoLoop(radiusM = 400.0, points = 200, seed = i + 2)),
                highlighted = i == 0,
            )
        },
        sort = com.runova.app.ui.model.HistorySort.NEWEST,
        filter = com.runova.app.ui.model.HistoryFilter.ALL,
        units = com.runova.core.model.UnitSystem.METRIC,
        totalRuns = 5,
    )

    val profile = com.runova.app.ui.model.ProfileUiState(
        name = "Imran Hussain",
        avatar = null,
        level = com.runova.core.progress.Levels.progress(12_450),
        levelTitle = "Pacer",
        runs = 56,
        distanceM = 248_000.0,
        calories = 18_320,
        units = com.runova.core.model.UnitSystem.METRIC,
        heartRateStatus = "Connected",
        heartRateConnected = true,
        themeLabel = "Dark",
        achievementsUnlocked = 10,
        achievementsTotal = 20,
        streak = 3,
    )
}

object FakeRest {
    val settings = com.runova.app.ui.model.SettingsUiState(
        units = com.runova.core.model.UnitSystem.METRIC,
        voice = true,
        autoPause = false,
        keepScreenOn = true,
        countdown = true,
        theme = com.runova.app.ui.model.ThemeMode.DARK,
        mapStyle = com.runova.app.ui.model.MapStyle.AUTO,
        reminderEnabled = true,
        reminderHour = 18,
        reminderMinute = 30,
        claudeKeySet = false,
        claudeModel = "claude-haiku-4-5",
        claudeModels = listOf(com.runova.app.ui.model.ClaudeModelOption("claude-haiku-4-5", "Haiku 4.5"), com.runova.app.ui.model.ClaudeModelOption("claude-sonnet-5-5", "Sonnet 5.5")),
        claudeTestResult = null,
        claudeTesting = false,
        version = "1.0.0",
    )
    val personal = com.runova.app.ui.model.PersonalInfoUiState("Imran Hussain", com.runova.core.model.Sex.MALE, 31, 178.0, 72.5, com.runova.core.model.UnitSystem.METRIC, null)
    val heart = com.runova.app.ui.model.HeartRateUiState(
        supported = true, bluetoothOn = true, permissionGranted = true, scanning = true,
        devices = listOf(com.runova.app.ui.model.BleDeviceUi("C4:7A:12:9F:00:21", "Polar H10 8A2B1C", -58), com.runova.app.ui.model.BleDeviceUi("E1:44:0B:77:3A:90", "HRM-Pro 41522", -74)),
        connection = com.runova.app.ui.model.HrConnection.DISCONNECTED, deviceName = null, bpm = null,
    )
    val heartConnected = heart.copy(scanning = false, devices = emptyList(), connection = com.runova.app.ui.model.HrConnection.CONNECTED, deviceName = "Polar H10 8A2B1C", bpm = 128)
    val inbox = listOf(
        com.runova.app.ui.model.InboxItemUi(1, com.runova.app.ui.model.InboxKind.ACHIEVEMENT, "Achievement unlocked: First 5K!", "You completed your first 5 kilometer run! +250 XP", "Today, 7:05 AM", true),
        com.runova.app.ui.model.InboxItemUi(2, com.runova.app.ui.model.InboxKind.LEVEL, "Level up! You're now Level 8", "Pacer — 350 XP to Level 9.", "Today, 7:05 AM", true),
        com.runova.app.ui.model.InboxItemUi(3, com.runova.app.ui.model.InboxKind.GOAL, "Daily distance goal complete", "5.4 km today. +30 XP", "Yesterday", false),
        com.runova.app.ui.model.InboxItemUi(4, com.runova.app.ui.model.InboxKind.TIP, "Coach tip", "Your pace improved by 12% compared to last week.", "Mon", false),
    )
    val complete = com.runova.app.ui.model.RunCompleteUiState(
        runId = 7,
        distanceM = 5_210.0,
        movingTimeMs = (32 * 60 + 18) * 1000L,
        avgPaceSecPerKm = 372.0,
        calories = 312.0,
        units = com.runova.core.model.UnitSystem.METRIC,
        xpLines = listOf(com.runova.app.ui.model.XpLine("Distance", 261), com.runova.app.ui.model.XpLine("Active time", 65), com.runova.app.ui.model.XpLine("First run today", 25), com.runova.app.ui.model.XpLine("5K+ bonus", 50), com.runova.app.ui.model.XpLine("Achievement: First 5K!", 250)),
        xpGained = 651,
        levelBefore = com.runova.core.progress.Levels.progress(11_900),
        levelAfter = com.runova.core.progress.Levels.progress(12_551),
        newAchievements = listOf(com.runova.core.progress.Achievements.def("first_5k")!!),
        goalsCompleted = listOf("Daily distance goal complete", "Daily calories goal complete"),
    )
}

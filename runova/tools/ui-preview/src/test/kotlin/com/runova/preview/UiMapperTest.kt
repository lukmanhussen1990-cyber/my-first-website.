package com.runova.preview

import com.runova.app.state.AppData
import com.runova.app.state.AppSettings
import com.runova.app.state.GpsQuality
import com.runova.app.state.InboxEntry
import com.runova.app.state.ProgressState
import com.runova.app.state.RunVoice
import com.runova.app.state.UiEnv
import com.runova.app.state.UiMapper
import com.runova.app.state.UserProfile
import com.runova.app.state.recoverySummary
import com.runova.app.ui.model.GpsSignal
import com.runova.app.ui.model.HistoryFilter
import com.runova.app.ui.model.HistorySort
import com.runova.app.ui.model.InboxKind
import com.runova.app.ui.model.StatsMetric
import com.runova.core.model.GoalMetric
import com.runova.core.model.GoalPeriod
import com.runova.core.model.RunRecord
import com.runova.core.model.UnitSystem
import com.runova.core.progress.Achievements
import com.runova.core.progress.Levels
import com.runova.core.progress.RewardsCalculator
import com.runova.core.stats.StatsRange
import com.runova.core.tracking.SplitEvent
import java.time.LocalDate
import java.time.LocalTime
import java.time.ZoneId
import java.time.ZonedDateTime
import java.util.Locale
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNull
import kotlin.test.assertTrue

class UiMapperTest {
    private val zone = ZoneId.of("Europe/London")
    // Wednesday 30 September 2026, 18:10
    private val env = UiEnv(ZonedDateTime.of(2026, 9, 30, 18, 10, 0, 0, zone), Locale.UK)

    private fun at(date: LocalDate, hour: Int, minute: Int = 0) = date.atTime(LocalTime.of(hour, minute)).atZone(zone).toInstant().toEpochMilli()

    private fun run(id: Long, date: LocalDate, hour: Int, km: Double, minutes: Int, kcal: Double) =
        RunRecord(id, at(date, hour), at(date, hour) + minutes * 60_000L + 90_000, minutes * 60_000L, km * 1000, kcal, steps = (km * 1150).toInt())

    private val today = LocalDate.of(2026, 9, 30)
    private val runs = listOf(
        run(4, today, 7, 5.4, 36, 380.0),
        run(3, today.minusDays(1), 19, 3.1, 20, 210.0),
        run(2, today.minusDays(2), 6, 7.0, 45, 470.0),
        run(1, LocalDate.of(2026, 8, 12), 12, 10.2, 62, 700.0),
    )
    private val data = AppData(
        settings = AppSettings(onboarded = true, profile = UserProfile("Imran Hussain", age = 31, heightCm = 178.0, weightKg = 72.5)),
        runs = runs,
        progress = ProgressState(totalXp = 1_250, unlocked = mapOf("first_run" to at(LocalDate.of(2026, 8, 12), 13), "first_5k" to at(today, 8)), acknowledged = setOf("first_run")),
        inbox = listOf(InboxEntry(1, at(today, 8), InboxKind.ACHIEVEMENT, "Achievement unlocked: First 5K!", "…", read = false)),
    )

    @Test
    fun homeShowsTodayWithGoalProgress() {
        val home = UiMapper.home(data, env, selectedDay = null, activeRun = null, coachTip = "tip")
        assertEquals("Good evening,", home.greeting)
        assertEquals("Imran", home.name)
        assertTrue(home.hasUnread)
        assertEquals(listOf("Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"), home.week.map { it.label })
        assertEquals(2, home.selectedDay)
        assertTrue(home.week[2].isToday && home.week[2].hasActivity)
        assertTrue(home.week[3].isFuture && !home.week[3].hasActivity)
        assertEquals(5_400.0, home.day.distanceM)
        assertEquals(380, home.day.calories)
        assertEquals(36, home.day.activeMinutes)
        assertEquals(3, home.streak)
        // calories 380/650, distance 5.4/8, steps 6210/10000, minutes 36/60
        assertEquals(((380 / 650.0) + (5.4 / 8) + (6_210 / 10_000.0) + (36 / 60.0)) / 4, home.day.progress.toDouble(), 1e-3)

        val monday = UiMapper.home(data, env, selectedDay = 0, activeRun = null, coachTip = null)
        assertEquals(470, monday.day.calories)
    }

    @Test
    fun greetingFollowsTheClock() {
        assertEquals("Good morning,", UiMapper.greeting(6))
        assertEquals("Good afternoon,", UiMapper.greeting(13))
        assertEquals("Good evening,", UiMapper.greeting(23))
        assertEquals("Good evening,", UiMapper.greeting(2))
    }

    @Test
    fun weeklyStatsAndPeriodNavigation() {
        val week = UiMapper.stats(data, env, StatsRange.WEEK, StatsMetric.DISTANCE, 0)
        assertEquals("This week", week.periodLabel)
        assertFalse(week.canGoForward)
        assertEquals(7, week.bars.size)
        assertEquals("15.5", week.totalValue)
        assertEquals("km", week.totalUnit)
        assertEquals(0, week.highlight, "Monday's 7 km is the longest bar")
        assertEquals(3, week.activeDays)
        assertEquals(7, week.totalDays)
        assertEquals("1h 41m", week.timeText)
        assertEquals("7.0", week.barValueLabels[0])

        val last = UiMapper.stats(data, env, StatsRange.WEEK, StatsMetric.CALORIES, -1)
        assertEquals("Last week", last.periodLabel)
        assertTrue(last.canGoForward)
        assertTrue(last.bars.all { it == 0.0 })
        assertNull(last.highlight)

        val older = UiMapper.stats(data, env, StatsRange.WEEK, StatsMetric.TIME, -3)
        assertTrue(older.periodLabel.startsWith("7 – 13 Sep"), older.periodLabel)
        val month = UiMapper.stats(data, env, StatsRange.MONTH, StatsMetric.TIME, -1)
        assertEquals("Last month", month.periodLabel)
        assertEquals("July 2026", UiMapper.periodLabel(StatsRange.MONTH, LocalDate.of(2026, 7, 1), -2, env))
        assertEquals("2024", UiMapper.periodLabel(StatsRange.YEAR, LocalDate.of(2024, 1, 1), -2, env))
        assertEquals(31, month.bars.size)
        assertEquals("1h 2m", month.totalValue)
        val year = UiMapper.stats(data, env, StatsRange.YEAR, StatsMetric.CALORIES, 0)
        assertEquals(12, year.bars.size)
        assertEquals("1,760", year.totalValue)
    }

    @Test
    fun imperialStatsUseMiles() {
        val imperial = data.copy(settings = data.settings.copy(units = UnitSystem.IMPERIAL))
        val week = UiMapper.stats(imperial, env, StatsRange.WEEK, StatsMetric.DISTANCE, 0)
        assertEquals("mi", week.totalUnit)
        assertEquals("9.6", week.totalValue)
        assertEquals("/ mi", week.paceUnit)
    }

    @Test
    fun historyFiltersSortsAndHighlightsTheNewestRun() {
        val all = UiMapper.history(data, env, HistorySort.NEWEST, HistoryFilter.ALL)
        assertEquals(listOf(4L, 3L, 2L, 1L), all.items.map { it.id })
        assertTrue(all.items.first().highlighted)
        // en-GB abbreviates September as "Sep" or "Sept" depending on the CLDR version
        assertTrue(all.items.first().dateText.startsWith("Wed, 30 Sep"), all.items.first().dateText)
        assertEquals("00:36:00", all.items.first().durationText)

        val week = UiMapper.history(data, env, HistorySort.LONGEST, HistoryFilter.WEEK)
        assertEquals(listOf(2L, 4L, 3L), week.items.map { it.id })
        assertEquals(3, week.totalRuns)

        val fastest = UiMapper.history(data, env, HistorySort.FASTEST, HistoryFilter.ALL)
        assertEquals(runs.sortedBy { it.avgPaceSecPerKm }.map { it.id }, fastest.items.map { it.id })
    }

    @Test
    fun achievementsListUnlockedFirstWithProgressText() {
        val state = UiMapper.achievements(data, env, featuredId = null, celebrate = false)
        assertEquals(Achievements.all.size, state.items.size)
        assertEquals(listOf("first_5k", "first_run"), state.items.take(2).map { it.def.id })
        assertTrue(state.items.first().isNew)
        assertFalse(state.items[1].isNew)
        assertEquals("first_5k", state.featuredId)
        assertEquals(2, state.unlockedCount)
        val tenK = state.items.first { it.def.id == "first_10k" }
        assertFalse(tenK.unlocked)
        assertEquals("10.0 / 10 km", tenK.progressText, "the 10.2 km run is complete but not unlocked yet")
        val streak = state.items.first { it.def.id == "streak_7" }
        assertEquals("3 / 7 days", streak.progressText)
    }

    @Test
    fun goalsShowPeriodProgress() {
        val weekly = UiMapper.goals(data, env, GoalPeriod.WEEKLY)
        val distance = weekly.items.first { it.metric == GoalMetric.DISTANCE }
        assertEquals(15.5, distance.current, 1e-9)
        assertEquals(30.0, distance.target)
        assertEquals(data.settings.goals.weekly, weekly.targets)
    }

    @Test
    fun runCompleteListsEveryXpLine() {
        val newRun = run(5, today, 18, 5.1, 31, 360.0)
        val withRun = data.copy(runs = listOf(newRun) + data.runs)
        val rewards = RewardsCalculator.forRun(newRun, UiMapper.rewardsInput(withRun, env))
        val ui = UiMapper.runComplete(newRun, rewards, UnitSystem.METRIC)
        assertEquals(rewards.xpGained.toInt(), ui.xpLines.sumOf { it.amount })
        assertTrue(ui.xpLines.any { it.label == "Daily distance goal" }, "5.4 + 5.1 km completes the 8 km daily goal")
        assertTrue(ui.goalsCompleted.contains("Daily distance goal complete"))
        assertEquals(Levels.progress(1_250), ui.levelBefore)
    }

    @Test
    fun inboxTimesAreRelative() {
        assertTrue(UiMapper.relativeTime(at(today, 8, 5), env).startsWith("Today, 08:05"))
        assertEquals("Yesterday", UiMapper.relativeTime(at(today.minusDays(1), 8), env))
        assertEquals("Mon", UiMapper.relativeTime(at(today.minusDays(2), 8), env))
        assertEquals("12 Aug", UiMapper.relativeTime(at(LocalDate.of(2026, 8, 12), 8), env))
        assertEquals("Daily reminder is off", UiMapper.reminderText(data.settings))
        assertEquals("Daily reminder at 07:30", UiMapper.reminderText(data.settings.copy(reminderEnabled = true, reminderHour = 7, reminderMinute = 30)))
    }

    @Test
    fun runTitlesAndDates() {
        assertEquals("Morning Run", UiMapper.runTitle(at(today, 7), env))
        assertEquals("Lunch Run", UiMapper.runTitle(at(today, 12), env))
        assertEquals("Evening Run", UiMapper.runTitle(at(today, 19), env))
        assertEquals("Night Run", UiMapper.runTitle(at(today, 23), env))
        assertTrue(UiMapper.runDateText(at(today, 6, 32), env).startsWith("Wed, 30 Sep"))
    }

    @Test
    fun liveRunTexts() {
        assertEquals(GpsSignal.NONE, GpsQuality.classify(null, null))
        assertEquals(GpsSignal.GOOD, GpsQuality.classify(4f, 1))
        assertEquals(GpsSignal.FAIR, GpsQuality.classify(15f, 1))
        assertEquals(GpsSignal.WEAK, GpsQuality.classify(28f, 1))
        assertEquals(GpsSignal.NONE, GpsQuality.classify(4f, 30))

        val split = SplitEvent(index = 5, splitDurationMs = 332_000, totalMovingMs = 1_690_000, totalDistanceM = 5_000.0)
        assertEquals("5 kilometers. Time, 28 minutes 10 seconds. Last kilometer, 5 minutes 32 seconds.", RunVoice.splitAnnouncement(split, UnitSystem.METRIC))
        assertEquals("Km 5 • 5:32 /km", RunVoice.splitToast(split, UnitSystem.METRIC))
        val mile = SplitEvent(index = 1, splitDurationMs = 535_000, totalMovingMs = 535_000, totalDistanceM = 1_609.344)
        assertEquals("1 mile. Time, 8 minutes 55 seconds. Last mile, 8 minutes 55 seconds.", RunVoice.splitAnnouncement(mile, UnitSystem.IMPERIAL))
        assertEquals("Mile 1 • 8:55 /mi", RunVoice.splitToast(mile, UnitSystem.IMPERIAL))
        assertEquals("850 meters", RunVoice.spokenDistance(849.0, UnitSystem.METRIC))
        assertEquals("3.1 miles", RunVoice.spokenDistance(5_000.0, UnitSystem.IMPERIAL))
        assertEquals("1 hour 5 seconds", RunVoice.spokenDuration(3_605_000))
        assertEquals("0 seconds", RunVoice.spokenDuration(0))

        val summary = recoverySummary(at(today, 6, 32), 3_210.0, 1_084_000, UnitSystem.METRIC, env)
        assertTrue(summary.startsWith("A run you started today at 06:32 was interrupted: 3.21 km in 18:04."), summary)
    }
}

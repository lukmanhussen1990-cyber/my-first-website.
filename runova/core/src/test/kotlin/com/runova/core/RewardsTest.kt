package com.runova.core

import com.runova.core.model.BodyProfile
import com.runova.core.model.GoalMetric
import com.runova.core.model.GoalPeriod
import com.runova.core.model.Goals
import com.runova.core.model.RunRecord
import com.runova.core.progress.Levels
import com.runova.core.progress.RewardsCalculator
import com.runova.core.progress.RewardsInput
import com.runova.core.progress.XpKind
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.ZoneId
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class RewardsTest {
    private val zone = ZoneId.of("UTC")
    private val today = LocalDate.of(2026, 9, 30)
    private val profile = BodyProfile(70.0, 175.0)

    private fun run(id: Long, day: LocalDate, hour: Int, km: Double, minutes: Int, kcal: Double = km * 70) =
        RunRecord(
            id = id,
            startTimeMs = LocalDateTime.of(day, java.time.LocalTime.of(hour, 0)).atZone(zone).toInstant().toEpochMilli(),
            endTimeMs = LocalDateTime.of(day, java.time.LocalTime.of(hour, 0)).atZone(zone).toInstant().toEpochMilli() + minutes * 60_000L,
            movingTimeMs = minutes * 60_000L,
            distanceM = km * 1000,
            calories = kcal,
            steps = (km * 1100).toInt(),
        )

    private fun input(runs: List<RunRecord>, xp: Long = 0, unlocked: Set<String> = emptySet(), awarded: Set<String> = emptySet(), goals: Goals = Goals()) =
        RewardsInput(runs, emptyMap(), profile, goals, zone, today, unlocked, awarded, xp)

    @Test
    fun firstEverRunEarnsItemisedXpAndFirstAchievements() {
        val r = run(1, today, 18, 5.2, 30)
        val rewards = RewardsCalculator.forRun(r, input(listOf(r)))
        val labels = rewards.awards.map { it.label }
        assertEquals(listOf("Distance", "Active time", "First run today", "5K+ bonus"), labels.take(4))
        assertEquals(260 + 60 + 25 + 50, rewards.awards.filter { it.kind == XpKind.RUN }.sumOf { it.amount })
        assertEquals(setOf("first_run", "first_5k"), rewards.achievements.map { it.id }.toSet())
        assertTrue(rewards.goals.isEmpty(), "5.2 km / 30 min / 364 kcal reach no default goal")
        assertEquals(rewards.xpBefore + rewards.xpGained, rewards.xpAfter)
        assertTrue(rewards.leveledUp)
    }

    @Test
    fun secondRunTheSameDayCompletesDailyDistanceOnce() {
        val a = run(1, today, 7, 4.0, 24)
        val b = run(2, today, 18, 4.5, 27)
        val rewards = RewardsCalculator.forRun(b, input(listOf(a, b), xp = 500, unlocked = setOf("first_run")))
        assertFalse(rewards.awards.any { it.label == "First run today" })
        val daily = rewards.goals.single { it.period == GoalPeriod.DAILY }
        assertEquals(GoalMetric.DISTANCE, daily.metric)
        assertEquals("DAILY:DISTANCE:2026-09-30", daily.key)
        assertEquals("Daily distance goal", daily.label)

        val again = RewardsCalculator.forRun(b, input(listOf(a, b), xp = 500, unlocked = setOf("first_run"), awarded = setOf(daily.key)))
        assertTrue(again.goals.none { it.key == daily.key })
    }

    @Test
    fun extendingAStreakPaysABonus() {
        val runs = (0L..3L).map { run(it + 1, today.minusDays(3 - it), 7, 3.0, 18) }
        val rewards = RewardsCalculator.forRun(runs.last(), input(runs, xp = 2_000, unlocked = setOf("first_run")))
        val streak = rewards.awards.single { it.kind == XpKind.STREAK }
        assertEquals("4-day streak", streak.label)
        assertEquals(20, streak.amount)
        assertTrue(rewards.achievements.any { it.id == "streak_3" })
    }

    @Test
    fun weeklyGoalKeyUsesWeekStart() {
        assertEquals("WEEKLY:STEPS:2026-09-28", RewardsCalculator.goalKey(GoalPeriod.WEEKLY, GoalMetric.STEPS, today))
        assertEquals("MONTHLY:CALORIES:2026-09-01", RewardsCalculator.goalKey(GoalPeriod.MONTHLY, GoalMetric.CALORIES, today))
    }

    @Test
    fun achievementXpCanUnlockTheLevelAchievement() {
        val start = Levels.totalXpForLevel(10) - 150
        val r = run(1, today, 18, 1.0, 6)
        val rewards = RewardsCalculator.forRun(r, input(listOf(r), xp = start))
        assertTrue(rewards.achievements.any { it.id == "first_run" })
        assertTrue(rewards.achievements.any { it.id == "level_10" }, "first_run XP pushes the level to 10")
        assertTrue(rewards.levelAfter.level >= 10)
    }

    @Test
    fun pendingRewardsPickUpStepGoalsReachedByWalking() {
        val base = input(emptyList(), xp = 100)
        val walked = base.copy(stepsByDay = mapOf(today to 10_500))
        val rewards = RewardsCalculator.pending(walked)
        assertEquals(listOf("DAILY:STEPS:2026-09-30"), rewards.goals.map { it.key })
        assertEquals(30, rewards.xpGained)
        assertTrue(RewardsCalculator.pending(walked.copy(awardedGoalKeys = setOf("DAILY:STEPS:2026-09-30"))).isEmpty)
    }
}

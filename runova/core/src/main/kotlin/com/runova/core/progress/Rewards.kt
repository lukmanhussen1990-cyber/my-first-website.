package com.runova.core.progress

import com.runova.core.model.BodyProfile
import com.runova.core.model.GoalMetric
import com.runova.core.model.GoalPeriod
import com.runova.core.model.Goals
import com.runova.core.model.RunRecord
import com.runova.core.stats.StatsCalculator
import java.time.DayOfWeek
import java.time.LocalDate
import java.time.ZoneId
import kotlin.math.min

/** A goal that was reached. [key] identifies the period so each goal pays out once. */
data class GoalCompletion(val key: String, val period: GoalPeriod, val metric: GoalMetric, val xp: Int) {
    val label: String
        get() {
            val p = when (period) {
                GoalPeriod.DAILY -> "Daily"
                GoalPeriod.WEEKLY -> "Weekly"
                GoalPeriod.MONTHLY -> "Monthly"
            }
            val m = when (metric) {
                GoalMetric.CALORIES -> "calories"
                GoalMetric.DISTANCE -> "distance"
                GoalMetric.STEPS -> "steps"
                GoalMetric.ACTIVE_MINUTES -> "active minutes"
            }
            return "$p $m goal"
        }
}

/** Everything needed to decide what the user earns. [runs] already contains a just-finished run. */
data class RewardsInput(
    val runs: List<RunRecord>,
    val stepsByDay: Map<LocalDate, Int>,
    val profile: BodyProfile,
    val goals: Goals,
    val zone: ZoneId,
    val today: LocalDate,
    val unlockedAchievements: Set<String>,
    val awardedGoalKeys: Set<String>,
    val totalXp: Long,
    val firstDayOfWeek: DayOfWeek = DayOfWeek.MONDAY,
)

data class Rewards(
    /** Itemised XP in display order (run, streak, goals, achievements). */
    val awards: List<XpAward>,
    val goals: List<GoalCompletion>,
    val achievements: List<AchievementDef>,
    val xpBefore: Long,
) {
    val xpGained: Long get() = awards.sumOf { it.amount.toLong() }
    val xpAfter: Long get() = xpBefore + xpGained
    val levelBefore: LevelProgress get() = Levels.progress(xpBefore)
    val levelAfter: LevelProgress get() = Levels.progress(xpAfter)
    val leveledUp: Boolean get() = levelAfter.level > levelBefore.level
    val isEmpty: Boolean get() = awards.isEmpty()
}

object RewardsCalculator {

    fun goalXp(period: GoalPeriod): Int = when (period) {
        GoalPeriod.DAILY -> XpRules.DAILY_GOAL
        GoalPeriod.WEEKLY -> XpRules.WEEKLY_GOAL
        GoalPeriod.MONTHLY -> XpRules.MONTHLY_GOAL
    }

    fun goalKey(period: GoalPeriod, metric: GoalMetric, date: LocalDate, firstDayOfWeek: DayOfWeek = DayOfWeek.MONDAY): String {
        val start = StatsCalculator.periodDays(period, date, firstDayOfWeek).first()
        return "${period.name}:${metric.name}:$start"
    }

    /** XP, goals and achievements earned by finishing [run] (which must be part of `input.runs`). */
    fun forRun(run: RunRecord, input: RewardsInput): Rewards {
        val day = StatsCalculator.day(run.startTimeMs, input.zone)
        val others = input.runs.filter { it.id != run.id }
        val firstRunOfDay = others.none { StatsCalculator.day(it.startTimeMs, input.zone) == day && it.distanceM >= Streaks.MIN_DISTANCE_M }
        val awards = ArrayList(XpRules.forRun(run.distanceM, run.movingTimeMs, firstRunOfDay))

        val daysBefore = Streaks.activeDays(others, input.zone)
        val daysAfter = Streaks.activeDays(input.runs, input.zone)
        if (day !in daysBefore && day in daysAfter) {
            val streak = Streaks.current(daysAfter, day)
            if (streak >= 2) awards += XpAward(STREAK_XP_PER_DAY * min(streak, STREAK_XP_CAP_DAYS), "$streak-day streak", XpKind.STREAK, "streak:$day")
        }
        return settle(input, awards, dates = listOf(day, input.today).distinct())
    }

    /** Rewards that are due without a new run, e.g. a step goal reached by walking. */
    fun pending(input: RewardsInput): Rewards = settle(input, ArrayList(), dates = listOf(input.today))

    private fun settle(input: RewardsInput, awards: ArrayList<XpAward>, dates: List<LocalDate>): Rewards {
        val goals = ArrayList<GoalCompletion>()
        val seenKeys = HashSet(input.awardedGoalKeys)
        for (date in dates) {
            for (period in GoalPeriod.entries) {
                val progress = StatsCalculator.goalProgress(period, date, input.runs, input.zone, input.stepsByDay, input.profile, input.goals, input.firstDayOfWeek)
                for (g in progress) {
                    if (!g.isComplete) continue
                    val key = goalKey(period, g.metric, date, input.firstDayOfWeek)
                    if (!seenKeys.add(key)) continue
                    val completion = GoalCompletion(key, period, g.metric, goalXp(period))
                    goals += completion
                    awards += XpAward(completion.xp, completion.label, XpKind.GOAL, key)
                }
            }
        }

        // Unlocking achievements adds XP, which can in turn unlock level-based achievements.
        val achievements = ArrayList<AchievementDef>()
        val unlocked = HashSet(input.unlockedAchievements)
        val streak = Streaks.longest(Streaks.activeDays(input.runs, input.zone))
        val perfect = StatsCalculator.perfectDays(input.runs, input.zone, input.stepsByDay, input.profile, input.goals)
        repeat(MAX_ACHIEVEMENT_PASSES) {
            val xp = input.totalXp + awards.sumOf { it.amount.toLong() }
            val fresh = Achievements.newlyUnlocked(AchievementInput(input.runs, streak, Levels.levelFor(xp), perfect, input.zone), unlocked)
            if (fresh.isEmpty()) return Rewards(awards, goals, achievements, input.totalXp)
            for (def in fresh) {
                unlocked += def.id
                achievements += def
                awards += XpAward(def.xp, def.title, XpKind.ACHIEVEMENT, def.id)
            }
        }
        return Rewards(awards, goals, achievements, input.totalXp)
    }

    const val STREAK_XP_PER_DAY = 5
    const val STREAK_XP_CAP_DAYS = 10
    private const val MAX_ACHIEVEMENT_PASSES = 5
}

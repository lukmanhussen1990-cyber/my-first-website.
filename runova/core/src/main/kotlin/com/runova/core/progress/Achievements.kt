package com.runova.core.progress

import com.runova.core.model.RunRecord
import java.time.DayOfWeek
import java.time.Instant
import java.time.ZoneId
import java.time.temporal.IsoFields
import kotlin.math.min

/** Artwork used for a badge; mapped to vector icons by the UI. */
enum class BadgeIcon { FLAME, RUNNER, STREAK, MOON, SUNRISE, MEDAL, TROPHY, MOUNTAIN, BOLT, CROWN, ROAD, TARGET, TIMER, SHOE, CALENDAR, STAR }

/** Colour family of a badge. */
enum class BadgeTone { EMBER, GOLD, AMBER, VIOLET, STEEL, AZURE, LIME, ROSE }

enum class ProgressUnit { COUNT, METERS, DAYS, KCAL, LEVEL, MINUTES }

data class AchievementDef(
    val id: String,
    val title: String,
    val description: String,
    /** Sentence shown when the badge unlocks. */
    val unlockText: String,
    val icon: BadgeIcon,
    val tone: BadgeTone,
    val xp: Int,
    val target: Double,
    val unit: ProgressUnit,
)

data class AchievementProgress(
    val def: AchievementDef,
    val current: Double,
    val unlockedAtMs: Long? = null,
) {
    val fraction: Float get() = if (def.target > 0) min(1.0, current / def.target).toFloat() else 0f
    val isComplete: Boolean get() = current >= def.target
    val isUnlocked: Boolean get() = unlockedAtMs != null
}

/** Aggregated history used to evaluate achievements. */
data class AchievementInput(
    val runs: List<RunRecord>,
    val longestStreak: Int,
    val level: Int,
    /** Number of days on which every daily goal was met. */
    val perfectDays: Int,
    val zone: ZoneId,
)

object Achievements {
    val all: List<AchievementDef> = listOf(
        AchievementDef("first_run", "First Steps", "Complete your first run.", "You completed your very first run!", BadgeIcon.SHOE, BadgeTone.LIME, 100, 1.0, ProgressUnit.COUNT),
        AchievementDef("first_5k", "First 5K!", "Run 5 km in a single run.", "You completed your first 5 kilometer run!", BadgeIcon.FLAME, BadgeTone.GOLD, 250, 5_000.0, ProgressUnit.METERS),
        AchievementDef("streak_7", "7-Day Streak", "Run on 7 consecutive days.", "Seven days in a row. Unstoppable!", BadgeIcon.STREAK, BadgeTone.GOLD, 300, 7.0, ProgressUnit.DAYS),
        AchievementDef("kcal_10000", "10,000 Kcal Burned", "Burn an estimated 10,000 kcal in total.", "You've burned an estimated 10,000 kcal!", BadgeIcon.FLAME, BadgeTone.EMBER, 400, 10_000.0, ProgressUnit.KCAL),
        AchievementDef("night_runner", "Night Runner", "Start a run of 1 km or more between 9 PM and 5 AM.", "The night belongs to you. Night run complete!", BadgeIcon.MOON, BadgeTone.VIOLET, 150, 1.0, ProgressUnit.COUNT),
        AchievementDef("early_bird", "Early Bird", "Start a run of 1 km or more between 5 and 7 AM.", "Up before the sun — early run complete!", BadgeIcon.SUNRISE, BadgeTone.AMBER, 150, 1.0, ProgressUnit.COUNT),
        AchievementDef("half_marathon", "Half Marathon", "Run 21.1 km in a single run.", "21.1 km in one go. Half marathon done!", BadgeIcon.RUNNER, BadgeTone.STEEL, 750, 21_097.5, ProgressUnit.METERS),
        AchievementDef("first_10k", "10K Club", "Run 10 km in a single run.", "Welcome to the 10K club!", BadgeIcon.MEDAL, BadgeTone.AZURE, 400, 10_000.0, ProgressUnit.METERS),
        AchievementDef("streak_3", "Hat Trick", "Run on 3 consecutive days.", "Three days in a row — you're building a habit!", BadgeIcon.CALENDAR, BadgeTone.LIME, 100, 3.0, ProgressUnit.DAYS),
        AchievementDef("streak_30", "Unstoppable", "Run on 30 consecutive days.", "A 30-day streak. Legendary consistency!", BadgeIcon.CROWN, BadgeTone.GOLD, 1_500, 30.0, ProgressUnit.DAYS),
        AchievementDef("total_100km", "Century", "Run 100 km in total.", "100 kilometers on the clock!", BadgeIcon.ROAD, BadgeTone.AZURE, 500, 100_000.0, ProgressUnit.METERS),
        AchievementDef("total_500km", "Road Warrior", "Run 500 km in total.", "500 kilometers. You are a road warrior!", BadgeIcon.TROPHY, BadgeTone.GOLD, 1_500, 500_000.0, ProgressUnit.METERS),
        AchievementDef("runs_10", "Getting Serious", "Complete 10 runs.", "Ten runs logged. Keep it rolling!", BadgeIcon.STAR, BadgeTone.LIME, 200, 10.0, ProgressUnit.COUNT),
        AchievementDef("runs_50", "Dedicated", "Complete 50 runs.", "Fifty runs. That's dedication!", BadgeIcon.STAR, BadgeTone.VIOLET, 750, 50.0, ProgressUnit.COUNT),
        AchievementDef("speed_demon", "Speed Demon", "Average under 5:00 /km on a run of 3 km or more.", "Sub-5 pace over 3K. Blazing fast!", BadgeIcon.BOLT, BadgeTone.ROSE, 300, 1.0, ProgressUnit.COUNT),
        AchievementDef("hill_climber", "Hill Climber", "Climb 150 m in a single run.", "150 m of climbing. King of the hills!", BadgeIcon.MOUNTAIN, BadgeTone.STEEL, 250, 150.0, ProgressUnit.METERS),
        AchievementDef("hour_power", "Hour of Power", "Run for 60 minutes without stopping the clock.", "A full hour of running. Respect!", BadgeIcon.TIMER, BadgeTone.AZURE, 250, 60.0, ProgressUnit.MINUTES),
        AchievementDef("goal_crusher", "Goal Crusher", "Complete all four daily goals on the same day.", "Every daily goal crushed in a single day!", BadgeIcon.TARGET, BadgeTone.EMBER, 200, 1.0, ProgressUnit.COUNT),
        AchievementDef("weekend_warrior", "Weekend Warrior", "Run on both Saturday and Sunday of the same weekend.", "Saturday and Sunday — weekend conquered!", BadgeIcon.CALENDAR, BadgeTone.ROSE, 150, 1.0, ProgressUnit.COUNT),
        AchievementDef("marathon", "Marathon Legend", "Run 42.2 km in a single run.", "42.2 km. You are a marathoner!", BadgeIcon.CROWN, BadgeTone.EMBER, 2_000, 42_195.0, ProgressUnit.METERS),
        AchievementDef("level_10", "Level 10", "Reach level 10.", "Level 10 reached. Elite status incoming!", BadgeIcon.TROPHY, BadgeTone.VIOLET, 500, 10.0, ProgressUnit.LEVEL),
    )

    private val byId = all.associateBy { it.id }

    fun def(id: String): AchievementDef? = byId[id]

    /** Current progress towards every achievement. */
    fun evaluate(input: AchievementInput, unlocked: Map<String, Long> = emptyMap()): List<AchievementProgress> {
        val runs = input.runs
        val maxDistance = runs.maxOfOrNull { it.distanceM } ?: 0.0
        val totalDistance = runs.sumOf { it.distanceM }
        val totalKcal = runs.sumOf { it.calories }
        val maxClimb = runs.maxOfOrNull { it.elevationGainM } ?: 0.0
        val maxMinutes = (runs.maxOfOrNull { it.movingTimeMs } ?: 0L) / 60_000.0
        val qualifying = runs.count { it.distanceM >= 100 }
        fun hourOf(r: RunRecord) = Instant.ofEpochMilli(r.startTimeMs).atZone(input.zone).hour
        val night = runs.any { it.distanceM >= 1000 && (hourOf(it) >= 21 || hourOf(it) < 5) }
        val early = runs.any { it.distanceM >= 1000 && hourOf(it) in 5..6 }
        val fast = runs.any { r -> r.distanceM >= 3000 && (r.avgPaceSecPerKm ?: Double.MAX_VALUE) < 300.0 }
        val weekend = weekendWarrior(runs, input.zone)

        return all.map { def ->
            val current = when (def.id) {
                "first_run" -> qualifying.toDouble()
                "first_5k", "first_10k", "half_marathon", "marathon" -> maxDistance
                "streak_3", "streak_7", "streak_30" -> input.longestStreak.toDouble()
                "kcal_10000" -> totalKcal
                "night_runner" -> if (night) 1.0 else 0.0
                "early_bird" -> if (early) 1.0 else 0.0
                "total_100km", "total_500km" -> totalDistance
                "runs_10", "runs_50" -> qualifying.toDouble()
                "speed_demon" -> if (fast) 1.0 else 0.0
                "hill_climber" -> maxClimb
                "hour_power" -> maxMinutes
                "goal_crusher" -> input.perfectDays.toDouble()
                "weekend_warrior" -> if (weekend) 1.0 else 0.0
                "level_10" -> input.level.toDouble()
                else -> 0.0
            }
            AchievementProgress(def, current, unlocked[def.id])
        }
    }

    /** Achievements that are complete now but were not unlocked before. */
    fun newlyUnlocked(input: AchievementInput, alreadyUnlocked: Set<String>): List<AchievementDef> =
        evaluate(input).filter { it.isComplete && it.def.id !in alreadyUnlocked }.map { it.def }

    private fun weekendWarrior(runs: List<RunRecord>, zone: ZoneId): Boolean {
        val byWeek = HashMap<String, MutableSet<DayOfWeek>>()
        for (r in runs) {
            if (r.distanceM < 500) continue
            val d = Instant.ofEpochMilli(r.startTimeMs).atZone(zone).toLocalDate()
            if (d.dayOfWeek != DayOfWeek.SATURDAY && d.dayOfWeek != DayOfWeek.SUNDAY) continue
            val key = "${d.get(IsoFields.WEEK_BASED_YEAR)}-${d.get(IsoFields.WEEK_OF_WEEK_BASED_YEAR)}"
            byWeek.getOrPut(key) { HashSet() }.add(d.dayOfWeek)
        }
        return byWeek.values.any { it.size == 2 }
    }
}

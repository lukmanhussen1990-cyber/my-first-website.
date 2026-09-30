package com.runova.core.progress

import com.runova.core.model.RunRecord
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import kotlin.math.floor
import kotlin.math.max
import kotlin.math.roundToInt
import kotlin.math.sqrt

/** Cumulative XP needed for level L is 200·(L−1)²: L2 = 200, L3 = 800, L5 = 3,200, L10 = 16,200. */
object Levels {
    const val XP_FACTOR = 200L

    fun totalXpForLevel(level: Int): Long {
        val l = max(1, level) - 1L
        return XP_FACTOR * l * l
    }

    fun levelFor(totalXp: Long): Int {
        if (totalXp <= 0) return 1
        var level = floor(sqrt(totalXp.toDouble() / XP_FACTOR)).toInt() + 1
        while (totalXpForLevel(level + 1) <= totalXp) level++
        while (level > 1 && totalXpForLevel(level) > totalXp) level--
        return level
    }

    fun progress(totalXp: Long): LevelProgress {
        val level = levelFor(totalXp)
        return LevelProgress(level, max(0L, totalXp), totalXpForLevel(level), totalXpForLevel(level + 1))
    }

    fun title(level: Int): String = when {
        level < 3 -> "Rookie"
        level < 5 -> "Jogger"
        level < 8 -> "Runner"
        level < 12 -> "Pacer"
        level < 16 -> "Racer"
        level < 20 -> "Elite"
        else -> "Legend"
    }
}

data class LevelProgress(val level: Int, val totalXp: Long, val levelStartXp: Long, val nextLevelXp: Long) {
    val xpIntoLevel: Long get() = totalXp - levelStartXp
    val xpForLevel: Long get() = nextLevelXp - levelStartXp
    val xpToNext: Long get() = nextLevelXp - totalXp
    val fraction: Float get() = if (xpForLevel > 0) (xpIntoLevel.toFloat() / xpForLevel).coerceIn(0f, 1f) else 0f
}

enum class XpKind { RUN, GOAL, ACHIEVEMENT, STREAK }

data class XpAward(val amount: Int, val label: String, val kind: XpKind, val ref: String? = null)

object XpRules {
    const val XP_PER_KM = 50.0
    const val XP_PER_MINUTE = 2.0
    const val FIRST_RUN_OF_DAY = 25
    const val FIVE_K_BONUS = 50
    const val DAILY_GOAL = 30
    const val WEEKLY_GOAL = 100
    const val MONTHLY_GOAL = 300

    /** XP for a finished run, itemised so the summary screen can animate each line. */
    fun forRun(distanceM: Double, movingTimeMs: Long, firstRunOfDay: Boolean): List<XpAward> {
        val out = ArrayList<XpAward>()
        val distanceXp = (distanceM / 1000.0 * XP_PER_KM).roundToInt()
        if (distanceXp > 0) out.add(XpAward(distanceXp, "Distance", XpKind.RUN))
        val timeXp = (movingTimeMs / 60_000.0 * XP_PER_MINUTE).roundToInt()
        if (timeXp > 0) out.add(XpAward(timeXp, "Active time", XpKind.RUN))
        if (firstRunOfDay && distanceM >= 500) out.add(XpAward(FIRST_RUN_OF_DAY, "First run today", XpKind.RUN))
        if (distanceM >= 5000) out.add(XpAward(FIVE_K_BONUS, "5K+ bonus", XpKind.RUN))
        return out
    }
}

object Streaks {
    const val MIN_DISTANCE_M = 500.0
    const val MIN_MOVING_MS = 5 * 60_000L

    /** Days with at least one qualifying run (≥ 0.5 km or ≥ 5 min). */
    fun activeDays(runs: List<RunRecord>, zone: ZoneId): Set<LocalDate> =
        runs.filter { it.distanceM >= MIN_DISTANCE_M || it.movingTimeMs >= MIN_MOVING_MS }
            .map { Instant.ofEpochMilli(it.startTimeMs).atZone(zone).toLocalDate() }
            .toSet()

    /** Current streak; a streak stays alive until the end of the day after the last active day. */
    fun current(days: Set<LocalDate>, today: LocalDate): Int {
        var day = if (today in days) today else today.minusDays(1)
        var n = 0
        while (day in days) {
            n++
            day = day.minusDays(1)
        }
        return n
    }

    fun longest(days: Set<LocalDate>): Int {
        if (days.isEmpty()) return 0
        val sorted = days.sorted()
        var best = 1
        var run = 1
        for (i in 1 until sorted.size) {
            run = if (sorted[i - 1].plusDays(1) == sorted[i]) run + 1 else 1
            best = max(best, run)
        }
        return best
    }
}

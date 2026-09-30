package com.runova.core.stats

import com.runova.core.metrics.CalorieEstimator
import com.runova.core.metrics.StrideEstimator
import com.runova.core.model.BodyProfile
import com.runova.core.model.GoalMetric
import com.runova.core.model.GoalPeriod
import com.runova.core.model.Goals
import com.runova.core.model.RunRecord
import java.time.DayOfWeek
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import java.time.format.TextStyle
import java.time.temporal.TemporalAdjusters
import java.util.Locale
import kotlin.math.max

enum class StatsRange { WEEK, MONTH, YEAR }

/** Activity of one calendar day. Calories include estimated walking from steps outside of runs. */
data class DayActivity(
    val date: LocalDate,
    val runs: Int,
    val distanceM: Double,
    val runCalories: Double,
    val calories: Double,
    val movingTimeMs: Long,
    val steps: Int,
    val stepsEstimated: Boolean,
) {
    val activeMinutes: Int get() = (movingTimeMs / 60_000).toInt()

    fun value(metric: GoalMetric): Double = when (metric) {
        GoalMetric.CALORIES -> calories
        GoalMetric.DISTANCE -> distanceM / 1000.0
        GoalMetric.STEPS -> steps.toDouble()
        GoalMetric.ACTIVE_MINUTES -> movingTimeMs / 60_000.0
    }
}

data class StatsBucket(
    val label: String,
    val start: LocalDate,
    val endExclusive: LocalDate,
    val distanceM: Double,
    val calories: Double,
    val movingTimeMs: Long,
    val runs: Int,
)

data class RangeStats(
    val range: StatsRange,
    val start: LocalDate,
    val endExclusive: LocalDate,
    val buckets: List<StatsBucket>,
    val distanceM: Double,
    val calories: Double,
    val movingTimeMs: Long,
    val runs: Int,
    val activeDays: Int,
    val totalDays: Int,
) {
    val avgPaceSecPerKm: Double? get() = if (distanceM >= 100) movingTimeMs / 1000.0 / (distanceM / 1000.0) else null
}

data class GoalProgress(val metric: GoalMetric, val current: Double, val target: Double) {
    val fraction: Float get() = if (target > 0) (current / target).toFloat().coerceIn(0f, 1f) else 0f
    val isComplete: Boolean get() = target > 0 && current >= target
    val remaining: Double get() = max(0.0, target - current)
}

object StatsCalculator {

    fun day(runStart: Long, zone: ZoneId): LocalDate = Instant.ofEpochMilli(runStart).atZone(zone).toLocalDate()

    fun rangeStart(range: StatsRange, anchor: LocalDate, firstDayOfWeek: DayOfWeek = DayOfWeek.MONDAY): LocalDate = when (range) {
        StatsRange.WEEK -> anchor.with(TemporalAdjusters.previousOrSame(firstDayOfWeek))
        StatsRange.MONTH -> anchor.withDayOfMonth(1)
        StatsRange.YEAR -> anchor.withDayOfYear(1)
    }

    fun rangeEnd(range: StatsRange, start: LocalDate): LocalDate = when (range) {
        StatsRange.WEEK -> start.plusDays(7)
        StatsRange.MONTH -> start.plusMonths(1)
        StatsRange.YEAR -> start.plusYears(1)
    }

    fun shift(range: StatsRange, anchor: LocalDate, by: Long): LocalDate = when (range) {
        StatsRange.WEEK -> anchor.plusWeeks(by)
        StatsRange.MONTH -> anchor.plusMonths(by)
        StatsRange.YEAR -> anchor.plusYears(by)
    }

    fun compute(
        range: StatsRange,
        anchor: LocalDate,
        runs: List<RunRecord>,
        zone: ZoneId,
        locale: Locale = Locale.getDefault(),
        firstDayOfWeek: DayOfWeek = DayOfWeek.MONDAY,
    ): RangeStats {
        val start = rangeStart(range, anchor, firstDayOfWeek)
        val end = rangeEnd(range, start)
        val inRange = runs.filter { val d = day(it.startTimeMs, zone); !d.isBefore(start) && d.isBefore(end) }
        val bucketBounds: List<Triple<String, LocalDate, LocalDate>> = when (range) {
            StatsRange.WEEK -> (0 until 7).map {
                val d = start.plusDays(it.toLong())
                Triple(d.dayOfWeek.getDisplayName(TextStyle.SHORT, locale), d, d.plusDays(1))
            }
            StatsRange.MONTH -> (0 until start.lengthOfMonth()).map {
                val d = start.plusDays(it.toLong())
                Triple(d.dayOfMonth.toString(), d, d.plusDays(1))
            }
            StatsRange.YEAR -> (0 until 12).map {
                val m = start.plusMonths(it.toLong())
                Triple(m.month.getDisplayName(TextStyle.SHORT, locale), m, m.plusMonths(1))
            }
        }
        val buckets = bucketBounds.map { (label, s, e) ->
            val rs = inRange.filter { val d = day(it.startTimeMs, zone); !d.isBefore(s) && d.isBefore(e) }
            StatsBucket(label, s, e, rs.sumOf { it.distanceM }, rs.sumOf { it.calories }, rs.sumOf { it.movingTimeMs }, rs.size)
        }
        val activeDays = inRange.map { day(it.startTimeMs, zone) }.toSet().size
        val totalDays = (end.toEpochDay() - start.toEpochDay()).toInt()
        return RangeStats(
            range = range,
            start = start,
            endExclusive = end,
            buckets = buckets,
            distanceM = inRange.sumOf { it.distanceM },
            calories = inRange.sumOf { it.calories },
            movingTimeMs = inRange.sumOf { it.movingTimeMs },
            runs = inRange.size,
            activeDays = activeDays,
            totalDays = totalDays,
        )
    }

    /**
     * Totals for [date]. [sensorSteps] is the step-counter total for that day (null when no step
     * sensor data exists). Steps taken outside runs add an estimated walking calorie burn.
     */
    fun dayActivity(
        date: LocalDate,
        runs: List<RunRecord>,
        zone: ZoneId,
        sensorSteps: Int?,
        profile: BodyProfile,
    ): DayActivity {
        val rs = runs.filter { day(it.startTimeMs, zone) == date }
        val runSteps = rs.sumOf { r ->
            r.steps ?: StrideEstimator.estimateSteps(r.distanceM, r.avgSpeedMps, profile.heightCm)
        }
        val runCalories = rs.sumOf { it.calories }
        val steps = if (sensorSteps != null) max(sensorSteps, runSteps) else runSteps
        val estimated = sensorSteps == null && rs.any { it.steps == null || it.stepsEstimated }
        val walking = CalorieEstimator.walkingKcalFromSteps(max(0, steps - runSteps), profile)
        return DayActivity(
            date = date,
            runs = rs.size,
            distanceM = rs.sumOf { it.distanceM },
            runCalories = runCalories,
            calories = runCalories + walking,
            movingTimeMs = rs.sumOf { it.movingTimeMs },
            steps = steps,
            stepsEstimated = estimated,
        )
    }

    fun periodDays(period: GoalPeriod, date: LocalDate, firstDayOfWeek: DayOfWeek = DayOfWeek.MONDAY): List<LocalDate> {
        val (start, end) = when (period) {
            GoalPeriod.DAILY -> date to date.plusDays(1)
            GoalPeriod.WEEKLY -> rangeStart(StatsRange.WEEK, date, firstDayOfWeek).let { it to it.plusDays(7) }
            GoalPeriod.MONTHLY -> date.withDayOfMonth(1).let { it to it.plusMonths(1) }
        }
        return generateSequence(start) { it.plusDays(1) }.takeWhile { it.isBefore(end) }.toList()
    }

    /** Goal progress for the period that contains [date]. */
    fun goalProgress(
        period: GoalPeriod,
        date: LocalDate,
        runs: List<RunRecord>,
        zone: ZoneId,
        stepsByDay: Map<LocalDate, Int>,
        profile: BodyProfile,
        goals: Goals,
        firstDayOfWeek: DayOfWeek = DayOfWeek.MONDAY,
    ): List<GoalProgress> {
        val days = periodDays(period, date, firstDayOfWeek).map { d -> dayActivity(d, runs, zone, stepsByDay[d], profile) }
        val targets = goals.of(period)
        return GoalMetric.entries.map { m ->
            GoalProgress(m, days.sumOf { it.value(m) }, targets.target(m))
        }
    }

    /** Days (up to [until]) on which all four daily goals were met. */
    fun perfectDays(
        runs: List<RunRecord>,
        zone: ZoneId,
        stepsByDay: Map<LocalDate, Int>,
        profile: BodyProfile,
        goals: Goals,
    ): Int {
        val days = (runs.map { day(it.startTimeMs, zone) } + stepsByDay.keys).toSet()
        return days.count { d ->
            val a = dayActivity(d, runs, zone, stepsByDay[d], profile)
            GoalMetric.entries.all { m -> a.value(m) >= goals.daily.target(m) && goals.daily.target(m) > 0 }
        }
    }
}

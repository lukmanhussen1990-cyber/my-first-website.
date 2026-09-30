package com.runova.core.model

/** Measurement system chosen by the user. Internally everything is stored in SI units. */
enum class UnitSystem { METRIC, IMPERIAL }

enum class Sex { MALE, FEMALE, OTHER }

/** Body data used for calorie and stride estimates. */
data class BodyProfile(
    val weightKg: Double = 70.0,
    val heightCm: Double = 175.0,
    val age: Int? = null,
    val sex: Sex? = null,
) {
    init {
        require(weightKg > 0) { "weight must be positive" }
        require(heightCm > 0) { "height must be positive" }
    }
}

/** A finished (or recovered) run as stored in the database. Distances in meters, times in ms. */
data class RunRecord(
    val id: Long,
    val startTimeMs: Long,
    val endTimeMs: Long,
    val movingTimeMs: Long,
    val distanceM: Double,
    val calories: Double,
    val steps: Int? = null,
    val stepsEstimated: Boolean = false,
    val elevationGainM: Double = 0.0,
    val elevationLossM: Double = 0.0,
    val maxSpeedMps: Double = 0.0,
    val avgHeartRate: Int? = null,
    val maxHeartRate: Int? = null,
    val xpEarned: Int = 0,
    val title: String? = null,
) {
    /** Average pace in seconds per kilometer, or null when the run is too short to be meaningful. */
    val avgPaceSecPerKm: Double?
        get() = if (distanceM >= 50.0 && movingTimeMs >= 10_000) movingTimeMs / 1000.0 / (distanceM / 1000.0) else null

    val avgSpeedMps: Double
        get() = if (movingTimeMs > 0) distanceM / (movingTimeMs / 1000.0) else 0.0
}

enum class GoalMetric { CALORIES, DISTANCE, STEPS, ACTIVE_MINUTES }

enum class GoalPeriod { DAILY, WEEKLY, MONTHLY }

/** Targets for one period. Distance is stored in kilometers for readability of settings. */
data class GoalTargets(
    val calories: Int,
    val distanceKm: Double,
    val steps: Int,
    val activeMinutes: Int,
) {
    fun target(metric: GoalMetric): Double = when (metric) {
        GoalMetric.CALORIES -> calories.toDouble()
        GoalMetric.DISTANCE -> distanceKm
        GoalMetric.STEPS -> steps.toDouble()
        GoalMetric.ACTIVE_MINUTES -> activeMinutes.toDouble()
    }

    fun with(metric: GoalMetric, value: Double): GoalTargets = when (metric) {
        GoalMetric.CALORIES -> copy(calories = value.toInt())
        GoalMetric.DISTANCE -> copy(distanceKm = value)
        GoalMetric.STEPS -> copy(steps = value.toInt())
        GoalMetric.ACTIVE_MINUTES -> copy(activeMinutes = value.toInt())
    }
}

data class Goals(
    val daily: GoalTargets = GoalTargets(calories = 650, distanceKm = 8.0, steps = 10_000, activeMinutes = 60),
    val weekly: GoalTargets = GoalTargets(calories = 3_500, distanceKm = 30.0, steps = 60_000, activeMinutes = 300),
    val monthly: GoalTargets = GoalTargets(calories = 14_000, distanceKm = 120.0, steps = 250_000, activeMinutes = 1_200),
) {
    fun of(period: GoalPeriod): GoalTargets = when (period) {
        GoalPeriod.DAILY -> daily
        GoalPeriod.WEEKLY -> weekly
        GoalPeriod.MONTHLY -> monthly
    }

    fun with(period: GoalPeriod, targets: GoalTargets): Goals = when (period) {
        GoalPeriod.DAILY -> copy(daily = targets)
        GoalPeriod.WEEKLY -> copy(weekly = targets)
        GoalPeriod.MONTHLY -> copy(monthly = targets)
    }
}

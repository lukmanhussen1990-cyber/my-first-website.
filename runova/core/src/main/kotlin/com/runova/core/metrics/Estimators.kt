package com.runova.core.metrics

import com.runova.core.model.BodyProfile
import kotlin.math.roundToInt

/**
 * Energy expenditure ESTIMATES based on the ACSM metabolic equations
 * (ACSM's Guidelines for Exercise Testing and Prescription).
 *
 *  - Walking  (< 8 km/h): VO2 = 0.1·S + 1.8·S·G + 3.5
 *  - Running (>= 8 km/h): VO2 = 0.2·S + 0.9·S·G + 3.5
 *
 * with S = speed in m/min, G = fractional grade, VO2 in ml O2 / kg / min.
 * One litre of O2 is ≈ 5 kcal. The result is gross expenditure (includes resting metabolism)
 * and is only an estimate: real values depend on fitness, running economy, terrain and more.
 */
object CalorieEstimator {
    const val KCAL_PER_LITRE_O2 = 5.0
    const val RESTING_VO2 = 3.5
    const val RUNNING_THRESHOLD_MPS = 8.0 / 3.6

    fun vo2(speedMps: Double, grade: Double): Double {
        val s = speedMps.coerceAtLeast(0.0) * 60.0
        val g = grade.coerceIn(0.0, 0.15)
        return when {
            speedMps < 0.3 -> RESTING_VO2
            speedMps < RUNNING_THRESHOLD_MPS -> 0.1 * s + 1.8 * s * g + RESTING_VO2
            else -> 0.2 * s + 0.9 * s * g + RESTING_VO2
        }
    }

    /** Gross kcal for moving at [speedMps] on [grade] for [durationSec] seconds. */
    fun kcal(speedMps: Double, grade: Double, durationSec: Double, weightKg: Double): Double {
        if (durationSec <= 0) return 0.0
        return vo2(speedMps, grade) * weightKg * (durationSec / 60.0) / 1000.0 * KCAL_PER_LITRE_O2
    }

    /**
     * Net (above resting) kcal for everyday walking derived from a step count, assuming an
     * average walking speed of 1.3 m/s. Used for the part of the daily step count that did not
     * happen during a tracked run.
     */
    fun walkingKcalFromSteps(steps: Int, profile: BodyProfile): Double {
        if (steps <= 0) return 0.0
        val distanceM = steps * StrideEstimator.walkingStepLengthM(profile.heightCm)
        val speed = 1.3
        val minutes = distanceM / speed / 60.0
        val netVo2 = vo2(speed, 0.0) - RESTING_VO2
        return netVo2 * profile.weightKg * minutes / 1000.0 * KCAL_PER_LITRE_O2
    }
}

object StrideEstimator {
    /** Typical walking step length ≈ 41.5% of body height. */
    fun walkingStepLengthM(heightCm: Double): Double = heightCm / 100.0 * 0.415

    /**
     * Step length grows with speed: ≈ 41.5% of height when walking (≤ 6 km/h) up to ≈ 65%
     * of height when running fast (≥ 14 km/h).
     */
    fun stepLengthM(heightCm: Double, speedMps: Double): Double {
        val kmh = speedMps * 3.6
        val t = ((kmh - 6.0) / 8.0).coerceIn(0.0, 1.0)
        return heightCm / 100.0 * (0.415 + t * (0.65 - 0.415))
    }

    /** Estimated number of steps for a run of [distanceM] covered at an average [speedMps]. */
    fun estimateSteps(distanceM: Double, speedMps: Double, heightCm: Double): Int {
        if (distanceM <= 0) return 0
        return (distanceM / stepLengthM(heightCm, speedMps)).roundToInt()
    }
}

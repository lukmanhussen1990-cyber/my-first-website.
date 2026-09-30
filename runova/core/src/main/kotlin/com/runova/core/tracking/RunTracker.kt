package com.runova.core.tracking

import com.runova.core.geo.GeoMath
import com.runova.core.geo.LatLng
import com.runova.core.metrics.CalorieEstimator
import com.runova.core.metrics.StrideEstimator
import com.runova.core.model.BodyProfile
import kotlin.math.max
import kotlin.math.min

/** One raw location fix as delivered by the platform. */
data class LocationSample(
    /** Monotonic clock (Android: SystemClock.elapsedRealtime / Location.elapsedRealtimeNanos). */
    val elapsedMs: Long,
    /** Wall clock, epoch millis. */
    val wallTimeMs: Long,
    val lat: Double,
    val lng: Double,
    val altitude: Double? = null,
    val horizontalAccuracy: Float? = null,
    val verticalAccuracy: Float? = null,
    /** Doppler speed reported by the GNSS chip, m/s. */
    val speed: Float? = null,
)

/** An accepted point of the recorded route. */
data class TrackPoint(
    val wallTimeMs: Long,
    val lat: Double,
    val lng: Double,
    val altitude: Double?,
    val accuracy: Float?,
    val speed: Float?,
    /** Route segment; a new segment starts after each manual pause so no line is drawn across it. */
    val segment: Int,
    /** Cumulative distance at this point, meters. */
    val distanceM: Double,
    /** Cumulative moving time at this point (pauses excluded), ms. */
    val movingTimeMs: Long,
    val heartRate: Int? = null,
) {
    val latLng: LatLng get() = LatLng(lat, lng)
}

enum class RunStatus { RUNNING, PAUSED, AUTO_PAUSED, FINISHED }

enum class RejectReason { NOT_RECORDING, LOW_ACCURACY, SPEED_SPIKE, JITTER, OUT_OF_ORDER }

sealed interface SampleResult {
    data object Accepted : SampleResult
    data class Rejected(val reason: RejectReason) : SampleResult
}

data class TrackingConfig(
    /** Fixes less accurate than this are not used for distance. */
    val maxAccuracyM: Float = 30f,
    /** Implausible jumps (≈45 km/h) are discarded as GPS spikes. */
    val maxSpeedMps: Double = 12.5,
    val autoPause: Boolean = false,
    /** No movement faster than this for [autoPauseDelayMs] triggers auto-pause. */
    val autoPauseSpeedMps: Double = 0.7,
    val autoPauseDelayMs: Long = 6_000,
    val autoResumeSpeedMps: Double = 1.3,
    /** Sliding window used for the "current pace" figure. */
    val paceWindowMs: Long = 20_000,
    /** Split length used for split events (1000 m or 1609.344 m). */
    val splitLengthM: Double = 1000.0,
)

/** Emitted whenever a full split (km or mile) is completed; used for voice feedback. */
data class SplitEvent(
    val index: Int,
    val splitDurationMs: Long,
    val totalMovingMs: Long,
    val totalDistanceM: Double,
)

/** Final numbers of a run. */
data class RunSummary(
    val startWallTimeMs: Long,
    val endWallTimeMs: Long,
    val movingTimeMs: Long,
    val elapsedTimeMs: Long,
    val distanceM: Double,
    val calories: Double,
    val steps: Int?,
    val stepsEstimated: Boolean,
    val elevationGainM: Double,
    val elevationLossM: Double,
    val maxSpeedMps: Double,
    val avgHeartRate: Int?,
    val maxHeartRate: Int?,
) {
    val avgPaceSecPerKm: Double?
        get() = if (distanceM >= 50 && movingTimeMs >= 10_000) movingTimeMs / 1000.0 / (distanceM / 1000.0) else null
}

/** Read-only view of the live state, cheap to copy to the UI once per second. */
data class TrackerSnapshot(
    val status: RunStatus,
    val startWallTimeMs: Long,
    val movingTimeMs: Long,
    val distanceM: Double,
    val currentPaceSecPerKm: Double?,
    val avgPaceSecPerKm: Double?,
    val calories: Double,
    val steps: Int,
    val stepsEstimated: Boolean,
    val heartRate: Int?,
    val avgHeartRate: Int?,
    val elevationGainM: Double,
    val gpsAccuracyM: Float?,
    val lastLocation: LatLng?,
    val pointCount: Int,
)

/**
 * Pure state machine that turns raw location fixes into a clean route and live metrics.
 * It is platform independent: the Android foreground service feeds it samples and clock ticks.
 * Not thread-safe — call it from a single thread.
 */
class RunTracker(
    val startWallTimeMs: Long,
    startElapsedMs: Long,
    private val profile: BodyProfile,
    config: TrackingConfig = TrackingConfig(),
) {
    var config: TrackingConfig = config
        private set

    var status: RunStatus = RunStatus.RUNNING
        private set

    private val startElapsedMs = startElapsedMs
    private var accumulatedMovingMs = 0L
    private var activeSinceElapsed: Long? = startElapsedMs
    private var lastElapsed = startElapsedMs
    private var endWallTimeMs: Long? = null

    var distanceM = 0.0
        private set
    var calories = 0.0
        private set
    var elevationGainM = 0.0
        private set
    var elevationLossM = 0.0
        private set
    var maxSpeedMps = 0.0
        private set

    private val _points = ArrayList<TrackPoint>()
    val points: List<TrackPoint> get() = _points

    private var segment = 0
    private var anchor: Anchor? = null
    private var consecutiveSpikes = 0

    /** Last fix with usable accuracy, even if it did not add distance. */
    var lastLocation: LocationSample? = null
        private set
    /** Accuracy of the most recent fix of any quality (drives the GPS signal indicator). */
    var lastAccuracyM: Float? = null
        private set
    private var lastFixElapsed: Long? = null

    private var smoothedAlt: Double? = null
    private var elevationRef: Double? = null

    private var lastStepCounter: Long? = null
    var sensorSteps: Int = 0
        private set
    var hasStepSensor: Boolean = false
        private set

    private var hrSum = 0L
    private var hrCount = 0
    var maxHeartRate: Int? = null
        private set
    var heartRate: Int? = null
        private set
    private var lastHrElapsed: Long? = null

    private var lastMovementElapsed: Long = startElapsedMs
    private var autoPauseAnchor: LocationSample? = null

    private var announcedSplits = 0
    private var lastSplitMovingMs = 0L
    private val pendingSplits = ArrayList<SplitEvent>()

    private var paceEma: Double? = null

    private data class Anchor(val sample: LocationSample, val movingMs: Long, val alt: Double?)

    fun updateConfig(newConfig: TrackingConfig) {
        config = newConfig
    }

    fun movingTimeMs(nowElapsed: Long = lastElapsed): Long =
        accumulatedMovingMs + (activeSinceElapsed?.let { max(0L, nowElapsed - it) } ?: 0L)

    fun elapsedTimeMs(nowElapsed: Long = lastElapsed): Long = max(0L, nowElapsed - startElapsedMs)

    val isRecording: Boolean get() = status == RunStatus.RUNNING

    // ---------------------------------------------------------------- location

    fun onLocation(s: LocationSample): SampleResult {
        if (status == RunStatus.FINISHED) return SampleResult.Rejected(RejectReason.NOT_RECORDING)
        val prev = anchor
        if (prev != null && s.elapsedMs <= prev.sample.elapsedMs) {
            return SampleResult.Rejected(RejectReason.OUT_OF_ORDER)
        }
        lastElapsed = max(lastElapsed, s.elapsedMs)
        lastAccuracyM = s.horizontalAccuracy
        lastFixElapsed = s.elapsedMs
        val acc = s.horizontalAccuracy ?: 0f
        if (acc > config.maxAccuracyM) {
            if (acc <= 100f) lastLocation = s
            return SampleResult.Rejected(RejectReason.LOW_ACCURACY)
        }
        lastLocation = s

        if (status == RunStatus.AUTO_PAUSED) {
            val a = autoPauseAnchor
            val moved = a != null && GeoMath.distanceMeters(a.lat, a.lng, s.lat, s.lng) > max(12.0, acc * 1.5)
            val fast = (s.speed ?: 0f) >= config.autoResumeSpeedMps
            if (fast || moved) {
                resumeInternal(s.elapsedMs, newSegment = false)
            } else {
                return SampleResult.Rejected(RejectReason.NOT_RECORDING)
            }
        }
        if (status != RunStatus.RUNNING) return SampleResult.Rejected(RejectReason.NOT_RECORDING)

        val movingNow = movingTimeMs(s.elapsedMs)
        if (prev == null) {
            val alt = updateAltitude(s)
            addPoint(s, movingNow)
            anchor = Anchor(s, movingNow, alt)
            lastMovementElapsed = s.elapsedMs
            return SampleResult.Accepted
        }

        val d = GeoMath.distanceMeters(prev.sample.lat, prev.sample.lng, s.lat, s.lng)
        val dtReal = (s.elapsedMs - prev.sample.elapsedMs) / 1000.0
        val rawSpeed = d / dtReal
        if (rawSpeed > config.maxSpeedMps) {
            consecutiveSpikes++
            if (consecutiveSpikes >= 5) {
                // The previous anchor was most likely the outlier. Re-anchor without adding distance.
                consecutiveSpikes = 0
                segment++
                val alt = updateAltitude(s, reset = true)
                addPoint(s, movingNow)
                anchor = Anchor(s, movingNow, alt)
                return SampleResult.Accepted
            }
            return SampleResult.Rejected(RejectReason.SPEED_SPIKE)
        }
        consecutiveSpikes = 0

        val prevAcc = prev.sample.horizontalAccuracy ?: 5f
        // Doppler speed from the GNSS chip stays reliable while positions wander, so when it says
        // "standing still" the whole accuracy radius is treated as noise.
        val stationaryBySpeed = s.speed != null && s.speed < 0.5f
        val jitter = if (stationaryBySpeed) min(15.0, max(4.0, max(acc, prevAcc).toDouble()))
        else min(8.0, max(2.0, max(acc, prevAcc) * 0.5))
        if (d < jitter) {
            val doppler = s.speed ?: 0f
            if (doppler >= config.autoPauseSpeedMps) lastMovementElapsed = s.elapsedMs
            checkAutoPause(s.elapsedMs)
            return SampleResult.Rejected(RejectReason.JITTER)
        }

        val prevDistance = distanceM
        val prevMoving = prev.movingMs
        distanceM += d
        val alt = updateAltitude(s)
        val dtMoving = (movingNow - prev.movingMs) / 1000.0
        val speedMoving = if (dtMoving > 0.5) d / dtMoving else rawSpeed
        val grade = if (alt != null && prev.alt != null && d > 5) (alt - prev.alt) / d else 0.0
        calories += CalorieEstimator.kcal(speedMoving.coerceAtMost(config.maxSpeedMps), grade, max(dtMoving, 0.0), profile.weightKg)

        val speedForMax = (s.speed?.toDouble()?.takeIf { it > 0 } ?: rawSpeed).coerceAtMost(config.maxSpeedMps)
        if (acc <= 20f) maxSpeedMps = max(maxSpeedMps, speedForMax)

        addPoint(s, movingNow)
        anchor = Anchor(s, movingNow, alt)
        if (rawSpeed >= config.autoPauseSpeedMps || (s.speed ?: 0f) >= config.autoPauseSpeedMps) {
            lastMovementElapsed = s.elapsedMs
        }
        emitSplits(prevDistance, prevMoving, distanceM, movingNow)
        return SampleResult.Accepted
    }

    private fun addPoint(s: LocationSample, movingNow: Long) {
        val hr = heartRate?.takeIf { lastHrElapsed != null && s.elapsedMs - lastHrElapsed!! <= 5_000 }
        _points.add(
            TrackPoint(
                wallTimeMs = s.wallTimeMs,
                lat = s.lat,
                lng = s.lng,
                altitude = s.altitude,
                accuracy = s.horizontalAccuracy,
                speed = s.speed,
                segment = segment,
                distanceM = distanceM,
                movingTimeMs = movingNow,
                heartRate = hr,
            ),
        )
    }

    /** Smooths GPS altitude and accumulates gain/loss with a 3 m hysteresis. Returns the smoothed altitude. */
    private fun updateAltitude(s: LocationSample, reset: Boolean = false): Double? {
        val raw = s.altitude ?: return smoothedAlt
        val va = s.verticalAccuracy
        if (va != null && va > 25f) return smoothedAlt
        val current = smoothedAlt
        val smoothed = if (current == null || reset) raw else current + 0.25 * (raw - current)
        smoothedAlt = smoothed
        val ref = elevationRef
        if (ref == null || reset) {
            elevationRef = smoothed
        } else if (smoothed - ref >= 3.0) {
            elevationGainM += smoothed - ref
            elevationRef = smoothed
        } else if (ref - smoothed >= 3.0) {
            elevationLossM += ref - smoothed
            elevationRef = smoothed
        }
        return smoothed
    }

    private fun emitSplits(prevDistance: Double, prevMoving: Long, curDistance: Double, curMoving: Long) {
        val unit = config.splitLengthM
        while (curDistance >= (announcedSplits + 1) * unit) {
            val target = (announcedSplits + 1) * unit
            val span = curDistance - prevDistance
            val frac = if (span > 0) ((target - prevDistance) / span).coerceIn(0.0, 1.0) else 1.0
            val t = prevMoving + ((curMoving - prevMoving) * frac).toLong()
            announcedSplits++
            pendingSplits.add(SplitEvent(announcedSplits, t - lastSplitMovingMs, t, target))
            lastSplitMovingMs = t
        }
    }

    /** Returns and clears the split events produced since the last call. */
    fun drainSplitEvents(): List<SplitEvent> {
        if (pendingSplits.isEmpty()) return emptyList()
        val out = pendingSplits.toList()
        pendingSplits.clear()
        return out
    }

    // ---------------------------------------------------------------- sensors

    /** Cumulative value of the platform step counter (steps since boot). */
    fun onStepCounter(totalSinceBoot: Long) {
        hasStepSensor = true
        val last = lastStepCounter
        lastStepCounter = totalSinceBoot
        if (last == null) return
        val delta = totalSinceBoot - last
        if (delta <= 0 || delta > 1_000) return // counter reset or bogus batch
        if (status == RunStatus.RUNNING) sensorSteps += delta.toInt()
    }

    fun onHeartRate(bpm: Int, elapsedMs: Long) {
        if (bpm !in 30..230) return
        heartRate = bpm
        lastHrElapsed = elapsedMs
        if (status == RunStatus.RUNNING) {
            hrSum += bpm
            hrCount++
            maxHeartRate = max(maxHeartRate ?: 0, bpm)
        }
    }

    fun clearHeartRate() {
        heartRate = null
        lastHrElapsed = null
    }

    val avgHeartRate: Int? get() = if (hrCount > 0) (hrSum / hrCount).toInt() else null

    // ---------------------------------------------------------------- control

    fun pause(nowElapsed: Long) {
        if (status != RunStatus.RUNNING && status != RunStatus.AUTO_PAUSED) return
        if (status == RunStatus.RUNNING) accumulate(nowElapsed)
        status = RunStatus.PAUSED
        paceEma = null
    }

    fun resume(nowElapsed: Long) {
        when (status) {
            RunStatus.PAUSED -> resumeInternal(nowElapsed, newSegment = true)
            RunStatus.AUTO_PAUSED -> resumeInternal(nowElapsed, newSegment = false)
            else -> Unit
        }
    }

    private fun resumeInternal(nowElapsed: Long, newSegment: Boolean) {
        lastElapsed = max(lastElapsed, nowElapsed)
        activeSinceElapsed = nowElapsed
        status = RunStatus.RUNNING
        lastMovementElapsed = nowElapsed
        autoPauseAnchor = null
        if (newSegment && _points.isNotEmpty()) {
            segment++
            anchor = null
        }
    }

    private fun accumulate(nowElapsed: Long) {
        val since = activeSinceElapsed ?: return
        accumulatedMovingMs += max(0L, nowElapsed - since)
        activeSinceElapsed = null
        lastElapsed = max(lastElapsed, nowElapsed)
    }

    /** Called about once per second: advances the clock, handles auto-pause and pace smoothing. */
    fun tick(nowElapsed: Long) {
        if (status == RunStatus.FINISHED) return
        lastElapsed = max(lastElapsed, nowElapsed)
        checkAutoPause(nowElapsed)
        val raw = rawCurrentPace(nowElapsed)
        paceEma = when {
            raw == null -> null
            paceEma == null -> raw
            else -> paceEma!! * 0.6 + raw * 0.4
        }
    }

    private fun checkAutoPause(nowElapsed: Long) {
        if (!config.autoPause || status != RunStatus.RUNNING || _points.isEmpty()) return
        if (nowElapsed - lastMovementElapsed >= config.autoPauseDelayMs &&
            nowElapsed - (activeSinceElapsed ?: nowElapsed) >= config.autoPauseDelayMs
        ) {
            accumulate(nowElapsed)
            status = RunStatus.AUTO_PAUSED
            autoPauseAnchor = lastLocation
            paceEma = null
        }
    }

    fun finish(nowElapsed: Long, nowWallMs: Long): RunSummary {
        if (status == RunStatus.RUNNING) accumulate(nowElapsed)
        status = RunStatus.FINISHED
        activeSinceElapsed = null
        endWallTimeMs = nowWallMs
        return summary(nowElapsed)
    }

    fun summary(nowElapsed: Long = lastElapsed): RunSummary {
        val moving = movingTimeMs(nowElapsed)
        val (steps, estimated) = stepsForSummary(moving)
        return RunSummary(
            startWallTimeMs = startWallTimeMs,
            endWallTimeMs = endWallTimeMs ?: (startWallTimeMs + elapsedTimeMs(nowElapsed)),
            movingTimeMs = moving,
            elapsedTimeMs = elapsedTimeMs(nowElapsed),
            distanceM = distanceM,
            calories = calories,
            steps = steps,
            stepsEstimated = estimated,
            elevationGainM = elevationGainM,
            elevationLossM = elevationLossM,
            maxSpeedMps = maxSpeedMps,
            avgHeartRate = avgHeartRate,
            maxHeartRate = maxHeartRate,
        )
    }

    private fun stepsForSummary(movingMs: Long): Pair<Int?, Boolean> {
        if (hasStepSensor && sensorSteps > 0) return sensorSteps to false
        if (distanceM < 10) return (if (hasStepSensor) 0 else null) to !hasStepSensor
        val speed = if (movingMs > 0) distanceM / (movingMs / 1000.0) else 2.5
        return StrideEstimator.estimateSteps(distanceM, speed, profile.heightCm) to true
    }

    // ---------------------------------------------------------------- pace

    private fun rawCurrentPace(nowElapsed: Long): Double? {
        if (status != RunStatus.RUNNING || _points.isEmpty()) return null
        val last = _points.last()
        val nowMoving = movingTimeMs(nowElapsed)
        if (nowMoving - last.movingTimeMs > 12_000) return null
        val windowStart = nowMoving - config.paceWindowMs
        var i = _points.lastIndex
        while (i > 0 && _points[i - 1].segment == last.segment && _points[i - 1].movingTimeMs >= windowStart) i--
        val first = _points[i]
        val dd = last.distanceM - first.distanceM
        val dt = (nowMoving - first.movingTimeMs) / 1000.0
        if (dd < 8.0 || dt < 4.0) return null
        val pace = dt / (dd / 1000.0)
        return pace.coerceAtMost(60.0 * 60.0)
    }

    /** Smoothed pace over the last ~20 s, seconds per km; null when standing still or not recording. */
    fun currentPaceSecPerKm(): Double? = paceEma

    fun averagePaceSecPerKm(nowElapsed: Long = lastElapsed): Double? {
        val moving = movingTimeMs(nowElapsed)
        return if (distanceM >= 50 && moving >= 10_000) moving / 1000.0 / (distanceM / 1000.0) else null
    }

    /** Current step count: sensor steps when available, otherwise a stride-based estimate. */
    fun liveSteps(nowElapsed: Long = lastElapsed): Pair<Int, Boolean> {
        val (steps, estimated) = stepsForSummary(movingTimeMs(nowElapsed))
        return (steps ?: 0) to estimated
    }

    /** Seconds since the last fix of any quality; used to show "searching for GPS". */
    fun secondsSinceFix(nowElapsed: Long): Long? = lastFixElapsed?.let { (nowElapsed - it) / 1000 }

    fun snapshot(nowElapsed: Long = lastElapsed): TrackerSnapshot {
        val (steps, estimated) = liveSteps(nowElapsed)
        return TrackerSnapshot(
            status = status,
            startWallTimeMs = startWallTimeMs,
            movingTimeMs = movingTimeMs(nowElapsed),
            distanceM = distanceM,
            currentPaceSecPerKm = currentPaceSecPerKm(),
            avgPaceSecPerKm = averagePaceSecPerKm(nowElapsed),
            calories = calories,
            steps = steps,
            stepsEstimated = estimated,
            heartRate = heartRate,
            avgHeartRate = avgHeartRate,
            elevationGainM = elevationGainM,
            gpsAccuracyM = lastAccuracyM,
            lastLocation = lastLocation?.let { LatLng(it.lat, it.lng) },
            pointCount = _points.size,
        )
    }

    /** Values that must be persisted (together with the points) to rebuild the tracker after process death. */
    data class Checkpoint(
        val movingTimeMs: Long,
        val distanceM: Double,
        val calories: Double,
        val elevationGainM: Double,
        val elevationLossM: Double,
        val maxSpeedMps: Double,
        val sensorSteps: Int,
        val hasStepSensor: Boolean,
        val hrSum: Long,
        val hrCount: Int,
        val maxHeartRate: Int?,
    )

    fun checkpoint(nowElapsed: Long = lastElapsed): Checkpoint = Checkpoint(
        movingTimeMs = movingTimeMs(nowElapsed),
        distanceM = distanceM,
        calories = calories,
        elevationGainM = elevationGainM,
        elevationLossM = elevationLossM,
        maxSpeedMps = maxSpeedMps,
        sensorSteps = sensorSteps,
        hasStepSensor = hasStepSensor,
        hrSum = hrSum,
        hrCount = hrCount,
        maxHeartRate = maxHeartRate,
    )

    companion object {
        /**
         * Rebuilds a tracker from persisted state after the process was killed. The restored
         * tracker is PAUSED; calling [resume] continues the run in a new route segment.
         */
        fun restore(
            startWallTimeMs: Long,
            nowElapsedMs: Long,
            profile: BodyProfile,
            config: TrackingConfig,
            points: List<TrackPoint>,
            checkpoint: Checkpoint,
        ): RunTracker {
            val moving = max(checkpoint.movingTimeMs, points.lastOrNull()?.movingTimeMs ?: 0L)
            val t = RunTracker(startWallTimeMs, nowElapsedMs - moving, profile, config)
            t.accumulatedMovingMs = moving
            t.activeSinceElapsed = null
            t.lastElapsed = nowElapsedMs
            t.status = RunStatus.PAUSED
            t._points.addAll(points)
            t.segment = points.lastOrNull()?.segment ?: 0
            t.distanceM = max(checkpoint.distanceM, points.lastOrNull()?.distanceM ?: 0.0)
            t.calories = checkpoint.calories
            t.elevationGainM = checkpoint.elevationGainM
            t.elevationLossM = checkpoint.elevationLossM
            t.maxSpeedMps = checkpoint.maxSpeedMps
            t.sensorSteps = checkpoint.sensorSteps
            t.hasStepSensor = checkpoint.hasStepSensor
            t.hrSum = checkpoint.hrSum
            t.hrCount = checkpoint.hrCount
            t.maxHeartRate = checkpoint.maxHeartRate
            t.announcedSplits = (t.distanceM / config.splitLengthM).toInt()
            t.lastSplitMovingMs = RunAnalysis.movingTimeAtDistance(points, t.announcedSplits * config.splitLengthM) ?: 0L
            points.lastOrNull()?.let { p ->
                t.lastLocation = LocationSample(nowElapsedMs, p.wallTimeMs, p.lat, p.lng, p.altitude, p.accuracy, null, p.speed)
            }
            return t
        }
    }
}

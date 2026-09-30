package com.runova.core

import com.runova.core.geo.GeoMath
import com.runova.core.geo.LatLng
import com.runova.core.tracking.LocationSample
import kotlin.random.Random

/** Generates synthetic GPS fixes for tests. */
class RouteSimulator(
    start: LatLng = LatLng(52.5200, 13.4050),
    private val startElapsed: Long = 1_000_000L,
    private val startWall: Long = 1_790_000_000_000L,
    seed: Int = 42,
) {
    private val rnd = Random(seed)
    var position: LatLng = start
        private set
    var elapsed: Long = startElapsed
        private set
    var altitude: Double = 50.0

    val wall: Long get() = startWall + (elapsed - startElapsed)

    /** Moves at [speedMps] towards [bearing] for [seconds], emitting one fix per second. */
    fun run(
        seconds: Int,
        speedMps: Double,
        bearing: Double = 90.0,
        noiseM: Double = 1.0,
        accuracy: Float = 5f,
        climbPerSecond: Double = 0.0,
    ): List<LocationSample> {
        val out = ArrayList<LocationSample>()
        repeat(seconds) {
            elapsed += 1000
            position = GeoMath.offset(position, speedMps, bearing)
            altitude += climbPerSecond
            val noisy = if (noiseM > 0) GeoMath.offset(position, rnd.nextDouble() * noiseM, rnd.nextDouble() * 360) else position
            out.add(
                LocationSample(
                    elapsedMs = elapsed,
                    wallTimeMs = wall,
                    lat = noisy.lat,
                    lng = noisy.lng,
                    altitude = altitude + (rnd.nextDouble() - 0.5) * 2.0,
                    horizontalAccuracy = accuracy,
                    verticalAccuracy = 6f,
                    speed = speedMps.toFloat(),
                ),
            )
        }
        return out
    }

    fun standStill(seconds: Int, noiseM: Double = 3.0, accuracy: Float = 6f): List<LocationSample> = run(seconds, 0.0, noiseM = noiseM, accuracy = accuracy)

    fun advance(ms: Long) {
        elapsed += ms
    }
}

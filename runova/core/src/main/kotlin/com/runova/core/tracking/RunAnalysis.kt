package com.runova.core.tracking

import com.runova.core.geo.LatLng
import kotlin.math.max
import kotlin.math.min

/** One split (km or mile). The last split may be partial. */
data class Split(
    val index: Int,
    val distanceM: Double,
    val durationMs: Long,
    val elevationDeltaM: Double?,
    val avgHeartRate: Int?,
) {
    /** Pace normalised to the full split length, seconds per unit. */
    fun paceSecPerUnit(unitM: Double): Double? =
        if (distanceM >= 20) durationMs / 1000.0 / (distanceM / unitM) else null
}

/** A value along the route, x = distance in meters. */
data class SeriesPoint(val distanceM: Double, val value: Double)

object RunAnalysis {

    /** Groups points into drawable polylines (one per route segment). */
    fun segments(points: List<TrackPoint>): List<List<LatLng>> {
        if (points.isEmpty()) return emptyList()
        val out = ArrayList<List<LatLng>>()
        var current = ArrayList<LatLng>()
        var seg = points.first().segment
        for (p in points) {
            if (p.segment != seg) {
                if (current.isNotEmpty()) out.add(current)
                current = ArrayList()
                seg = p.segment
            }
            current.add(LatLng(p.lat, p.lng))
        }
        if (current.isNotEmpty()) out.add(current)
        return out
    }

    /** Moving time (ms) at which the cumulative [distanceM] was reached, linearly interpolated. */
    fun movingTimeAtDistance(points: List<TrackPoint>, distanceM: Double): Long? {
        if (points.isEmpty()) return null
        if (distanceM <= 0) return 0L
        for (i in 1 until points.size) {
            val a = points[i - 1]
            val b = points[i]
            if (b.distanceM >= distanceM) {
                val span = b.distanceM - a.distanceM
                val f = if (span > 0) ((distanceM - a.distanceM) / span).coerceIn(0.0, 1.0) else 1.0
                return a.movingTimeMs + ((b.movingTimeMs - a.movingTimeMs) * f).toLong()
            }
        }
        return null
    }

    private fun smoothedAltitudes(points: List<TrackPoint>): DoubleArray? {
        if (points.none { it.altitude != null }) return null
        val out = DoubleArray(points.size)
        var s: Double? = null
        for ((i, p) in points.withIndex()) {
            val a = p.altitude
            s = when {
                a == null -> s
                s == null -> a
                else -> s + 0.25 * (a - s)
            }
            out[i] = s ?: 0.0
        }
        // back-fill leading points without altitude
        val firstIdx = points.indexOfFirst { it.altitude != null }
        for (i in 0 until firstIdx) out[i] = out[firstIdx]
        return out
    }

    private fun interpolate(values: DoubleArray, points: List<TrackPoint>, distanceM: Double): Double {
        for (i in 1 until points.size) {
            val a = points[i - 1]
            val b = points[i]
            if (b.distanceM >= distanceM) {
                val span = b.distanceM - a.distanceM
                val f = if (span > 0) ((distanceM - a.distanceM) / span).coerceIn(0.0, 1.0) else 1.0
                return values[i - 1] + (values[i] - values[i - 1]) * f
            }
        }
        return values.last()
    }

    /**
     * Splits of [unitM] meters (1000 for km, 1609.344 for miles). Also returns a trailing partial
     * split if the remaining distance is at least 5% of a unit.
     */
    fun splits(points: List<TrackPoint>, unitM: Double, totalMovingMs: Long? = null): List<Split> {
        if (points.size < 2) return emptyList()
        val total = points.last().distanceM
        val endMoving = totalMovingMs ?: points.last().movingTimeMs
        val alts = smoothedAltitudes(points)
        val out = ArrayList<Split>()
        var prevT = 0L
        var prevD = 0.0
        var prevAlt = alts?.get(0)
        var k = 1
        while (k * unitM <= total) {
            val d = k * unitM
            val t = movingTimeAtDistance(points, d) ?: break
            val alt = alts?.let { interpolate(it, points, d) }
            out.add(
                Split(
                    index = k,
                    distanceM = unitM,
                    durationMs = t - prevT,
                    elevationDeltaM = if (alt != null && prevAlt != null) alt - prevAlt else null,
                    avgHeartRate = avgHr(points, prevD, d),
                ),
            )
            prevT = t
            prevD = d
            prevAlt = alt
            k++
        }
        val rest = total - prevD
        if (rest >= unitM * 0.05) {
            val alt = alts?.last()
            out.add(
                Split(
                    index = k,
                    distanceM = rest,
                    durationMs = max(0L, endMoving - prevT),
                    elevationDeltaM = if (alt != null && prevAlt != null) alt - prevAlt else null,
                    avgHeartRate = avgHr(points, prevD, total),
                ),
            )
        }
        return out
    }

    private fun avgHr(points: List<TrackPoint>, fromM: Double, toM: Double): Int? {
        var sum = 0L
        var n = 0
        for (p in points) {
            if (p.distanceM < fromM || p.distanceM > toM) continue
            val hr = p.heartRate ?: continue
            sum += hr
            n++
        }
        return if (n > 0) (sum / n).toInt() else null
    }

    /**
     * Pace (seconds per km) sampled every [bucketM] meters, lightly smoothed. Buckets that span
     * a pause are skipped so the chart does not show artificial spikes.
     */
    fun paceSeries(points: List<TrackPoint>, bucketM: Double = 100.0): List<SeriesPoint> {
        if (points.size < 2) return emptyList()
        val total = points.last().distanceM
        if (total < bucketM) return emptyList()
        val raw = ArrayList<SeriesPoint>()
        var d = bucketM
        var prevT = movingTimeAtDistance(points, 0.0) ?: 0L
        while (d <= total) {
            val t = movingTimeAtDistance(points, d) ?: break
            val dt = (t - prevT) / 1000.0
            if (dt > 0) {
                val pace = dt / (bucketM / 1000.0)
                if (pace in 90.0..1800.0) raw.add(SeriesPoint(d, pace))
            }
            prevT = t
            d += bucketM
        }
        return movingAverage(raw, 3)
    }

    fun elevationSeries(points: List<TrackPoint>, maxPoints: Int = 200): List<SeriesPoint> {
        val alts = smoothedAltitudes(points) ?: return emptyList()
        val step = max(1, points.size / maxPoints)
        val out = ArrayList<SeriesPoint>()
        var i = 0
        while (i < points.size) {
            out.add(SeriesPoint(points[i].distanceM, alts[i]))
            i += step
        }
        if (out.last().distanceM != points.last().distanceM) out.add(SeriesPoint(points.last().distanceM, alts.last()))
        return out
    }

    fun heartRateSeries(points: List<TrackPoint>, maxPoints: Int = 200): List<SeriesPoint> {
        val withHr = points.filter { it.heartRate != null }
        if (withHr.size < 2) return emptyList()
        val step = max(1, withHr.size / maxPoints)
        return withHr.filterIndexed { i, _ -> i % step == 0 }.map { SeriesPoint(it.distanceM, it.heartRate!!.toDouble()) }
    }

    private fun movingAverage(src: List<SeriesPoint>, window: Int): List<SeriesPoint> {
        if (src.size <= 2) return src
        val half = window / 2
        return src.indices.map { i ->
            val from = max(0, i - half)
            val to = min(src.lastIndex, i + half)
            var s = 0.0
            for (j in from..to) s += src[j].value
            SeriesPoint(src[i].distanceM, s / (to - from + 1))
        }
    }
}

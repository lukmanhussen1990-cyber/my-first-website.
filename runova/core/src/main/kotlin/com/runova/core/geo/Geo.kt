package com.runova.core.geo

import kotlin.math.PI
import kotlin.math.abs
import kotlin.math.asin
import kotlin.math.atan
import kotlin.math.cos
import kotlin.math.exp
import kotlin.math.ln
import kotlin.math.max
import kotlin.math.min
import kotlin.math.sin
import kotlin.math.sqrt
import kotlin.math.tan

data class LatLng(val lat: Double, val lng: Double)

object GeoMath {
    /** Mean Earth radius (IUGG), meters. */
    const val EARTH_RADIUS_M = 6_371_008.8

    /** Great-circle distance using the haversine formula. Accurate to ~0.3% which is well below GPS noise. */
    fun distanceMeters(lat1: Double, lng1: Double, lat2: Double, lng2: Double): Double {
        val p1 = Math.toRadians(lat1)
        val p2 = Math.toRadians(lat2)
        val dp = p2 - p1
        val dl = Math.toRadians(lng2 - lng1)
        val a = sin(dp / 2) * sin(dp / 2) + cos(p1) * cos(p2) * sin(dl / 2) * sin(dl / 2)
        return 2 * EARTH_RADIUS_M * asin(min(1.0, sqrt(a)))
    }

    fun distanceMeters(a: LatLng, b: LatLng): Double = distanceMeters(a.lat, a.lng, b.lat, b.lng)

    /** Moves [from] by [meters] towards [bearingDeg] (0 = north). Used by tests and demo data. */
    fun offset(from: LatLng, meters: Double, bearingDeg: Double): LatLng {
        val d = meters / EARTH_RADIUS_M
        val b = Math.toRadians(bearingDeg)
        val p1 = Math.toRadians(from.lat)
        val l1 = Math.toRadians(from.lng)
        val p2 = asin(sin(p1) * cos(d) + cos(p1) * sin(d) * cos(b))
        val l2 = l1 + kotlin.math.atan2(sin(b) * sin(d) * cos(p1), cos(d) - sin(p1) * sin(p2))
        return LatLng(Math.toDegrees(p2), (Math.toDegrees(l2) + 540) % 360 - 180)
    }
}

/** Axis-aligned bounds of a set of coordinates. */
data class GeoBounds(val minLat: Double, val minLng: Double, val maxLat: Double, val maxLng: Double) {
    val center: LatLng get() = LatLng((minLat + maxLat) / 2, (minLng + maxLng) / 2)

    companion object {
        fun of(points: Iterable<LatLng>): GeoBounds? {
            var minLat = Double.MAX_VALUE
            var minLng = Double.MAX_VALUE
            var maxLat = -Double.MAX_VALUE
            var maxLng = -Double.MAX_VALUE
            var any = false
            for (p in points) {
                any = true
                minLat = min(minLat, p.lat); maxLat = max(maxLat, p.lat)
                minLng = min(minLng, p.lng); maxLng = max(maxLng, p.lng)
            }
            return if (any) GeoBounds(minLat, minLng, maxLat, maxLng) else null
        }
    }
}

/**
 * Spherical Web Mercator in normalized "world" coordinates: x and y both in [0, 1],
 * origin at the top-left (north-west) corner, as used by slippy-map tile servers.
 */
object Mercator {
    private const val MAX_LAT = 85.05112878

    fun x(lng: Double): Double = (lng + 180.0) / 360.0

    fun y(lat: Double): Double {
        val clamped = lat.coerceIn(-MAX_LAT, MAX_LAT)
        val r = Math.toRadians(clamped)
        return (1.0 - ln(tan(r) + 1.0 / cos(r)) / PI) / 2.0
    }

    fun lng(x: Double): Double = x * 360.0 - 180.0

    fun lat(y: Double): Double {
        val n = PI - 2.0 * PI * y
        return Math.toDegrees(atan(0.5 * (exp(n) - exp(-n))))
    }

    /**
     * Zoom level at which [bounds] fits into a viewport of [widthPx] x [heightPx] pixels
     * for tiles of [tileSizePx] pixels, keeping [paddingPx] on every side.
     */
    fun zoomToFit(
        bounds: GeoBounds,
        widthPx: Double,
        heightPx: Double,
        tileSizePx: Double,
        paddingPx: Double,
        maxZoom: Double = 17.0,
        minZoom: Double = 2.0,
    ): Double {
        val dx = abs(x(bounds.maxLng) - x(bounds.minLng))
        val dy = abs(y(bounds.minLat) - y(bounds.maxLat))
        val w = max(1.0, widthPx - 2 * paddingPx)
        val h = max(1.0, heightPx - 2 * paddingPx)
        if (dx < 1e-12 && dy < 1e-12) return maxZoom
        val zx = if (dx > 0) ln(w / (dx * tileSizePx)) / ln(2.0) else maxZoom
        val zy = if (dy > 0) ln(h / (dy * tileSizePx)) / ln(2.0) else maxZoom
        return min(zx, zy).coerceIn(minZoom, maxZoom)
    }
}

/** Ramer–Douglas–Peucker line simplification, measured in meters on a local equirectangular plane. */
object Simplifier {
    fun simplify(points: List<LatLng>, toleranceMeters: Double): List<LatLng> {
        if (points.size < 3) return points
        val lat0 = Math.toRadians(points[0].lat)
        val kx = GeoMath.EARTH_RADIUS_M * cos(lat0) * PI / 180.0
        val ky = GeoMath.EARTH_RADIUS_M * PI / 180.0
        val xs = DoubleArray(points.size) { points[it].lng * kx }
        val ys = DoubleArray(points.size) { points[it].lat * ky }
        val keep = BooleanArray(points.size)
        keep[0] = true
        keep[points.lastIndex] = true
        val stack = ArrayDeque<IntArray>()
        stack.addLast(intArrayOf(0, points.lastIndex))
        while (stack.isNotEmpty()) {
            val (s, e) = stack.removeLast().let { it[0] to it[1] }
            var maxD = -1.0
            var idx = -1
            for (i in s + 1 until e) {
                val d = segmentDistance(xs[i], ys[i], xs[s], ys[s], xs[e], ys[e])
                if (d > maxD) { maxD = d; idx = i }
            }
            if (idx >= 0 && maxD > toleranceMeters) {
                keep[idx] = true
                stack.addLast(intArrayOf(s, idx))
                stack.addLast(intArrayOf(idx, e))
            }
        }
        return points.filterIndexed { i, _ -> keep[i] }
    }

    private fun segmentDistance(px: Double, py: Double, ax: Double, ay: Double, bx: Double, by: Double): Double {
        val dx = bx - ax
        val dy = by - ay
        val len2 = dx * dx + dy * dy
        if (len2 == 0.0) return sqrt((px - ax) * (px - ax) + (py - ay) * (py - ay))
        val t = (((px - ax) * dx + (py - ay) * dy) / len2).coerceIn(0.0, 1.0)
        val cx = ax + t * dx
        val cy = ay + t * dy
        return sqrt((px - cx) * (px - cx) + (py - cy) * (py - cy))
    }
}

/** Google encoded polyline format (precision 1e-5): compact storage for route previews. */
object PolylineCodec {
    fun encode(points: List<LatLng>): String {
        val sb = StringBuilder()
        var prevLat = 0L
        var prevLng = 0L
        for (p in points) {
            val lat = Math.round(p.lat * 1e5)
            val lng = Math.round(p.lng * 1e5)
            encodeValue(lat - prevLat, sb)
            encodeValue(lng - prevLng, sb)
            prevLat = lat
            prevLng = lng
        }
        return sb.toString()
    }

    fun decode(encoded: String): List<LatLng> {
        val out = ArrayList<LatLng>()
        var index = 0
        var lat = 0L
        var lng = 0L
        while (index < encoded.length) {
            val (dLat, i1) = decodeValue(encoded, index)
            if (i1 >= encoded.length) break
            val (dLng, i2) = decodeValue(encoded, i1)
            index = i2
            lat += dLat
            lng += dLng
            out.add(LatLng(lat / 1e5, lng / 1e5))
        }
        return out
    }

    private fun encodeValue(v: Long, sb: StringBuilder) {
        var value = if (v < 0) (v shl 1).inv() else v shl 1
        while (value >= 0x20) {
            sb.append(((0x20 or (value and 0x1f).toInt()) + 63).toChar())
            value = value shr 5
        }
        sb.append((value + 63).toInt().toChar())
    }

    private fun decodeValue(s: String, start: Int): Pair<Long, Int> {
        var result = 0L
        var shift = 0
        var i = start
        while (i < s.length) {
            val b = s[i++].code - 63
            result = result or ((b and 0x1f).toLong() shl shift)
            shift += 5
            if (b < 0x20) break
        }
        val value = if (result and 1L != 0L) (result shr 1).inv() else result shr 1
        return value to i
    }
}

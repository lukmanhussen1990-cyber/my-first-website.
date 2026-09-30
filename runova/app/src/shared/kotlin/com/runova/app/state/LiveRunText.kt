package com.runova.app.state

import com.runova.app.ui.model.GpsSignal
import com.runova.core.format.Fmt
import com.runova.core.format.UnitConv
import com.runova.core.model.UnitSystem
import com.runova.core.tracking.SplitEvent
import java.time.Instant
import java.time.format.DateTimeFormatter
import java.time.format.FormatStyle
import java.time.temporal.ChronoUnit
import java.util.Locale
import kotlin.math.roundToInt

/** Grades the GPS fix for the signal chip on the run screen. */
object GpsQuality {
    fun classify(accuracyM: Float?, secondsSinceFix: Long?): GpsSignal = when {
        accuracyM == null || secondsSinceFix == null || secondsSinceFix > 10 -> GpsSignal.NONE
        accuracyM <= 10f -> GpsSignal.GOOD
        accuracyM <= 20f -> GpsSignal.FAIR
        else -> GpsSignal.WEAK
    }
}

/** Texts spoken and shown during a run. */
object RunVoice {
    private fun unitWord(units: UnitSystem, n: Int) = when {
        units == UnitSystem.METRIC && n == 1 -> "kilometer"
        units == UnitSystem.METRIC -> "kilometers"
        n == 1 -> "mile"
        else -> "miles"
    }

    fun spokenDuration(ms: Long): String {
        val total = ms.coerceAtLeast(0) / 1000
        val h = total / 3600
        val m = (total % 3600) / 60
        val s = total % 60
        val parts = ArrayList<String>()
        if (h > 0) parts += "$h ${if (h == 1L) "hour" else "hours"}"
        if (m > 0) parts += "$m ${if (m == 1L) "minute" else "minutes"}"
        if (s > 0 || parts.isEmpty()) parts += "$s ${if (s == 1L) "second" else "seconds"}"
        return parts.joinToString(" ")
    }

    fun splitAnnouncement(e: SplitEvent, units: UnitSystem): String {
        val n = e.index
        val unit = if (units == UnitSystem.METRIC) "kilometer" else "mile"
        return "$n ${unitWord(units, n)}. Time, ${spokenDuration(e.totalMovingMs)}. Last $unit, ${spokenDuration(e.splitDurationMs)}."
    }

    fun splitToast(e: SplitEvent, units: UnitSystem): String {
        val label = if (units == UnitSystem.METRIC) "Km" else "Mile"
        val secPerKm = e.splitDurationMs / 1000.0 / (UnitConv.unitMeters(units) / 1000.0)
        return "$label ${e.index} • ${Fmt.pace(secPerKm, units)} ${Fmt.paceUnit(units)}"
    }

    fun spokenDistance(meters: Double, units: UnitSystem): String {
        if (units == UnitSystem.METRIC && meters < 1000) return "${(meters / 10).roundToInt() * 10} meters"
        val v = meters / UnitConv.unitMeters(units)
        val value = String.format(Locale.US, if (v >= 10) "%.0f" else "%.1f", v)
        return "$value ${if (units == UnitSystem.METRIC) "kilometers" else "miles"}"
    }

    fun finishAnnouncement(distanceM: Double, movingMs: Long, units: UnitSystem): String =
        "Run complete. ${spokenDistance(distanceM, units)} in ${spokenDuration(movingMs)}. Great work!"

    const val PAUSED = "Run paused."
    const val RESUMED = "Run resumed."
    const val AUTO_PAUSED = "Auto paused."
    const val GPS_LOST = "GPS signal lost."
}

/** One-line summary of an unfinished run for the recovery dialog. */
fun recoverySummary(startMs: Long, distanceM: Double, movingMs: Long, units: UnitSystem, env: UiEnv): String {
    val start = Instant.ofEpochMilli(startMs).atZone(env.zone)
    val days = ChronoUnit.DAYS.between(start.toLocalDate(), env.today)
    val time = start.format(DateTimeFormatter.ofLocalizedTime(FormatStyle.SHORT).withLocale(env.locale))
    val day = when (days) {
        0L -> "today"
        1L -> "yesterday"
        else -> start.format(DateTimeFormatter.ofPattern("EEE d MMM", env.locale))
    }
    return "A run you started $day at $time was interrupted: ${Fmt.distance(distanceM, units)} in ${Fmt.durationCompact(movingMs)}. Resume it, save it as it is, or discard it."
}

package com.runova.core.format

import com.runova.core.model.UnitSystem
import java.text.NumberFormat
import java.util.Locale
import kotlin.math.abs
import kotlin.math.roundToInt
import kotlin.math.roundToLong

object UnitConv {
    const val METERS_PER_KM = 1000.0
    const val METERS_PER_MILE = 1609.344
    const val FEET_PER_METER = 3.280839895
    const val LB_PER_KG = 2.20462262185
    const val CM_PER_INCH = 2.54

    fun unitMeters(units: UnitSystem): Double = if (units == UnitSystem.METRIC) METERS_PER_KM else METERS_PER_MILE

    fun kmToDisplay(km: Double, units: UnitSystem): Double = if (units == UnitSystem.METRIC) km else km * 1000.0 / METERS_PER_MILE

    fun displayToKm(value: Double, units: UnitSystem): Double = if (units == UnitSystem.METRIC) value else value * METERS_PER_MILE / 1000.0

    fun kgToLb(kg: Double) = kg * LB_PER_KG
    fun lbToKg(lb: Double) = lb / LB_PER_KG

    fun cmToFeetInches(cm: Double): Pair<Int, Int> {
        val totalIn = (cm / CM_PER_INCH).roundToInt()
        return (totalIn / 12) to (totalIn % 12)
    }

    fun feetInchesToCm(feet: Int, inches: Int): Double = (feet * 12 + inches) * CM_PER_INCH
}

/** All user-facing number formatting lives here so the UI stays consistent. */
object Fmt {
    fun distanceUnit(units: UnitSystem): String = if (units == UnitSystem.METRIC) "km" else "mi"

    fun paceUnit(units: UnitSystem): String = if (units == UnitSystem.METRIC) "/km" else "/mi"

    fun distanceValue(meters: Double, units: UnitSystem, decimals: Int = 2): String {
        val v = meters / UnitConv.unitMeters(units)
        return String.format(Locale.US, "%.${decimals}f", v)
    }

    fun distance(meters: Double, units: UnitSystem, decimals: Int = 2): String =
        "${distanceValue(meters, units, decimals)} ${distanceUnit(units)}"

    /** Converts a pace in s/km into the display unit and formats it as m:ss. */
    fun pace(secPerKm: Double?, units: UnitSystem): String {
        if (secPerKm == null || secPerKm.isNaN() || secPerKm.isInfinite() || secPerKm <= 0 || secPerKm > 5_940) return "--:--"
        val perUnit = if (units == UnitSystem.METRIC) secPerKm else secPerKm * UnitConv.METERS_PER_MILE / 1000.0
        val total = perUnit.roundToLong()
        return String.format(Locale.US, "%d:%02d", total / 60, total % 60)
    }

    /** Timer style "00:32:18". */
    fun clock(ms: Long): String {
        val s = (ms.coerceAtLeast(0) / 1000)
        return String.format(Locale.US, "%02d:%02d:%02d", s / 3600, (s % 3600) / 60, s % 60)
    }

    /** "32:18" below an hour, "1:02:03" above. */
    fun durationCompact(ms: Long): String {
        val s = (ms.coerceAtLeast(0) / 1000)
        return if (s >= 3600) String.format(Locale.US, "%d:%02d:%02d", s / 3600, (s % 3600) / 60, s % 60)
        else String.format(Locale.US, "%d:%02d", s / 60, s % 60)
    }

    /** "3h 12m", "42 min", "45 s". */
    fun durationWords(ms: Long): String {
        val totalMin = ms.coerceAtLeast(0) / 60_000
        return when {
            totalMin >= 60 -> "${totalMin / 60}h ${totalMin % 60}m"
            totalMin >= 1 -> "$totalMin min"
            else -> "${ms.coerceAtLeast(0) / 1000} s"
        }
    }

    fun integer(n: Long, locale: Locale = Locale.getDefault()): String = NumberFormat.getIntegerInstance(locale).format(n)

    fun integer(n: Int, locale: Locale = Locale.getDefault()): String = integer(n.toLong(), locale)

    fun calories(kcal: Double, locale: Locale = Locale.getDefault()): String = integer(kcal.roundToLong(), locale)

    fun elevationValue(meters: Double, units: UnitSystem): String =
        if (units == UnitSystem.METRIC) meters.roundToInt().toString() else (meters * UnitConv.FEET_PER_METER).roundToInt().toString()

    fun elevationUnit(units: UnitSystem): String = if (units == UnitSystem.METRIC) "m" else "ft"

    fun elevation(meters: Double, units: UnitSystem): String = "${elevationValue(meters, units)} ${elevationUnit(units)}"

    fun speed(mps: Double, units: UnitSystem): String {
        val v = if (units == UnitSystem.METRIC) mps * 3.6 else mps * 3600 / UnitConv.METERS_PER_MILE
        return String.format(Locale.US, "%.1f %s", v, if (units == UnitSystem.METRIC) "km/h" else "mph")
    }

    fun weight(kg: Double, units: UnitSystem): String =
        if (units == UnitSystem.METRIC) String.format(Locale.US, "%.1f kg", kg) else String.format(Locale.US, "%.0f lb", UnitConv.kgToLb(kg))

    fun height(cm: Double, units: UnitSystem): String =
        if (units == UnitSystem.METRIC) "${cm.roundToInt()} cm" else UnitConv.cmToFeetInches(cm).let { (f, i) -> "$f′ $i″" }

    /** Signed percentage like "+12%" or "−4%". */
    fun percentChange(fraction: Double): String {
        val p = (fraction * 100).roundToInt()
        return when {
            p > 0 -> "+$p%"
            p < 0 -> "−${abs(p)}%"
            else -> "0%"
        }
    }

    /** Distance with adaptive precision for sentences: "1.2 km", "850 m". */
    fun distanceSpoken(meters: Double, units: UnitSystem): String {
        if (units == UnitSystem.METRIC && meters < 1000) return "${(meters / 10).roundToInt() * 10} m"
        val v = meters / UnitConv.unitMeters(units)
        val s = if (v >= 10) String.format(Locale.US, "%.0f", v) else String.format(Locale.US, "%.1f", v)
        return "$s ${distanceUnit(units)}"
    }
}

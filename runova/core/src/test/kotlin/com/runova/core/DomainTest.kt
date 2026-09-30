package com.runova.core

import com.runova.core.coach.CoachEngine
import com.runova.core.coach.CoachSnapshot
import com.runova.core.export.Gpx
import com.runova.core.format.Fmt
import com.runova.core.geo.GeoBounds
import com.runova.core.geo.GeoMath
import com.runova.core.geo.LatLng
import com.runova.core.geo.Mercator
import com.runova.core.geo.PolylineCodec
import com.runova.core.geo.Simplifier
import com.runova.core.metrics.CalorieEstimator
import com.runova.core.metrics.StrideEstimator
import com.runova.core.model.BodyProfile
import com.runova.core.model.GoalMetric
import com.runova.core.model.GoalPeriod
import com.runova.core.model.GoalTargets
import com.runova.core.model.Goals
import com.runova.core.model.RunRecord
import com.runova.core.model.UnitSystem
import com.runova.core.progress.AchievementInput
import com.runova.core.progress.Achievements
import com.runova.core.progress.Levels
import com.runova.core.progress.Streaks
import com.runova.core.progress.XpRules
import com.runova.core.stats.StatsCalculator
import com.runova.core.stats.StatsRange
import com.runova.core.tracking.TrackPoint
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.ZoneId
import java.time.ZoneOffset
import java.util.Locale

private val UTC: ZoneId = ZoneOffset.UTC

private fun at(y: Int, m: Int, d: Int, h: Int = 7, min: Int = 0): Long =
    LocalDateTime.of(y, m, d, h, min).atZone(UTC).toInstant().toEpochMilli()

private fun run(id: Long, start: Long, km: Double, minutes: Double, kcal: Double = km * 70, climb: Double = 0.0, steps: Int? = null) =
    RunRecord(
        id = id,
        startTimeMs = start,
        endTimeMs = start + (minutes * 60_000).toLong(),
        movingTimeMs = (minutes * 60_000).toLong(),
        distanceM = km * 1000,
        calories = kcal,
        steps = steps,
        elevationGainM = climb,
    )

class GeoTest {
    @Test
    fun haversineMatchesKnownDistances() {
        // one degree of latitude ≈ 111.2 km
        assertEquals(111_195.0, GeoMath.distanceMeters(0.0, 0.0, 1.0, 0.0), 50.0)
        // London -> Paris ≈ 343.5 km
        assertEquals(343_500.0, GeoMath.distanceMeters(51.5074, -0.1278, 48.8566, 2.3522), 1_500.0)
    }

    @Test
    fun offsetRoundTrip() {
        val a = LatLng(40.0, -74.0)
        val b = GeoMath.offset(a, 1234.0, 37.0)
        assertEquals(1234.0, GeoMath.distanceMeters(a, b), 0.5)
    }

    @Test
    fun polylineMatchesGoogleReferenceAndRoundTrips() {
        val pts = listOf(LatLng(38.5, -120.2), LatLng(40.7, -120.95), LatLng(43.252, -126.453))
        val enc = PolylineCodec.encode(pts)
        assertEquals("_p~iF~ps|U_ulLnnqC_mqNvxq`@", enc)
        val dec = PolylineCodec.decode(enc)
        assertEquals(3, dec.size)
        dec.zip(pts).forEach { (x, y) -> assertEquals(y.lat, x.lat, 1e-5); assertEquals(y.lng, x.lng, 1e-5) }
    }

    @Test
    fun simplifierKeepsCornersAndDropsCollinearPoints() {
        val start = LatLng(52.0, 13.0)
        val line = (0..100).map { GeoMath.offset(start, it * 10.0, 90.0) }
        val corner = line.last()
        val up = (1..100).map { GeoMath.offset(corner, it * 10.0, 0.0) }
        val simplified = Simplifier.simplify(line + up, 2.0)
        assertTrue("size ${simplified.size}", simplified.size in 3..5)
    }

    @Test
    fun mercatorRoundTripAndFit() {
        val lat = 48.8566
        val lng = 2.3522
        assertEquals(lat, Mercator.lat(Mercator.y(lat)), 1e-9)
        assertEquals(lng, Mercator.lng(Mercator.x(lng)), 1e-9)
        val b = GeoBounds.of(listOf(LatLng(48.85, 2.34), LatLng(48.87, 2.37)))!!
        val z = Mercator.zoomToFit(b, 1080.0, 1080.0, 512.0, 64.0)
        assertTrue("zoom $z", z in 13.0..15.5)
    }
}

class EstimatorTest {
    @Test
    fun acsmVo2() {
        // 10 km/h running on flat ground
        assertEquals(36.83, CalorieEstimator.vo2(10 / 3.6, 0.0), 0.05)
        // 5 km/h walking on flat ground: 0.1 * 83.3 + 3.5
        assertEquals(11.83, CalorieEstimator.vo2(5 / 3.6, 0.0), 0.05)
        // grade raises the cost
        assertTrue(CalorieEstimator.vo2(10 / 3.6, 0.05) > CalorieEstimator.vo2(10 / 3.6, 0.0))
    }

    @Test
    fun walkingCaloriesFromSteps() {
        val kcal = CalorieEstimator.walkingKcalFromSteps(5_000, BodyProfile(70.0, 175.0))
        assertEquals(127.0, kcal, 10.0)
        assertEquals(0.0, CalorieEstimator.walkingKcalFromSteps(0, BodyProfile()), 0.0)
    }

    @Test
    fun strideGrowsWithSpeed() {
        assertTrue(StrideEstimator.stepLengthM(175.0, 4.0) > StrideEstimator.stepLengthM(175.0, 1.3))
        assertEquals(0.726, StrideEstimator.walkingStepLengthM(175.0), 0.001)
    }
}

class ProgressionTest {
    @Test
    fun levelThresholds() {
        assertEquals(1, Levels.levelFor(0))
        assertEquals(1, Levels.levelFor(199))
        assertEquals(2, Levels.levelFor(200))
        assertEquals(8, Levels.levelFor(12_450))
        assertEquals(10, Levels.levelFor(16_200))
        assertEquals(9, Levels.levelFor(16_199))
        val p = Levels.progress(12_450)
        assertEquals(8, p.level)
        assertEquals(12_800L - 12_450L, p.xpToNext)
        assertEquals(0.883f, p.fraction, 0.01f)
        assertTrue(p.fraction in 0.0f..1.0f)
    }

    @Test
    fun runXpIsItemised() {
        val xp = XpRules.forRun(5_210.0, (32 * 60 + 18) * 1000L, firstRunOfDay = true)
        assertEquals(listOf(261, 65, 25, 50), xp.map { it.amount })
    }

    @Test
    fun streaks() {
        val today = LocalDate.of(2026, 9, 30)
        val days = setOf(today.minusDays(1), today.minusDays(2), today.minusDays(3), today.minusDays(6))
        assertEquals(3, Streaks.current(days, today))
        assertEquals(4, Streaks.current(days + today, today))
        assertEquals(0, Streaks.current(setOf(today.minusDays(2)), today))
        assertEquals(3, Streaks.longest(days))
    }
}

class AchievementTest {
    private fun input(runs: List<RunRecord>, streak: Int = 0, level: Int = 1, perfect: Int = 0) =
        AchievementInput(runs, streak, level, perfect, UTC)

    @Test
    fun firstFiveK() {
        val none = Achievements.newlyUnlocked(input(listOf(run(1, at(2026, 9, 1), 4.9, 30.0))), emptySet())
        assertTrue(none.none { it.id == "first_5k" })
        val unlocked = Achievements.newlyUnlocked(input(listOf(run(1, at(2026, 9, 1), 5.21, 32.3))), emptySet())
        assertTrue(unlocked.any { it.id == "first_5k" })
        assertTrue(unlocked.any { it.id == "first_run" })
        val again = Achievements.newlyUnlocked(input(listOf(run(1, at(2026, 9, 1), 5.21, 32.3))), setOf("first_5k", "first_run"))
        assertTrue(again.none { it.id == "first_5k" || it.id == "first_run" })
    }

    @Test
    fun timeOfDayBadges() {
        val night = Achievements.newlyUnlocked(input(listOf(run(1, at(2026, 9, 1, 22, 15), 3.0, 20.0))), emptySet())
        assertTrue(night.any { it.id == "night_runner" })
        val early = Achievements.newlyUnlocked(input(listOf(run(1, at(2026, 9, 1, 6, 5), 3.0, 20.0))), emptySet())
        assertTrue(early.any { it.id == "early_bird" })
        assertFalse(early.any { it.id == "night_runner" })
    }

    @Test
    fun speedWeekendAndProgress() {
        val runs = listOf(
            run(1, at(2026, 9, 26, 9), 3.2, 15.0), // Saturday, 4:41 /km
            run(2, at(2026, 9, 27, 9), 2.0, 14.0), // Sunday
        )
        val unlocked = Achievements.newlyUnlocked(input(runs), emptySet()).map { it.id }
        assertTrue("speed_demon" in unlocked)
        assertTrue("weekend_warrior" in unlocked)
        val half = Achievements.evaluate(input(runs)).first { it.def.id == "half_marathon" }
        assertEquals(3.2 / 21.0975, half.fraction.toDouble(), 0.01)
    }
}

class StatsTest {
    private val runs = listOf(
        run(1, at(2026, 9, 28), 5.0, 30.0, kcal = 350.0), // Mon
        run(2, at(2026, 9, 30), 3.0, 20.0, kcal = 210.0), // Wed
        run(3, at(2026, 10, 3), 8.0, 50.0, kcal = 520.0), // Sat
        run(4, at(2026, 9, 21), 4.0, 26.0, kcal = 280.0), // previous week
    )

    @Test
    fun weekBucketsStartOnMonday() {
        val s = StatsCalculator.compute(StatsRange.WEEK, LocalDate.of(2026, 9, 30), runs, UTC, Locale.US)
        assertEquals(LocalDate.of(2026, 9, 28), s.start)
        assertEquals(7, s.buckets.size)
        assertEquals("Mon", s.buckets[0].label)
        assertEquals(3, s.runs)
        assertEquals(1080.0, s.calories, 0.01)
        assertEquals(16_000.0, s.distanceM, 0.01)
        assertEquals(3, s.activeDays)
        assertEquals(520.0, s.buckets[5].calories, 0.01)
        assertEquals(375.0, s.avgPaceSecPerKm!!, 0.5)
    }

    @Test
    fun monthAndYear() {
        val m = StatsCalculator.compute(StatsRange.MONTH, LocalDate.of(2026, 9, 15), runs, UTC, Locale.US)
        assertEquals(30, m.buckets.size)
        assertEquals(3, m.runs)
        val y = StatsCalculator.compute(StatsRange.YEAR, LocalDate.of(2026, 9, 15), runs, UTC, Locale.US)
        assertEquals(12, y.buckets.size)
        assertEquals(4, y.runs)
        assertEquals("Oct", y.buckets[9].label)
    }

    @Test
    fun dayActivityAddsWalkingCaloriesFromExtraSteps() {
        val profile = BodyProfile(70.0, 175.0)
        val day = LocalDate.of(2026, 9, 30)
        val withRunSteps = listOf(run(2, at(2026, 9, 30), 3.0, 20.0, kcal = 210.0, steps = 3_000))
        val a = StatsCalculator.dayActivity(day, withRunSteps, UTC, 8_000, profile)
        assertEquals(8_000, a.steps)
        assertTrue(a.calories > 210.0 + 100) // 5,000 extra walking steps ≈ 127 kcal
        val b = StatsCalculator.dayActivity(day, withRunSteps, UTC, null, profile)
        assertEquals(3_000, b.steps)
        assertEquals(210.0, b.calories, 0.01)
    }

    @Test
    fun weeklyGoalProgressSumsDays() {
        val goals = Goals(weekly = GoalTargets(3_000, 20.0, 50_000, 200))
        val p = StatsCalculator.goalProgress(GoalPeriod.WEEKLY, LocalDate.of(2026, 9, 30), runs, UTC, emptyMap(), BodyProfile(), goals)
        val d = p.first { it.metric == GoalMetric.DISTANCE }
        assertEquals(16.0, d.current, 0.01)
        assertEquals(4.0, d.remaining, 0.01)
        assertEquals(0.8f, d.fraction, 0.001f)
    }
}

class FmtTest {
    @Test
    fun paceAndTimes() {
        assertEquals("6:11", Fmt.pace(371.0, UnitSystem.METRIC))
        assertEquals("9:57", Fmt.pace(371.0, UnitSystem.IMPERIAL))
        assertEquals("--:--", Fmt.pace(null, UnitSystem.METRIC))
        assertEquals("--:--", Fmt.pace(Double.POSITIVE_INFINITY, UnitSystem.METRIC))
        assertEquals("00:32:18", Fmt.clock((32 * 60 + 18) * 1000L))
        assertEquals("32:18", Fmt.durationCompact((32 * 60 + 18) * 1000L))
        assertEquals("1:02:03", Fmt.durationCompact((3723) * 1000L))
        assertEquals("3h 12m", Fmt.durationWords((3 * 60 + 12) * 60_000L))
    }

    @Test
    fun distances() {
        assertEquals("5.21", Fmt.distanceValue(5_210.0, UnitSystem.METRIC))
        assertEquals("3.24", Fmt.distanceValue(5_210.0, UnitSystem.IMPERIAL))
        assertEquals("1.2 km", Fmt.distanceSpoken(1_200.0, UnitSystem.METRIC))
        assertEquals("850 m", Fmt.distanceSpoken(846.0, UnitSystem.METRIC))
        assertEquals("7,842", Fmt.integer(7_842, Locale.US))
        assertEquals("+12%", Fmt.percentChange(0.12))
    }
}

class CoachTest {
    private val zone = UTC
    private val now = LocalDateTime.of(2026, 9, 30, 18, 0) // Wednesday evening
    private val profile = BodyProfile(72.0, 178.0)

    private fun snapshot(runs: List<RunRecord>, goals: Goals = Goals()): CoachSnapshot {
        val today = now.toLocalDate()
        fun p(period: GoalPeriod) = StatsCalculator.goalProgress(period, today, runs, zone, emptyMap(), profile, goals)
        val days = Streaks.activeDays(runs, zone)
        return CoachSnapshot(
            now = now,
            zone = zone,
            name = "Imran",
            units = UnitSystem.METRIC,
            profile = profile,
            goals = goals,
            runs = runs,
            today = StatsCalculator.dayActivity(today, runs, zone, null, profile),
            daily = p(GoalPeriod.DAILY),
            weekly = p(GoalPeriod.WEEKLY),
            monthly = p(GoalPeriod.MONTHLY),
            currentStreak = Streaks.current(days, today),
            longestStreak = Streaks.longest(days),
            level = Levels.progress(runs.sumOf { it.xpEarned }.toLong()),
            achievements = Achievements.evaluate(AchievementInput(runs, Streaks.longest(days), 1, 0, zone)),
        )
    }

    @Test
    fun goalAndTrendInsightsReadNaturally() {
        val goals = Goals(
            daily = GoalTargets(650, 6.6, 10_000, 60),
            weekly = GoalTargets(3_500, 20.0, 60_000, 300),
        )
        val runs = listOf(
            // last week: 10 km in 66 min (6:36 /km)
            run(1, at(2026, 9, 22), 5.0, 33.0),
            run(2, at(2026, 9, 24), 5.0, 33.0),
            // this week: 5.4 today and 12.2 earlier, faster
            run(3, at(2026, 9, 28), 6.2, 36.0),
            run(4, at(2026, 9, 29), 6.0, 34.8),
            run(5, at(2026, 9, 30, 7), 5.4, 31.3),
        )
        val insights = CoachEngine.insights(snapshot(runs, goals)).map { it.text }
        assertTrue(insights.joinToString("\n"), insights.any { it.startsWith("You're 1.2 km away from your daily goal") })
        assertTrue(insights.joinToString("\n"), insights.any { it.startsWith("You need another 2.4 km to complete your weekly goal") })
        assertTrue(insights.joinToString("\n"), insights.any { it.startsWith("Your pace improved by 12% compared to last week") })
        assertTrue(insights.any { it.contains("3-day streak") })
    }

    @Test
    fun answersQuestionsFromData() {
        val runs = listOf(run(1, at(2026, 9, 28), 5.0, 30.0), run(2, at(2026, 9, 29), 3.2, 19.0))
        val s = snapshot(runs)
        assertTrue(CoachEngine.answer("How far did I run this week?", s).startsWith("This week you've run 8.2 km over 2 runs"))
        assertTrue(CoachEngine.answer("what's my longest run", s).contains("5.0 km"))
        assertTrue(CoachEngine.answer("streak?", s).contains("2-day streak"))
        assertTrue(CoachEngine.answer("Tell me a joke about quantum bananas", s).startsWith("I'm your offline coach"))
        assertTrue(CoachEngine.contextSummary(s).contains("Recent runs"))
    }

    @Test
    fun welcomesNewUsers() {
        val first = CoachEngine.insights(snapshot(emptyList())).first()
        assertTrue(first.text.startsWith("Welcome to RUNOVA, Imran!"))
    }
}

class GpxTest {
    @Test
    fun writesSegmentsAndPoints() {
        val pts = listOf(
            TrackPoint(1_790_000_000_000, 52.5, 13.4, 34.0, 5f, 3f, 0, 0.0, 0),
            TrackPoint(1_790_000_001_000, 52.5001, 13.4001, 34.5, 5f, 3f, 0, 13.0, 1000, heartRate = 140),
            TrackPoint(1_790_000_090_000, 52.5002, 13.4002, null, 5f, 3f, 1, 26.0, 2000),
        )
        val gpx = Gpx.build("Morning Run & Coffee", pts)
        assertEquals(2, Regex("<trkseg>").findAll(gpx).count())
        assertEquals(3, Regex("<trkpt ").findAll(gpx).count())
        assertTrue(gpx.contains("Morning Run &amp; Coffee"))
        assertTrue(gpx.contains("<gpxtpx:hr>140</gpxtpx:hr>"))
        assertTrue(gpx.contains("<time>2026-09-21T"))
    }
}

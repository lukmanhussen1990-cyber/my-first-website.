package com.runova.core

import com.runova.core.geo.GeoMath
import com.runova.core.model.BodyProfile
import com.runova.core.tracking.RejectReason
import com.runova.core.tracking.RunAnalysis
import com.runova.core.tracking.RunStatus
import com.runova.core.tracking.RunTracker
import com.runova.core.tracking.SampleResult
import com.runova.core.tracking.TrackingConfig
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import kotlin.math.abs

class RunTrackerTest {
    private val profile = BodyProfile(weightKg = 70.0, heightCm = 175.0)

    private fun tracker(sim: RouteSimulator, config: TrackingConfig = TrackingConfig()) =
        RunTracker(sim.wall, sim.elapsed, profile, config)

    private fun RunTracker.feed(samples: List<com.runova.core.tracking.LocationSample>) {
        for (s in samples) {
            onLocation(s)
            tick(s.elapsedMs)
        }
    }

    @Test
    fun steadyRunProducesExpectedDistanceTimeAndPace() {
        val sim = RouteSimulator()
        val t = tracker(sim)
        t.feed(sim.run(seconds = 600, speedMps = 3.0))
        val moving = t.movingTimeMs(sim.elapsed)
        assertEquals(600_000L, moving)
        assertEquals(1800.0, t.distanceM, 1800 * 0.04)
        val avg = t.averagePaceSecPerKm(sim.elapsed)!!
        assertEquals(333.3, avg, 12.0)
        val current = t.currentPaceSecPerKm()!!
        assertEquals(333.3, current, 25.0)
    }

    @Test
    fun pauseExcludesTimeAndDistanceAndStartsNewSegment() {
        val sim = RouteSimulator()
        val t = tracker(sim)
        t.feed(sim.run(120, 3.0))
        val distBeforePause = t.distanceM
        t.pause(sim.elapsed)
        assertEquals(RunStatus.PAUSED, t.status)
        assertNull(t.currentPaceSecPerKm())
        val during = sim.run(60, 3.0)
        during.forEach { assertEquals(SampleResult.Rejected(RejectReason.NOT_RECORDING), t.onLocation(it)) }
        assertEquals(distBeforePause, t.distanceM, 0.0001)
        t.resume(sim.elapsed)
        t.feed(sim.run(120, 3.0))
        assertEquals(240_000L, t.movingTimeMs(sim.elapsed))
        assertEquals(720.0, t.distanceM, 720 * 0.04)
        assertEquals(2, RunAnalysis.segments(t.points).size)
    }

    @Test
    fun gpsSpikeIsRejected() {
        val sim = RouteSimulator()
        val t = tracker(sim)
        t.feed(sim.run(30, 3.0))
        val before = t.distanceM
        val good = sim.run(1, 3.0).first()
        val far = GeoMath.offset(com.runova.core.geo.LatLng(good.lat, good.lng), 800.0, 0.0)
        val spike = good.copy(lat = far.lat, lng = far.lng)
        assertEquals(SampleResult.Rejected(RejectReason.SPEED_SPIKE), t.onLocation(spike))
        assertEquals(before, t.distanceM, 0.0001)
        t.feed(sim.run(30, 3.0))
        assertEquals(183.0, t.distanceM, 12.0)
    }

    @Test
    fun inaccurateFixesAreIgnored() {
        val sim = RouteSimulator()
        val t = tracker(sim)
        val bad = sim.run(20, 3.0, accuracy = 60f)
        bad.forEach { assertEquals(SampleResult.Rejected(RejectReason.LOW_ACCURACY), t.onLocation(it)) }
        assertEquals(0.0, t.distanceM, 0.0)
        assertEquals(60f, t.lastAccuracyM)
    }

    @Test
    fun standingStillDoesNotAccumulateJitter() {
        val sim = RouteSimulator()
        val t = tracker(sim)
        t.feed(sim.standStill(120, noiseM = 3.0))
        assertTrue("jitter distance ${t.distanceM}", t.distanceM < 8.0)
    }

    @Test
    fun autoPauseAndAutoResume() {
        val sim = RouteSimulator()
        val t = tracker(sim, TrackingConfig(autoPause = true))
        t.feed(sim.run(60, 3.0))
        t.feed(sim.standStill(30, noiseM = 1.0))
        assertEquals(RunStatus.AUTO_PAUSED, t.status)
        val frozen = t.movingTimeMs(sim.elapsed)
        assertTrue("moving time $frozen", frozen in 60_000L..70_000L)
        t.feed(sim.standStill(20, noiseM = 1.0))
        assertEquals(frozen, t.movingTimeMs(sim.elapsed))
        t.feed(sim.run(30, 3.0))
        assertEquals(RunStatus.RUNNING, t.status)
        assertTrue(t.movingTimeMs(sim.elapsed) > frozen + 25_000)
    }

    @Test
    fun splitsAndSplitEvents() {
        val sim = RouteSimulator()
        val t = tracker(sim)
        t.feed(sim.run(seconds = 834, speedMps = 3.0, noiseM = 0.0)) // ≈ 2.5 km
        val events = t.drainSplitEvents()
        assertEquals(2, events.size)
        assertEquals(1, events[0].index)
        assertEquals(333_333.0, events[0].splitDurationMs.toDouble(), 5_000.0)
        assertEquals(333_333.0, events[1].splitDurationMs.toDouble(), 5_000.0)
        assertTrue(t.drainSplitEvents().isEmpty())
        val splits = RunAnalysis.splits(t.points, 1000.0)
        assertEquals(3, splits.size)
        assertEquals(1000.0, splits[0].distanceM, 0.0)
        assertEquals(333.3, splits[1].paceSecPerUnit(1000.0)!!, 6.0)
        assertTrue(splits[2].distanceM in 400.0..600.0)
    }

    @Test
    fun caloriesFollowAcsmRunningEquation() {
        val sim = RouteSimulator()
        val t = tracker(sim)
        val speed = 10.0 / 3.6
        t.feed(sim.run(seconds = 1800, speedMps = speed, noiseM = 0.5))
        // ACSM: VO2 = 0.2 * 166.7 + 3.5 = 36.8 ml/kg/min -> 12.9 kcal/min for 70 kg -> ~387 kcal
        assertEquals(387.0, t.calories, 387 * 0.05)
    }

    @Test
    fun elevationGainIsSmoothed() {
        val sim = RouteSimulator()
        val t = tracker(sim)
        t.feed(sim.run(seconds = 500, speedMps = 3.0, climbPerSecond = 0.1)) // +50 m
        assertEquals(50.0, t.elevationGainM, 8.0)
        assertTrue(t.elevationLossM < 5.0)
    }

    @Test
    fun sensorStepsOnlyCountWhileRunning() {
        val sim = RouteSimulator()
        val t = tracker(sim)
        t.onStepCounter(10_000)
        t.feed(sim.run(60, 3.0))
        t.onStepCounter(10_170)
        t.pause(sim.elapsed)
        t.onStepCounter(10_250)
        t.resume(sim.elapsed)
        t.onStepCounter(10_300)
        val summary = t.finish(sim.elapsed, sim.wall)
        assertEquals(220, summary.steps)
        assertEquals(false, summary.stepsEstimated)
    }

    @Test
    fun stepsAreEstimatedWithoutSensor() {
        val sim = RouteSimulator()
        val t = tracker(sim)
        t.feed(sim.run(600, 3.0))
        val summary = t.finish(sim.elapsed, sim.wall)
        assertNotNull(summary.steps)
        assertTrue(summary.stepsEstimated)
        assertTrue("steps ${summary.steps}", summary.steps!! in 1500..3200)
    }

    @Test
    fun restoreAfterProcessDeathContinuesTheRun() {
        val sim = RouteSimulator()
        val t = tracker(sim)
        t.feed(sim.run(300, 3.0))
        val checkpoint = t.checkpoint(sim.elapsed)
        val points = t.points.toList()
        sim.advance(120_000) // process was dead for two minutes
        val restored = RunTracker.restore(t.startWallTimeMs, sim.elapsed, profile, TrackingConfig(), points, checkpoint)
        assertEquals(RunStatus.PAUSED, restored.status)
        assertEquals(checkpoint.movingTimeMs, restored.movingTimeMs(sim.elapsed))
        restored.resume(sim.elapsed)
        restored.feed(sim.run(300, 3.0))
        val s = restored.finish(sim.elapsed, sim.wall)
        assertEquals(600_000L, s.movingTimeMs)
        assertEquals(1800.0, s.distanceM, 1800 * 0.04)
        assertEquals(2, RunAnalysis.segments(restored.points).size)
    }

    @Test
    fun finishingFreezesEverything() {
        val sim = RouteSimulator()
        val t = tracker(sim)
        t.feed(sim.run(100, 3.0))
        val s = t.finish(sim.elapsed, sim.wall)
        assertEquals(RunStatus.FINISHED, t.status)
        assertEquals(SampleResult.Rejected(RejectReason.NOT_RECORDING), t.onLocation(sim.run(1, 3.0).first()))
        assertEquals(s.movingTimeMs, t.movingTimeMs(sim.elapsed + 60_000))
        assertTrue(abs(s.distanceM - 300) < 15)
    }
}

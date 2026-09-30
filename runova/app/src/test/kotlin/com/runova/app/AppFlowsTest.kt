package com.runova.app

import android.location.Location
import android.os.Looper
import android.os.SystemClock
import com.runova.app.data.SettingsStore
import com.runova.app.state.UserProfile
import com.runova.app.tracking.RunSession
import com.runova.app.ui.model.InboxKind
import com.runova.app.ui.model.LiveStatus
import com.runova.core.geo.GeoMath
import com.runova.core.geo.LatLng
import com.runova.core.model.UnitSystem
import com.runova.core.tracking.RunTracker
import com.runova.core.tracking.TrackPoint
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.runBlocking
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.Shadows.shadowOf
import org.robolectric.annotation.Config
import org.robolectric.shadows.ShadowSystemClock
import java.time.Duration
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue

/**
 * End-to-end flows on a Robolectric device: recording a run with GPS fixes, pausing and
 * resuming, saving with rewards, and recovering a run after the process died.
 */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35])
class AppFlowsTest {
    private lateinit var app: RunovaApp
    private val graph get() = app.graph
    private val start = LatLng(52.3702, 4.8952)

    @Before
    fun setUp() {
        app = RuntimeEnvironment.getApplication() as RunovaApp
        runBlocking { graph.repository.loaded.first { it } }
        graph.settings.update {
            it.copy(onboarded = true, countdown = false, voice = false, profile = UserProfile("Test Runner", age = 30, heightCm = 180.0, weightKg = 75.0))
        }
        idle()
    }

    private fun idle() = shadowOf(Looper.getMainLooper()).idle()

    private fun fix(meters: Double, accuracy: Float = 4f, speed: Float = 3f): Location {
        val p = GeoMath.offset(start, meters, 90.0)
        return Location("gps").apply {
            latitude = p.lat
            longitude = p.lng
            this.accuracy = accuracy
            this.speed = speed
            altitude = 5.0
            time = System.currentTimeMillis()
            elapsedRealtimeNanos = SystemClock.elapsedRealtimeNanos()
        }
    }

    /** Runs east at 3 m/s with one fix per second. */
    private fun runFor(session: RunSession, seconds: Int, fromMeters: Double): Double {
        var m = fromMeters
        repeat(seconds) {
            ShadowSystemClock.advanceBy(Duration.ofSeconds(1))
            m += 3.0
            session.onLocation(fix(m))
        }
        return m
    }

    @Test
    fun runIsTrackedPausedResumedAndSavedWithRewards() {
        val session = graph.session
        session.start()
        idle()
        assertEquals(LiveStatus.RUNNING, session.live.value?.status)
        session.onLocation(fix(0.0))

        var at = runFor(session, 120, 0.0)
        val first = session.live.value!!.snapshot!!
        assertTrue(first.distanceM in 330.0..380.0, "distance after 2 min: ${first.distanceM}")

        session.pause()
        assertEquals(LiveStatus.PAUSED, session.live.value?.status)
        val movingAtPause = session.live.value!!.snapshot!!.movingTimeMs
        ShadowSystemClock.advanceBy(Duration.ofSeconds(45))
        session.onLocation(fix(at + 50)) // walking to a crossing while paused doesn't count
        assertEquals(movingAtPause, session.live.value!!.snapshot!!.movingTimeMs)

        session.resume()
        at = runFor(session, 60, at + 50)
        val finished = runBlocking { session.finish() }
        assertNotNull(finished)
        assertNull(session.live.value)

        val run = finished.run
        assertTrue(run.distanceM in 500.0..560.0, "saved distance ${run.distanceM}")
        assertTrue(run.movingTimeMs in 175_000L..185_000L, "moving time ${run.movingTimeMs}")
        assertTrue(finished.rewards.achievements.any { it.id == "first_run" })
        assertEquals(finished.rewards.xpGained.toInt(), run.xpEarned)

        val data = graph.repository.snapshot()
        assertEquals(1, data.runs.size)
        assertEquals(run.xpEarned.toLong(), data.progress.totalXp)
        assertTrue(data.inbox.any { it.kind == InboxKind.RUN })
        assertTrue(data.inbox.any { it.kind == InboxKind.ACHIEVEMENT })
        assertTrue(data.routes[run.id].orEmpty().size == 2, "pause splits the route into two segments")
        runBlocking {
            // 1 + 120 fixes before the pause, 60 after it; the fix taken while paused is dropped.
            assertEquals(181, graph.repository.points(run.id).size)
            assertNull(graph.repository.loadLive(), "the recovery checkpoint is cleared")
        }
    }

    @Test
    fun discardedRunLeavesNothingBehind() {
        val session = graph.session
        session.start()
        runFor(session, 30, 0.0)
        session.discard()
        idle()
        Thread.sleep(200)
        runBlocking {
            assertNull(graph.repository.loadLive())
            assertTrue(graph.repository.snapshot().runs.isEmpty())
        }
    }

    @Test
    fun interruptedRunIsOfferedForRecoveryAndSaved() {
        // A checkpoint as the previous process left it: 1 km in 6 minutes.
        val t0 = System.currentTimeMillis() - 10 * 60_000
        val points = (0..200).map { i ->
            val p = GeoMath.offset(start, i * 5.0, 90.0)
            TrackPoint(t0 + i * 1_800L, p.lat, p.lng, 5.0, 4f, 2.8f, 0, i * 5.0, i * 1_800L)
        }
        val checkpoint = RunTracker.Checkpoint(360_000, 1_000.0, 70.0, 0.0, 0.0, 3.2, 0, false, 0, 0, null)
        runBlocking { graph.repository.saveLive(t0, false, checkpoint, points, 0) }

        // A fresh session (new process) notices the checkpoint.
        val revived = RunSession(app, graph.repository, graph.heartRate, graph.voice, graph.scope)
        val deadline = System.currentTimeMillis() + 5_000
        while (revived.recovery.value == null && System.currentTimeMillis() < deadline) {
            idle()
            Thread.sleep(20)
        }
        val recovery = assertNotNull(revived.recovery.value)
        assertTrue(recovery.summary.contains("1.00 km"), recovery.summary)

        val saved = runBlocking { revived.saveRecovered() }
        assertNotNull(saved)
        assertEquals(1_000.0, saved.run.distanceM, 1.0)
        assertEquals(360_000L, saved.run.movingTimeMs)
        runBlocking { assertNull(graph.repository.loadLive()) }
    }

    @Test
    fun settingsSurviveARestart() {
        graph.settings.update { it.copy(units = UnitSystem.IMPERIAL, reminderEnabled = true, reminderHour = 7, reminderMinute = 15) }
        val reloaded = SettingsStore(app).load()
        assertEquals(UnitSystem.IMPERIAL, reloaded.units)
        assertTrue(reloaded.reminderEnabled)
        assertEquals(7, reloaded.reminderHour)
        assertEquals(15, reloaded.reminderMinute)
        assertEquals("Test Runner", reloaded.profile.name)
    }

    @Test
    fun deletingEverythingResetsTheApp() {
        val session = graph.session
        session.start()
        session.onLocation(fix(0.0))
        runFor(session, 90, 0.0)
        runBlocking { session.finish() }
        runBlocking { graph.repository.deleteEverything() }
        val data = graph.repository.snapshot()
        assertTrue(data.runs.isEmpty())
        assertEquals(0L, data.progress.totalXp)
        assertTrue(data.inbox.isEmpty())
        assertEquals(false, data.settings.onboarded)
    }
}

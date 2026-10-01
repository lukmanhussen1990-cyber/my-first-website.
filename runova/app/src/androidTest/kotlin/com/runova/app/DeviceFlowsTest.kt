package com.runova.app

import android.Manifest
import android.content.Context
import android.graphics.Bitmap
import android.location.Criteria
import android.location.Location
import android.location.LocationManager
import android.location.provider.ProviderProperties
import android.os.Build
import android.os.ParcelFileDescriptor
import android.os.SystemClock
import androidx.compose.ui.test.SemanticsMatcher
import androidx.compose.ui.test.hasClickAction
import androidx.compose.ui.test.hasContentDescription
import androidx.compose.ui.test.hasSetTextAction
import androidx.compose.ui.test.hasText
import androidx.compose.ui.test.junit4.createEmptyComposeRule
import androidx.compose.ui.test.onFirst
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.compose.ui.test.performTextInput
import androidx.test.core.app.ActivityScenario
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import androidx.test.uiautomator.By
import androidx.test.uiautomator.UiDevice
import com.runova.app.data.AppRepository
import com.runova.app.data.RunovaDatabase
import com.runova.app.data.SettingsStore
import com.runova.app.ui.MainActivity
import com.runova.app.ui.Perms
import com.runova.core.geo.GeoMath
import com.runova.core.geo.LatLng
import com.runova.core.model.BodyProfile
import com.runova.core.tracking.LocationSample
import com.runova.core.tracking.RunSummary
import com.runova.core.tracking.RunTracker
import com.runova.core.tracking.TrackPoint
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.withTimeout
import org.junit.Assume.assumeFalse
import org.junit.FixMethodOrder
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.junit.runners.MethodSorters
import java.io.File
import java.io.FileOutputStream
import java.time.ZonedDateTime
import kotlin.math.PI
import kotlin.math.cos
import kotlin.math.sin
import kotlin.math.sqrt
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import kotlin.test.assertTrue

/**
 * End-to-end flows on a real Android device or emulator: onboarding, the tab screens, the
 * location explanation when permission is missing, a full run fed by a mock GPS provider, and
 * every screen with six weeks of recorded training.
 *
 * Tests run in name order. The last one leaves a run in progress on purpose: the device test
 * script then kills the app and checks that relaunching offers to recover the run.
 */
@RunWith(AndroidJUnit4::class)
@FixMethodOrder(MethodSorters.NAME_ASCENDING)
class DeviceFlowsTest {

    @get:Rule
    val compose = createEmptyComposeRule()

    private val instrumentation get() = InstrumentationRegistry.getInstrumentation()
    private val app: RunovaApp get() = ApplicationProvider.getApplicationContext()

    private fun shell(command: String): String {
        val pfd = instrumentation.uiAutomation.executeShellCommand(command)
        return ParcelFileDescriptor.AutoCloseInputStream(pfd).use { it.readBytes().decodeToString() }
    }

    private fun exists(matcher: SemanticsMatcher) = compose.onAllNodes(matcher).fetchSemanticsNodes().isNotEmpty()

    private fun waitFor(text: String, timeoutMs: Long = 15_000, substring: Boolean = false) =
        compose.waitUntil(timeoutMs) { exists(hasText(text, substring = substring)) }

    private fun click(text: String) = compose.onNode(hasText(text) and hasClickAction()).performClick()

    private fun clickDesc(description: String) = compose.onNode(hasContentDescription(description) and hasClickAction()).performClick()

    /** Clicks a node that may sit below the fold of a scrolling screen. */
    private fun clickScrolling(text: String) {
        val node = compose.onAllNodes(hasText(text) and hasClickAction()).onFirst()
        runCatching { node.performScrollTo() }
        node.performClick()
    }

    private fun waitGone(text: String, timeoutMs: Long = 10_000) = compose.waitUntil(timeoutMs) { !exists(hasText(text)) }

    private fun back(scenario: ActivityScenario<MainActivity>) {
        scenario.onActivity { it.onBackPressedDispatcher.onBackPressed() }
        compose.waitForIdle()
    }

    /**
     * Full-screen capture (status bar included), pulled from the device by the test script.
     * Compose's test clock stands still while a test sleeps, so it first lets the UI catch up.
     */
    private fun screenshot(name: String) {
        compose.waitForIdle()
        dismissSystemDialogs()
        instrumentation.waitForIdleSync()
        Thread.sleep(250) // the frame reaches the display
        val bitmap = instrumentation.uiAutomation.takeScreenshot() ?: return
        val dir = File(app.getExternalFilesDir(null), "screens").apply { mkdirs() }
        FileOutputStream(File(dir, "$name.png")).use { bitmap.compress(Bitmap.CompressFormat.PNG, 100, it) }
    }

    /** Closes "… isn't responding" dialogs that slow CI emulators raise for their own apps (e.g. the launcher). */
    private fun dismissSystemDialogs() {
        val device = UiDevice.getInstance(instrumentation)
        repeat(3) {
            if (device.findObject(By.textContains("responding")) == null) return
            (device.findObject(By.text("Wait")) ?: device.findObject(By.text("Close app")))?.click()
            device.waitForIdle(1_000)
        }
    }

    private fun resetApp(onboarded: Boolean, countdown: Boolean) {
        instrumentation.runOnMainSync { app.graph.session.discard() }
        runBlocking { app.graph.repository.deleteEverything() }
        app.graph.settings.update {
            it.copy(onboarded = onboarded, countdown = countdown, voice = false, profile = it.profile.copy(name = "Alex Runner"))
        }
        instrumentation.waitForIdleSync()
    }

    private fun grantRunPermissions() {
        val pkg = app.packageName
        val permissions = buildList {
            add(Manifest.permission.ACCESS_FINE_LOCATION)
            add(Manifest.permission.ACCESS_COARSE_LOCATION)
            if (Build.VERSION.SDK_INT >= 29) add(Manifest.permission.ACTIVITY_RECOGNITION)
            if (Build.VERSION.SDK_INT >= 33) add(Manifest.permission.POST_NOTIFICATIONS)
        }
        permissions.forEach { shell("pm grant $pkg $it") }
        if (Build.VERSION.SDK_INT >= 31) shell("cmd location set-location-enabled true")
    }

    private fun liveDistance(): Double {
        var d = 0.0
        instrumentation.runOnMainSync { d = app.graph.session.live.value?.snapshot?.distanceM ?: 0.0 }
        return d
    }

    @Test
    fun a_onboardingThenEveryTab() {
        resetApp(onboarded = false, countdown = true)
        ActivityScenario.launch(MainActivity::class.java).use {
            waitFor("Welcome to RUNOVA", 20_000)
            screenshot("01-onboarding")
            click("GET STARTED")
            waitFor("About you")
            compose.onNode(hasSetTextAction()).performTextInput("Alex")
            click("CONTINUE")
            waitFor("Daily goals")
            click("CONTINUE")
            waitFor("Permissions")
            screenshot("02-onboarding-permissions")
            click("Skip for now")

            waitFor("START RUN")
            waitFor("Alex", substring = true)
            screenshot("03-home-new-runner")

            click("Activity")
            waitFor("Run History")
            waitFor("No runs yet")

            clickDesc("Statistics")
            waitFor("Calories Burned")

            click("Goals")
            waitFor("Set New Goal")

            click("Profile")
            waitFor("Personal Info")

            click("Home")
            waitFor("START RUN")
        }
        assertTrue(app.graph.settings.load().onboarded)
        assertEquals("Alex", app.graph.settings.load().profile.name)
    }

    @Test
    fun b_startingARunWithoutLocationExplainsWhy() {
        // A fresh install has no location permission; granting it later happens in test c.
        assumeFalse("location already granted on this device", Perms.location(app))
        resetApp(onboarded = true, countdown = true)
        ActivityScenario.launch(MainActivity::class.java).use {
            waitFor("START RUN", 20_000)
            click("START RUN")
            waitFor("Location access needed")
            screenshot("04-location-needed")
            click("Not now")
            compose.waitUntil(5_000) { !exists(hasText("Location access needed")) }
            assertTrue(!app.graph.session.isActive, "no run starts without location")
        }
    }

    @Test
    fun c_fullRunWithGpsPauseResumeFinishAndRestart() {
        resetApp(onboarded = true, countdown = true)
        grantRunPermissions()
        MockGps(app, ::shell).use { gps ->
            ActivityScenario.launch(MainActivity::class.java).use {
                waitFor("START RUN", 20_000)
                click("START RUN")
                waitFor("Kilometers")
                // 3-second countdown, then GPS fixes every second, 3 m apart (an easy jog).
                Thread.sleep(3_500)
                var meters = 0.0
                repeat(40) {
                    gps.push(meters)
                    meters += 3.0
                    Thread.sleep(1_000)
                }
                screenshot("05-running")
                val beforePause = liveDistance()
                assertTrue(beforePause in 90.0..130.0, "distance before pause: $beforePause")

                clickDesc("Pause run")
                waitFor("PAUSED")
                screenshot("06-paused")
                repeat(4) {
                    gps.push(meters)
                    meters += 3.0
                    Thread.sleep(1_000)
                }
                assertEquals(beforePause, liveDistance(), 0.5, "no distance while paused")

                clickDesc("Resume run")
                repeat(20) {
                    gps.push(meters)
                    meters += 3.0
                    Thread.sleep(1_000)
                }
                assertTrue(liveDistance() > beforePause + 40, "distance grows again after resume")

                clickDesc("Finish run")
                waitFor("FINISH & SAVE")
                click("FINISH & SAVE")
                waitFor("VIEW DETAILS", 20_000)
                Thread.sleep(5_000) // let the summary count-up and XP animations play
                screenshot("07-run-complete")

                val runs = app.graph.repository.snapshot().runs
                assertEquals(1, runs.size)
                assertTrue(runs[0].distanceM in 140.0..200.0, "saved distance ${runs[0].distanceM}")
                assertTrue(runs[0].xpEarned > 0)

                click("VIEW DETAILS")
                waitFor("Run Details")
                Thread.sleep(1_500)
                screenshot("08-run-details")
            }
        }
        // A new repository over the same files, as after an app restart, still has the run.
        val restarted = AppRepository(app, RunovaDatabase(app), SettingsStore(app), CoroutineScope(SupervisorJob() + Dispatchers.Default))
        runBlocking { withTimeout(10_000) { restarted.loaded.first { it } } }
        val data = restarted.snapshot()
        assertEquals(1, data.runs.size)
        assertTrue(data.progress.totalXp > 0)
        assertTrue(data.progress.unlocked.containsKey("first_run"))
    }

    @Test
    fun d_everyScreenWithSixWeeksOfRuns() {
        resetApp(onboarded = true, countdown = true)
        seedHistory()
        assertTrue(app.graph.repository.snapshot().runs.size >= 20)
        ActivityScenario.launch(MainActivity::class.java).use { scenario ->
            waitFor("START RUN", 20_000)
            Thread.sleep(2_500) // count-up animations
            screenshot("10-home")

            clickScrolling("AI Coach")
            waitFor("Ask me anything...")
            Thread.sleep(1_000)
            screenshot("11-coach")
            back(scenario)

            click("Activity")
            waitFor("Run History")
            Thread.sleep(2_000) // route thumbnails
            screenshot("12-history")
            compose.onAllNodes(hasText(" kcal", substring = true) and hasClickAction()).onFirst().performClick()
            waitFor("Run Details")
            Thread.sleep(4_000) // map tiles
            screenshot("13-run-details")
            back(scenario)

            clickDesc("Statistics")
            waitFor("Calories Burned")
            Thread.sleep(1_500)
            screenshot("14-stats")

            click("Goals")
            waitFor("Set New Goal")
            Thread.sleep(1_500)
            screenshot("15-goals")

            click("Profile")
            waitFor("Personal Info")
            Thread.sleep(1_500)
            screenshot("16-profile")

            clickScrolling("Achievements")
            waitGone("Personal Info")
            Thread.sleep(1_500)
            screenshot("17-achievements")
            back(scenario)

            waitFor("Units & Settings")
            clickScrolling("Units & Settings")
            waitGone("Personal Info")
            Thread.sleep(1_000)
            screenshot("18-settings")
            back(scenario)

            click("Home")
            waitFor("START RUN")
        }
    }

    @Test
    fun e_runInProgressIsLeftForTheCrashCheck() {
        resetApp(onboarded = true, countdown = false)
        grantRunPermissions()
        val gps = MockGps(app, ::shell)
        ActivityScenario.launch(MainActivity::class.java).use {
            waitFor("START RUN", 20_000)
            click("START RUN")
            waitFor("Kilometers")
            var meters = 0.0
            repeat(25) {
                gps.push(meters)
                meters += 3.0
                Thread.sleep(1_000)
            }
        }
        // The run keeps recording in the foreground service; wait for a checkpoint.
        Thread.sleep(6_000)
        assertTrue(app.graph.session.isActive)
        assertNotNull(runBlocking { app.graph.repository.loadLive() })
    }

    /**
     * Six weeks of believable training, recorded through the real tracker (so distances, paces,
     * splits, calories and rewards are all consistent) and saved like any finished run.
     */
    private fun seedHistory() {
        val body = app.graph.settings.load().profile.body
        val now = ZonedDateTime.now()
        // days ago, start time, distance (km), pace (s/km): a gradual build-up with a long run each week
        val plan = listOf(
            Seed(40, 7, 5, 4.2, 378.0), Seed(38, 18, 30, 5.0, 370.0), Seed(35, 8, 0, 6.5, 366.0),
            Seed(33, 7, 15, 4.8, 356.0), Seed(31, 18, 45, 5.5, 361.0), Seed(28, 9, 10, 8.0, 372.0),
            Seed(26, 7, 0, 5.2, 351.0), Seed(24, 18, 20, 6.0, 349.0), Seed(21, 8, 30, 10.0, 366.0),
            Seed(19, 7, 10, 5.0, 343.0), Seed(17, 18, 0, 6.2, 346.0), Seed(14, 9, 0, 12.0, 361.0),
            Seed(12, 7, 5, 5.5, 338.0), Seed(10, 18, 40, 7.0, 341.0), Seed(8, 7, 20, 4.0, 321.0),
            Seed(7, 9, 0, 10.5, 353.0), Seed(5, 7, 0, 5.8, 336.0), Seed(3, 18, 30, 6.4, 333.0),
            Seed(2, 7, 10, 3.5, 316.0), Seed(1, 18, 15, 8.2, 346.0),
        )
        val starts = plan.map { now.minusDays(it.daysAgo.toLong()).withHour(it.hour).withMinute(it.minute).withSecond(0) } +
            now.minusMinutes(150).withSecond(0)
        val runs = plan + Seed(0, 0, 0, 5.0, 329.0)
        runs.forEachIndexed { i, seed ->
            val (summary, points) = recordRun(starts[i].toInstant().toEpochMilli(), seed, i, body)
            runBlocking { app.graph.repository.saveRun(summary, points, emptyList()) }
        }
    }

    private data class Seed(val daysAgo: Int, val hour: Int, val minute: Int, val km: Double, val paceSecPerKm: Double)

    private fun recordRun(startMs: Long, seed: Seed, index: Int, body: BodyProfile): Pair<RunSummary, List<TrackPoint>> {
        val tracker = RunTracker(startMs, 0L, body)
        val target = seed.km * 1000
        var t = 0L
        var along = 0.0
        while (tracker.distanceM < target && t < 4 * 3_600_000L) {
            // Pace drifts a little over the run so splits differ, like a real effort.
            val speed = 1000.0 / seed.paceSecPerKm * (1 + 0.05 * sin(2 * PI * t / 420_000.0 + index))
            val p = loopPoint(index, along)
            tracker.onLocation(
                LocationSample(
                    elapsedMs = t, wallTimeMs = startMs + t, lat = p.lat, lng = p.lng,
                    altitude = 34 + 7 * sin(along / 450 + index), horizontalAccuracy = 4f, verticalAccuracy = 3f, speed = speed.toFloat(),
                ),
            )
            t += 2_000
            along += speed * 2
            tracker.tick(t)
        }
        return tracker.finish(t, startMs + t) to tracker.points.toList()
    }

    /** A gently wobbling park loop; [index] picks one of a few loops around Berlin's Tiergarten. */
    private fun loopPoint(index: Int, meters: Double): LatLng {
        val centers = listOf(LatLng(52.5145, 13.3501), LatLng(52.5163, 13.3655), LatLng(52.5112, 13.3398))
        val center = centers[index % centers.size]
        val rx = 720.0 + 140 * (index % 3)
        val ry = 430.0 + 70 * (index % 4)
        val perimeter = 2 * PI * sqrt((rx * rx + ry * ry) / 2)
        val theta = 2 * PI * meters / perimeter + index
        val wobble = 1 + 0.11 * sin(2 * theta + index) + 0.07 * sin(5 * theta + 2 * index) + 0.03 * sin(11 * theta + index)
        return GeoMath.offset(GeoMath.offset(center, rx * cos(theta) * wobble, 90.0), ry * sin(theta) * wobble, 0.0)
    }
}

/** A GPS test provider that replaces the device's real GPS while a test runs. */
private class MockGps(private val context: Context, shell: (String) -> String) : AutoCloseable {
    private val lm = context.getSystemService(LocationManager::class.java)
    private val start = LatLng(52.3702, 4.8952)

    init {
        shell("appops set ${context.packageName} android:mock_location allow")
        runCatching { lm.removeTestProvider(LocationManager.GPS_PROVIDER) }
        if (Build.VERSION.SDK_INT >= 31) {
            lm.addTestProvider(
                LocationManager.GPS_PROVIDER,
                ProviderProperties.Builder()
                    .setHasAltitudeSupport(true)
                    .setHasSpeedSupport(true)
                    .setAccuracy(ProviderProperties.ACCURACY_FINE)
                    .setPowerUsage(ProviderProperties.POWER_USAGE_HIGH)
                    .build(),
            )
        } else {
            @Suppress("DEPRECATION")
            lm.addTestProvider(LocationManager.GPS_PROVIDER, false, true, false, false, true, true, true, Criteria.POWER_HIGH, Criteria.ACCURACY_FINE)
        }
        lm.setTestProviderEnabled(LocationManager.GPS_PROVIDER, true)
    }

    /** A fix [meters] along a gentle left-hand curve from the start, moving at 3 m/s. */
    fun push(meters: Double) {
        val radius = 90.0
        val theta = meters / radius
        val p = GeoMath.offset(GeoMath.offset(start, radius * sin(theta), 90.0), radius * (1 - cos(theta)), 0.0)
        val location = Location(LocationManager.GPS_PROVIDER).apply {
            latitude = p.lat
            longitude = p.lng
            altitude = 5.0
            accuracy = 4f
            verticalAccuracyMeters = 3f
            speed = 3f
            time = System.currentTimeMillis()
            elapsedRealtimeNanos = SystemClock.elapsedRealtimeNanos()
        }
        lm.setTestProviderLocation(LocationManager.GPS_PROVIDER, location)
    }

    override fun close() {
        runCatching { lm.setTestProviderEnabled(LocationManager.GPS_PROVIDER, false) }
        runCatching { lm.removeTestProvider(LocationManager.GPS_PROVIDER) }
    }
}

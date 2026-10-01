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
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performTextInput
import androidx.test.core.app.ActivityScenario
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import com.runova.app.data.AppRepository
import com.runova.app.data.RunovaDatabase
import com.runova.app.data.SettingsStore
import com.runova.app.ui.MainActivity
import com.runova.app.ui.Perms
import com.runova.core.geo.GeoMath
import com.runova.core.geo.LatLng
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
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import kotlin.test.assertTrue

/**
 * End-to-end flows on a real Android device or emulator: onboarding, the tab screens, the
 * location explanation when permission is missing, and a full run fed by a mock GPS provider.
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

    /** Full-screen capture (status bar included), pulled from the device by the test script. */
    private fun screenshot(name: String) {
        instrumentation.waitForIdleSync()
        val bitmap = instrumentation.uiAutomation.takeScreenshot() ?: return
        val dir = File(app.getExternalFilesDir(null), "screens").apply { mkdirs() }
        FileOutputStream(File(dir, "$name.png")).use { bitmap.compress(Bitmap.CompressFormat.PNG, 100, it) }
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
            screenshot("03-home")

            click("Activity")
            waitFor("Run History")
            screenshot("04-history")

            clickDesc("Statistics")
            waitFor("Calories Burned")
            screenshot("05-stats")

            click("Goals")
            waitFor("Set New Goal")
            screenshot("06-goals")

            click("Profile")
            waitFor("Personal Info")
            screenshot("07-profile")

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
            screenshot("08-location-needed")
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
                screenshot("09-running")
                val beforePause = liveDistance()
                assertTrue(beforePause in 90.0..130.0, "distance before pause: $beforePause")

                clickDesc("Pause run")
                waitFor("PAUSED")
                screenshot("10-paused")
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
                screenshot("11-run-complete")

                val runs = app.graph.repository.snapshot().runs
                assertEquals(1, runs.size)
                assertTrue(runs[0].distanceM in 140.0..200.0, "saved distance ${runs[0].distanceM}")
                assertTrue(runs[0].xpEarned > 0)

                click("VIEW DETAILS")
                waitFor("Run Details")
                Thread.sleep(1_500)
                screenshot("12-run-details")
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
    fun d_runInProgressIsLeftForTheCrashCheck() {
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

    /** A fix [meters] east of the start, moving at 3 m/s. */
    fun push(meters: Double) {
        val p = GeoMath.offset(start, meters, 90.0)
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

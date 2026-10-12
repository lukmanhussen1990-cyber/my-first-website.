package com.weplay.guesserai.app

import android.content.ComponentName
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.ApplicationInfo
import android.content.pm.PackageInfo
import android.app.Activity
import com.weplay.guesserai.service.AssistantService
import androidx.compose.ui.test.hasAnyAncestor
import androidx.compose.ui.test.hasText
import androidx.compose.ui.test.isDialog
import androidx.compose.ui.test.junit4.createEmptyComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.test.core.app.ActivityScenario
import androidx.test.core.app.ApplicationProvider
import com.weplay.guesserai.WePlayGuesserApp
import com.weplay.guesserai.domain.HintPattern
import com.weplay.guesserai.ui.MainActivity
import kotlinx.coroutines.runBlocking
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.Shadows.shadowOf
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode
import org.robolectric.shadows.ShadowSettings

@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = [34], qualifiers = "w393dp-h852dp-xxhdpi")
class HomeSettingsJourneyTest {
    @get:Rule val compose = createEmptyComposeRule()
    private val app: WePlayGuesserApp = ApplicationProvider.getApplicationContext()
    private lateinit var scenario: ActivityScenario<MainActivity>

    private fun installWePlay(pkg: String = "com.wejoy.weplay") {
        val pm = shadowOf(app.packageManager)
        pm.installPackage(PackageInfo().apply {
            packageName = pkg
            applicationInfo = ApplicationInfo().apply { packageName = pkg; nonLocalizedLabel = "WePlay" }
        })
        val main = ComponentName(pkg, "$pkg.MainActivity")
        pm.addActivityIfNotPresent(main)
        pm.addIntentFilterForActivity(main, IntentFilter(Intent.ACTION_MAIN).apply { addCategory(Intent.CATEGORY_LAUNCHER) })
    }

    @Before fun setUp() {
        installWePlay()
        ShadowSettings.setCanDrawOverlays(true)
        app.container.settings.update { it.copy(apiKey = "sk-ant-test", gamePackage = "") }
        scenario = ActivityScenario.launch(MainActivity::class.java)
    }

    @After fun tearDown() = scenario.close()

    @Test fun `home finds the installed WePlay app in the background`() {
        compose.onNodeWithText("Ready to play").assertExists()
        compose.waitUntil(5_000) { app.container.settings.current.gamePackage.isNotEmpty() }
        assertEquals("com.wejoy.weplay", app.container.settings.current.gamePackage)
        compose.onNodeWithText("com.wejoy.weplay").performScrollTo().assertExists()
    }

    @Test fun `start AI asks for screen sharing, then starts the assistant and opens WePlay`() {
        app.container.settings.update { it.copy(gamePackage = "com.wejoy.weplay") }
        compose.onNodeWithText("▶  Start AI").performClick()
        scenario.onActivity { activity ->
            val shadow = shadowOf(activity)
            val consent = shadow.nextStartedActivityForResult
            assertNotNull("no screen-sharing prompt", consent)
            shadow.receiveResult(consent.intent, Activity.RESULT_OK, Intent("granted"))
            val service = shadowOf(app).nextStartedService
            assertEquals(AssistantService.ACTION_START, service.action)
            assertEquals(Activity.RESULT_OK, service.getIntExtra(AssistantService.EXTRA_RESULT_CODE, 0))
            assertEquals("com.wejoy.weplay", shadow.nextStartedActivity?.`package`)
        }
    }

    @Test fun `start AI without the overlay permission opens the permissions screen`() {
        ShadowSettings.setCanDrawOverlays(false)
        scenario.recreate()
        compose.onNodeWithText("▶  Start AI").performClick()
        compose.onNodeWithText("Display over other apps").assertExists()
    }

    @Test fun `history lists learned drawings and clears them after confirming`() {
        runBlocking { app.container.history.recordCorrect("Utah", null, emptyList(), HintPattern(1, 4), "Place") }
        compose.onNodeWithText("History").performScrollTo().performClick()
        compose.waitUntil(5_000) { compose.onAllNodes(hasText("Utah")).fetchSemanticsNodes().isNotEmpty() }
        compose.onNodeWithText("1 word • 4 letters • Place").assertExists()
        compose.onNodeWithText("Clear").performClick()
        compose.onNodeWithText("Clear history?").assertExists()
        compose.onNode(hasText("Clear") and hasAnyAncestor(isDialog())).performClick()
        compose.waitUntil(5_000) { compose.onAllNodes(hasText("Nothing learned yet", substring = true)).fetchSemanticsNodes().isNotEmpty() }
        compose.onNodeWithText("Utah").assertDoesNotExist()
    }

    @Test fun `settings lists the WePlay app and the word list once loaded`() {
        compose.onNodeWithText("Settings").performScrollTo().performClick()
        compose.waitUntil(5_000) { compose.onAllNodes(hasText("built-in words", substring = true)).fetchSemanticsNodes().isNotEmpty() }
        compose.waitUntil(5_000) { compose.onAllNodes(hasText("WePlay", substring = false)).fetchSemanticsNodes().isNotEmpty() }
        compose.onNodeWithText("WePlay was not found on this phone. Enter its package name if it is installed.").assertDoesNotExist()
        compose.onNodeWithText("‹ Back").performClick()
        compose.onNodeWithText("Ready to play").assertExists()
    }
}

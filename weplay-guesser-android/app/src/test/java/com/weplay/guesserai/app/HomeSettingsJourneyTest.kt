package com.weplay.guesserai.app

import android.content.ComponentName
import org.robolectric.shadows.ShadowActivityManager
import android.app.ApplicationExitInfo
import android.app.ActivityManager
import org.junit.Assert.assertTrue
import org.junit.Assert.assertFalse
import androidx.compose.ui.test.onAllNodesWithText
import com.weplay.guesserai.CrashLog
import androidx.core.content.IntentCompat
import android.media.projection.MediaProjectionConfig
import android.content.ClipboardManager
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.ApplicationInfo
import android.content.pm.PackageInfo
import android.app.Activity
import com.weplay.guesserai.service.AssistantService
import androidx.compose.ui.test.hasAnyAncestor
import androidx.compose.ui.test.hasText
import androidx.compose.ui.test.isSelectable
import androidx.compose.ui.test.isToggleable
import androidx.compose.ui.test.isDialog
import androidx.compose.ui.test.junit4.createEmptyComposeRule
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.compose.ui.test.performTextClearance
import androidx.compose.ui.test.performTextInput
import androidx.compose.ui.test.hasSetTextAction
import androidx.test.core.app.ActivityScenario
import androidx.test.core.app.ApplicationProvider
import com.weplay.guesserai.WePlayGuesserApp
import com.weplay.guesserai.domain.AiModel
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
    private companion object {
        /** MediaProjectionManager.EXTRA_MEDIA_PROJECTION_CONFIG (hidden). */
        const val PROJECTION_CONFIG = "android.media.projection.extra.EXTRA_MEDIA_PROJECTION_CONFIG"
    }

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
        compose.onNodeWithContentDescription("Start AI").assertExists() // read without the ▶ symbol
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
            // The entire screen only: Android ends a one-app share when that app's screen closes,
            // which made the floating window vanish in the middle of WePlay.
            assertEquals(
                MediaProjectionConfig.createConfigForDefaultDisplay(),
                IntentCompat.getParcelableExtra(consent.intent, PROJECTION_CONFIG, MediaProjectionConfig::class.java),
            )
            shadow.receiveResult(consent.intent, Activity.RESULT_OK, Intent("granted"))
            val service = shadowOf(app).nextStartedService
            assertEquals(AssistantService.ACTION_START, service.action)
            assertEquals(Activity.RESULT_OK, service.getIntExtra(AssistantService.EXTRA_RESULT_CODE, 0))
            assertEquals("com.wejoy.weplay", shadow.nextStartedActivity?.`package`)
        }
    }

    @Test fun `after a crash, home says so and the details can be copied, then dismissed`() {
        scenario.close()
        val boom = IllegalStateException("broken with key sk-ant-api03-secret_KEY-123")
        var passedOn: Throwable? = null
        val before = Thread.getDefaultUncaughtExceptionHandler()
        try {
            Thread.setDefaultUncaughtExceptionHandler { _, e -> passedOn = e }
            CrashLog.install(app)
            Thread.getDefaultUncaughtExceptionHandler()!!.uncaughtException(Thread.currentThread(), boom)
        } finally {
            Thread.setDefaultUncaughtExceptionHandler(before)
        }
        assertEquals("the crash still goes on to Android", boom, passedOn)

        scenario = ActivityScenario.launch(MainActivity::class.java)
        compose.waitUntil(5_000) { compose.onAllNodesWithText("WePlay AI stopped unexpectedly last time").fetchSemanticsNodes().isNotEmpty() }
        compose.onNodeWithText("Copy details").performClick()
        val copied = app.getSystemService(ClipboardManager::class.java).primaryClip!!.getItemAt(0).text.toString()
        assertTrue(copied, copied.contains("IllegalStateException") && copied.contains("WePlay AI 1."))
        assertFalse("never the key: $copied", copied.contains("secret_KEY"))
        compose.onNodeWithText("Dismiss").performClick()
        compose.onNodeWithText("WePlay AI stopped unexpectedly last time").assertDoesNotExist()
        compose.waitUntil(5_000) { CrashLog.read(app) == null }
    }

    private fun closedByAndroid(importance: Int) {
        scenario.close()
        shadowOf(app.getSystemService(ActivityManager::class.java)).addApplicationExitInfo(
            ShadowActivityManager.ApplicationExitInfoBuilder.newBuilder()
                .setReason(ApplicationExitInfo.REASON_LOW_MEMORY)
                .setImportance(importance)
                .setTimestamp(System.currentTimeMillis())
                .build()
        )
        scenario = ActivityScenario.launch(MainActivity::class.java)
        compose.waitForIdle()
    }

    @Test fun `when Android closed the app during a game, home says why, once`() {
        closedByAndroid(ActivityManager.RunningAppProcessInfo.IMPORTANCE_FOREGROUND_SERVICE)
        val title = "Android closed WePlay AI during your last game"
        compose.waitUntil(5_000) { compose.onAllNodesWithText(title).fetchSemanticsNodes().isNotEmpty() }
        compose.onNodeWithText("to free memory", substring = true).assertExists()
        compose.onNodeWithText("App settings").assertExists()
        compose.onNodeWithText("Dismiss").performClick()
        compose.onNodeWithText(title).assertDoesNotExist()

        scenario.close()
        scenario = ActivityScenario.launch(MainActivity::class.java)
        compose.onNodeWithText("Ready to play").assertExists()
        Thread.sleep(300) // the check runs in the background
        compose.waitForIdle()
        compose.onNodeWithText(title).assertDoesNotExist()
    }

    @Test fun `a close after the AI was stopped is not reported`() {
        closedByAndroid(ActivityManager.RunningAppProcessInfo.IMPORTANCE_CACHED)
        compose.onNodeWithText("Ready to play").assertExists()
        Thread.sleep(300)
        compose.waitForIdle()
        compose.onNodeWithText("Android closed WePlay AI during your last game").assertDoesNotExist()
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

    @Test fun `settings explain a missing model ID and an address that is not a URL`() {
        compose.onNodeWithText("Settings").performScrollTo().performClick()
        compose.onNodeWithText("Custom model ID").performScrollTo().performClick()
        compose.onNodeWithText("Enter the model ID, e.g. claude-sonnet-5-5").performScrollTo().assertExists()
        compose.onNode(hasText("Model ID") and hasSetTextAction()).performTextInput("my-model")
        compose.onNodeWithText("Enter the model ID, e.g. claude-sonnet-5-5").assertDoesNotExist()
        assertEquals("my-model", app.container.settings.current.modelId)

        val url = compose.onNode(hasText("API base URL") and hasSetTextAction())
        url.performScrollTo().performTextClearance()
        url.performTextInput("api.example.com")
        compose.onNodeWithText("Enter a full address, like https://api.anthropic.com").assertExists()
        url.performTextClearance()
        url.performTextInput("http://192.168.1.20:8080")
        compose.onNodeWithText("Android blocks plain http: use an https:// address").assertExists()
        url.performTextClearance()
        url.performTextInput("https://proxy.example.com")
        compose.onNodeWithText("Enter a full address, like https://api.anthropic.com").assertDoesNotExist()
        compose.onNodeWithText("Android blocks plain http: use an https:// address").assertDoesNotExist()
    }

    @Test fun `settings switches and options are one control each, named by their label`() {
        compose.onNodeWithText("Settings").performScrollTo().performClick()
        val fast = app.container.settings.current.fastMode
        // Tapping the title toggles it, and the toggle carries the title for screen readers.
        compose.onNode(hasText("Fast mode") and isToggleable()).performScrollTo().assertExists()
        compose.onNodeWithText("Fast mode").performClick()
        assertEquals(!fast, app.container.settings.current.fastMode)
        // Each option is one selectable row with its label, not a row plus a separate, nameless radio button.
        val nameless = compose.onAllNodes(isSelectable() and !hasText("", substring = true)).fetchSemanticsNodes()
        assertEquals("selectable controls without a label", 0, nameless.size)
        compose.onNodeWithText("Claude Sonnet 5.5").performScrollTo().performClick()
        assertEquals(AiModel.SONNET, app.container.settings.current.model)
    }

    @Test fun `settings lists the WePlay app and the word list once loaded`() {
        compose.onNodeWithText("Settings").performScrollTo().performClick()
        compose.waitUntil(5_000) { compose.onAllNodes(hasText("built-in words", substring = true)).fetchSemanticsNodes().isNotEmpty() }
        // The same number of distinct words the AI can be given (duplicates in the list count once).
        compose.onNodeWithText("${app.container.wordBank.get("").size} built-in words").assertExists()
        compose.waitUntil(5_000) { compose.onAllNodes(hasText("WePlay", substring = false)).fetchSemanticsNodes().isNotEmpty() }
        compose.onNodeWithText("WePlay was not found on this phone. Enter its package name if it is installed.").assertDoesNotExist()
        compose.onNodeWithContentDescription("Back").performClick()
        compose.onNodeWithText("Ready to play").assertExists()
    }
}

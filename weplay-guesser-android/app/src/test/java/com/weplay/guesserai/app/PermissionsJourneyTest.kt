package com.weplay.guesserai.app

import android.Manifest
import android.app.AppOpsManager
import android.content.ComponentName
import android.content.Intent
import android.content.IntentFilter
import android.os.Process
import android.provider.Settings
import androidx.compose.ui.test.junit4.createEmptyComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.test.core.app.ActivityScenario
import androidx.test.core.app.ApplicationProvider
import com.weplay.guesserai.WePlayGuesserApp
import com.weplay.guesserai.ui.MainActivity
import org.junit.Assert.assertEquals
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.Shadows.shadowOf
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode
import org.robolectric.shadows.ShadowSettings
import org.robolectric.shadows.ShadowToast

/** The "Allow" buttons open Android's settings screens, which some phones (Android Go) do not have. */
@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = [34], qualifiers = "w393dp-h852dp-xxhdpi")
class PermissionsJourneyTest {
    @get:Rule val compose = createEmptyComposeRule()
    private val app: WePlayGuesserApp = ApplicationProvider.getApplicationContext()

    @Before fun setUp() {
        app.container.settings.update { it.copy(apiKey = "sk-ant-test") }
        ShadowSettings.setCanDrawOverlays(false)
        // Notifications granted, usage access not: the buttons are "Allow" (overlay) and "Allow" (usage access).
        shadowOf(app).grantPermissions(Manifest.permission.POST_NOTIFICATIONS)
        val ops = app.getSystemService(AppOpsManager::class.java)
        shadowOf(ops).setMode(AppOpsManager.OPSTR_GET_USAGE_STATS, Process.myUid(), app.packageName, AppOpsManager.MODE_IGNORED)
        // Like a real phone: starting a screen that does not exist fails.
        shadowOf(app).checkActivities(true)
    }

    private fun openPermissions() {
        compose.onNodeWithText("Permissions").performScrollTo().performClick()
        compose.onNodeWithText("Display over other apps").assertExists()
    }

    private fun installSettingsScreen(action: String) {
        val c = ComponentName("com.android.settings", "com.android.settings.Screen_$action")
        shadowOf(app.packageManager).addActivityIfNotPresent(c)
        shadowOf(app.packageManager).addIntentFilterForActivity(c, IntentFilter(action).apply { addCategory(Intent.CATEGORY_DEFAULT); addDataScheme("package") })
        shadowOf(app.packageManager).addIntentFilterForActivity(c, IntentFilter(action).apply { addCategory(Intent.CATEGORY_DEFAULT) })
    }

    @Test fun `start AI on a phone without screen sharing says so instead of crashing`() {
        ShadowSettings.setCanDrawOverlays(true)
        ActivityScenario.launch(MainActivity::class.java).use {
            compose.onNodeWithText("▶  Start AI").performClick()
            compose.onNodeWithText("Ready to play").assertExists()
            assertEquals(
                "This phone does not allow screen sharing, which the AI needs to see the drawing.",
                ShadowToast.getTextOfLatestToast(),
            )
        }
    }

    @Test fun `allow opens the overlay settings screen when the phone has one`() {
        installSettingsScreen(Settings.ACTION_MANAGE_OVERLAY_PERMISSION)
        ActivityScenario.launch(MainActivity::class.java).use { s ->
            openPermissions()
            compose.onAllNodesWithText("Allow")[0].performClick()
            s.onActivity { assertEquals(Settings.ACTION_MANAGE_OVERLAY_PERMISSION, shadowOf(it).nextStartedActivity?.action) }
        }
    }

    @Test fun `allow does not crash on a phone without those settings screens`() {
        ActivityScenario.launch(MainActivity::class.java).use {
            openPermissions()
            assertEquals(2, compose.onAllNodesWithText("Allow").fetchSemanticsNodes().size)
            compose.onAllNodesWithText("Allow")[0].performClick() // overlay
            assertEquals("Open Android Settings → Apps → WePlay AI → Display over other apps", ShadowToast.getTextOfLatestToast())
            compose.onAllNodesWithText("Allow")[1].performScrollTo().performClick() // usage access
            compose.onNodeWithText("Permissions").assertExists() // still running
            assertEquals("Open Android Settings → Apps → WePlay AI → Usage access", ShadowToast.getTextOfLatestToast())
        }
    }
}

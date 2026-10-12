package com.weplay.guesserai.app

import androidx.compose.ui.test.assertIsEnabled
import androidx.compose.ui.test.assertIsNotEnabled
import androidx.compose.ui.test.hasSetTextAction
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.compose.ui.test.performTextInput
import androidx.lifecycle.Lifecycle
import com.weplay.guesserai.ui.MainActivity
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode
import org.robolectric.shadows.ShadowSettings

/**
 * Runs the real app (activity, view models, repositories) on the JVM. Robolectric has no
 * Android Keystore, which is exactly the broken-keystore phone that used to crash on Continue.
 */
@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = [34], qualifiers = "w393dp-h852dp-xxhdpi")
class FirstRunJourneyTest {
    @get:Rule val compose = createAndroidComposeRule<MainActivity>()

    private fun resume() {
        compose.activityRule.scenario.moveToState(Lifecycle.State.STARTED)
        compose.activityRule.scenario.moveToState(Lifecycle.State.RESUMED)
        compose.waitForIdle()
    }

    @Test fun `first run reaches home without a working keystore`() {
        compose.onNodeWithText("Claude API key").assertExists()
        compose.onNodeWithText("Continue").assertIsNotEnabled()
        compose.onNode(hasSetTextAction()).performTextInput("sk-ant-test-key")
        compose.onNodeWithText("Continue").performScrollTo().performClick()

        compose.onNodeWithText("Display over other apps").assertExists()
        compose.onNodeWithText("Allow overlay to continue").performScrollTo().assertIsNotEnabled()

        ShadowSettings.setCanDrawOverlays(true) // the user grants it in system settings and comes back
        resume()
        compose.onNodeWithText("Continue").performScrollTo().assertIsEnabled().performClick()

        compose.onNodeWithText("Ready to play").assertExists()
        compose.onNodeWithText("Until app closes").performScrollTo().assertExists()
    }
}

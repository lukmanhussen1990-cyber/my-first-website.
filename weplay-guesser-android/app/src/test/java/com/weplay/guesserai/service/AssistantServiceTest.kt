package com.weplay.guesserai.service

import android.app.Activity
import android.app.KeyguardManager
import android.content.Intent
import android.os.PowerManager
import android.view.WindowManager
import androidx.test.core.app.ApplicationProvider
import com.weplay.guesserai.WePlayGuesserApp
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.Robolectric
import org.robolectric.RobolectricTestRunner
import org.robolectric.Shadows.shadowOf
import org.robolectric.annotation.Config
import org.robolectric.shadow.api.Shadow
import org.robolectric.shadows.ShadowLooper
import org.robolectric.shadows.ShadowSettings
import org.robolectric.shadows.ShadowToast
import org.robolectric.shadows.ShadowWindowManagerImpl

/** The service's start and stop paths that do not need a real screen capture. */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [34])
class AssistantServiceTest {
    private val app: WePlayGuesserApp = ApplicationProvider.getApplicationContext()

    private fun startIntent(code: Int) = Intent(app, AssistantService::class.java)
        .setAction(AssistantService.ACTION_START)
        .putExtra(AssistantService.EXTRA_RESULT_CODE, code)
        .putExtra(AssistantService.EXTRA_RESULT_DATA, Intent("projection-token"))

    private fun overlays() = Shadow.extract<ShadowWindowManagerImpl>(app.getSystemService(WindowManager::class.java)).views

    @Test fun `when screen capture cannot start, the user is told and nothing is left running`() {
        ShadowSettings.setCanDrawOverlays(true)
        val controller = Robolectric.buildService(AssistantService::class.java, startIntent(Activity.RESULT_OK)).create()
        controller.startCommand(0, 1)
        ShadowLooper.idleMainLooper()
        val service = shadowOf(controller.get())
        assertNotNull("went to the foreground first, as Android 14 requires", service.lastForegroundNotification)
        assertTrue("stopped itself", service.isStoppedBySelf)
        assertTrue(ShadowToast.getTextOfLatestToast().startsWith("Could not start screen capture"))
        controller.destroy()
        assertFalse(app.container.assistantRunning.value)
        assertEquals("no overlay window left behind", 0, overlays().size)
    }

    @Test fun `the lock screen does not count as the screen in use, so it is never captured`() {
        val power = app.getSystemService(PowerManager::class.java)
        val keyguard = app.getSystemService(KeyguardManager::class.java)
        shadowOf(power).setIsInteractive(true)
        shadowOf(keyguard).setKeyguardLocked(false)
        assertTrue(screenInUse(power, keyguard))
        // Woken up, lock screen showing: WePlay is still the app "in front", but the lock screen is what shows.
        shadowOf(keyguard).setKeyguardLocked(true)
        assertFalse(screenInUse(power, keyguard))
        shadowOf(power).setIsInteractive(false)
        assertFalse(screenInUse(power, keyguard))
    }

    @Test fun `a cancelled screen-sharing prompt just stops`() {
        val controller = Robolectric.buildService(AssistantService::class.java, startIntent(Activity.RESULT_CANCELED)).create()
        controller.startCommand(0, 1)
        assertTrue(shadowOf(controller.get()).isStoppedBySelf)
        controller.destroy()
        assertFalse(app.container.assistantRunning.value)
    }

    @Test fun `the stop action stops the service`() {
        val controller = Robolectric.buildService(AssistantService::class.java, Intent(app, AssistantService::class.java).setAction(AssistantService.ACTION_STOP)).create()
        controller.startCommand(0, 1)
        assertTrue(shadowOf(controller.get()).isStoppedBySelf)
        controller.destroy()
    }
}

package com.weplay.guesserai.app

import android.Manifest
import android.content.ComponentName
import android.content.Intent
import android.content.IntentFilter
import android.media.projection.MediaProjectionManager
import android.provider.Settings
import androidx.compose.ui.test.SemanticsNodeInteraction
import androidx.compose.ui.test.hasClickAction
import androidx.compose.ui.test.hasSetTextAction
import androidx.compose.ui.test.isEnabled
import androidx.compose.ui.test.junit4.createEmptyComposeRule
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.compose.ui.test.performTextInput
import androidx.test.core.app.ActivityScenario
import androidx.test.core.app.ApplicationProvider
import com.weplay.guesserai.WePlayGuesserApp
import com.weplay.guesserai.ui.MainActivity
import org.junit.Assert.fail
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.Shadows.shadowOf
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode
import kotlin.random.Random

/** Random taps, typing and Back across the real app; any exception from the app is a crash. */
@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = [34], qualifiers = "w360dp-h740dp-xhdpi")
class MonkeyTest {
    @get:Rule val compose = createEmptyComposeRule()
    private val app: WePlayGuesserApp = ApplicationProvider.getApplicationContext()

    /** The system screens every phone has, so only screens a real phone may lack can fail. */
    private fun installSystemScreens() {
        val pm = shadowOf(app.packageManager)
        val actions = listOf(
            Settings.ACTION_MANAGE_OVERLAY_PERMISSION, Settings.ACTION_USAGE_ACCESS_SETTINGS,
            Settings.ACTION_APPLICATION_DETAILS_SETTINGS, "android.content.pm.action.REQUEST_PERMISSIONS",
        )
        actions.forEachIndexed { i, action ->
            val c = ComponentName("com.android.settings", "com.android.settings.Screen$i")
            pm.addActivityIfNotPresent(c)
            pm.addIntentFilterForActivity(c, IntentFilter(action).apply { addCategory(Intent.CATEGORY_DEFAULT); addDataScheme("package") })
            pm.addIntentFilterForActivity(c, IntentFilter(action).apply { addCategory(Intent.CATEGORY_DEFAULT) })
        }
        val consent = app.getSystemService(MediaProjectionManager::class.java).createScreenCaptureIntent().component
        if (consent != null) pm.addActivityIfNotPresent(consent)
    }

    @Test fun `random use never crashes`() {
        installSystemScreens()
        // Android's own permission dialog exists on every phone but not in Robolectric.
        shadowOf(app).grantPermissions(Manifest.permission.POST_NOTIFICATIONS)
        shadowOf(app).checkActivities(true)
        var actions = 0
        val screens = mutableSetOf<String>()
        val landmarks = mapOf("Claude API key" to "Setup", "Display over other apps" to "Permissions", "Drawing Guesser assistant" to "Home", "AI CONNECTION" to "Settings", "Learning history" to "History")
        val words = listOf("sk-ant-123", "Free Fire|90\nTV", "https://", "api.example.com", "", "😀", "my-model", "x".repeat(300))
        for (seed in 1..6) {
            val rnd = Random(seed)
            ActivityScenario.launch(MainActivity::class.java).use { scenario ->
                repeat(150) { step ->
                    val where = "seed $seed step $step"
                    val action = rnd.nextInt(10)
                    try {
                        if (action == 0) {
                            if (rnd.nextBoolean()) scenario.onActivity { it.onBackPressedDispatcher.onBackPressed() }
                            else scenario.recreate() // rotation or another configuration change
                        } else {
                            val fields = compose.onAllNodes(hasSetTextAction() and isEnabled()).fetchSemanticsNodes()
                            if (action < 3 && fields.isNotEmpty()) {
                                val i = rnd.nextInt(fields.size)
                                pick(compose.onAllNodes(hasSetTextAction() and isEnabled())[i]) { performTextInput(words[rnd.nextInt(words.size)]) }
                            } else {
                                val n = compose.onAllNodes(hasClickAction() and isEnabled()).fetchSemanticsNodes().size
                                if (n > 0) pick(compose.onAllNodes(hasClickAction() and isEnabled())[rnd.nextInt(n)]) { performClick() }
                            }
                        }
                        compose.waitForIdle()
                        actions++
                        landmarks.forEach { (text, screen) -> if (compose.onAllNodes(androidx.compose.ui.test.hasText(text)).fetchSemanticsNodes().isNotEmpty()) screens += screen }
                    } catch (e: AssertionError) {
                        // The test framework could not reach that node (it moved or left): not an app problem.
                    } catch (e: IllegalStateException) {
                        if (e.message?.contains("No compose hierarchies found") == true || e.message?.contains("destroyed") == true) {
                            // The activity finished (Back on the first screen): start it again.
                            return@use
                        }
                        fail("$where: the app crashed: $e")
                    } catch (e: Throwable) {
                        fail("$where: the app crashed: $e")
                    }
                }
            }
        }
        report(actions, screens)
    }

    private fun report(actions: Int, screens: Set<String>) = println("MONKEY $actions actions, screens reached: $screens")

    private fun pick(node: SemanticsNodeInteraction, act: SemanticsNodeInteraction.() -> Unit) {
        runCatching { node.performScrollTo() }
        node.act()
    }
}

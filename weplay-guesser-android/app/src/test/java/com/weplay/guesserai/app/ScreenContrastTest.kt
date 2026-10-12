package com.weplay.guesserai.app

import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.luminance
import androidx.compose.ui.semantics.SemanticsActions
import androidx.compose.ui.test.SemanticsNodeInteraction
import androidx.compose.ui.test.junit4.createEmptyComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.onRoot
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.compose.ui.text.TextLayoutResult
import androidx.test.core.app.ActivityScenario
import androidx.test.core.app.ApplicationProvider
import com.github.takahirom.roborazzi.captureRoboImage
import com.weplay.guesserai.WePlayGuesserApp
import com.weplay.guesserai.ui.MainActivity
import com.weplay.guesserai.ui.theme.Bg
import com.weplay.guesserai.ui.theme.Surface1
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode

/** Headings must be readable on the dark screens (WCAG AA: at least 4.5 : 1 against the background). */
@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = [34], qualifiers = "w360dp-h740dp-xhdpi")
class ScreenContrastTest {
    @get:Rule val compose = createEmptyComposeRule()
    private val app: WePlayGuesserApp = ApplicationProvider.getApplicationContext()

    private fun contrast(a: Color, b: Color): Float {
        val (hi, lo) = listOf(a.luminance(), b.luminance()).sortedDescending()
        return (hi + 0.05f) / (lo + 0.05f)
    }

    private fun SemanticsNodeInteraction.textColor(): Color {
        val layouts = mutableListOf<TextLayoutResult>()
        fetchSemanticsNode().config[SemanticsActions.GetTextLayoutResult].action?.invoke(layouts)
        return layouts.first().layoutInput.style.color
    }

    /** Checked against the darker of the page and card backgrounds the text can sit on. */
    private fun assertReadable(vararg texts: String) = texts.forEach { t ->
        val c = compose.onNodeWithText(t).performScrollTo().textColor()
        val worst = minOf(contrast(c, Bg), contrast(c, Surface1))
        assertTrue("\"$t\" has contrast %.1f : 1 (color $c)".format(worst), worst >= 4.5f)
    }

    @Test fun `home buttons keep their labels on one line on a 360 dp phone`() {
        app.container.settings.update { it.copy(apiKey = "sk-ant-test") }
        ActivityScenario.launch(MainActivity::class.java).use {
            for (label in listOf("Settings", "History", "Permissions")) {
                val layouts = mutableListOf<TextLayoutResult>()
                compose.onNodeWithText(label).performScrollTo().fetchSemanticsNode().config[SemanticsActions.GetTextLayoutResult].action?.invoke(layouts)
                val l = layouts.first()
                assertTrue("\"$label\" wraps or is cut", l.lineCount == 1 && !l.isLineEllipsized(0))
            }
        }
    }

    @Test fun `setup headings are readable`() {
        ActivityScenario.launch(MainActivity::class.java).use {
            compose.onRoot().captureRoboImage("build/outputs/roborazzi/screen_setup.png")
            assertReadable("WePlay Drawing Guesser AI", "Claude API key")
        }
    }

    @Test fun `home, permissions and settings headings are readable`() {
        app.container.settings.update { it.copy(apiKey = "sk-ant-test") }
        ActivityScenario.launch(MainActivity::class.java).use {
            compose.onRoot().captureRoboImage("build/outputs/roborazzi/screen_home.png")
            assertReadable("WePlay AI", "Ready to play", "Status")
            compose.onNodeWithText("Permissions").performScrollTo().performClick()
            compose.onRoot().captureRoboImage("build/outputs/roborazzi/screen_permissions.png")
            assertReadable("Permissions", "Display over other apps", "Screen capture")
        }
        ActivityScenario.launch(MainActivity::class.java).use {
            compose.onNodeWithText("Settings").performScrollTo().performClick()
            compose.onRoot().captureRoboImage("build/outputs/roborazzi/screen_settings.png")
            assertReadable("Settings", "Claude Haiku 5.5", "Fast mode")
        }
    }
}

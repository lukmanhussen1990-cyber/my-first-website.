package com.loe.chat

import android.graphics.Bitmap
import androidx.activity.ComponentActivity
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import com.loe.chat.data.Provider
import com.loe.chat.ui.LoeApp
import com.loe.chat.ui.intro.GlitchIntro
import com.loe.chat.ui.intro.IntroTimeline
import com.loe.chat.ui.theme.LoeTheme
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode
import java.io.File

/** Plays the opening scene over the app and saves a frame every 32 ms to app/build/intro-frames. */
@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = [35], qualifiers = "w360dp-h808dp-xhdpi")
class IntroTest {
    @get:Rule
    val compose = createAndroidComposeRule<ComponentActivity>()

    private val outDir = File("build/intro-frames").apply { deleteRecursively(); mkdirs() }

    private fun frame(index: Int): Bitmap {
        val view = compose.activity.window.decorView
        val bitmap = Bitmap.createBitmap(view.width, view.height, Bitmap.Config.ARGB_8888)
        compose.runOnUiThread { view.draw(android.graphics.Canvas(bitmap)) }
        File(outDir, "frame_%03d.png".format(index)).outputStream().use { bitmap.compress(Bitmap.CompressFormat.PNG, 100, it) }
        return bitmap
    }

    /** Share of bright pixels in the middle of the screen, where the logo sits. */
    private fun brightness(bitmap: Bitmap): Float {
        var bright = 0
        var total = 0
        for (y in bitmap.height / 3 until bitmap.height * 2 / 3 step 6) for (x in bitmap.width / 4 until bitmap.width * 3 / 4 step 6) {
            val p = bitmap.getPixel(x, y)
            if ((p shr 16 and 0xFF) + (p shr 8 and 0xFF) + (p and 0xFF) > 450) bright++
            total++
        }
        return bright.toFloat() / total
    }

    @Test
    fun playsThenRevealsTheApp() {
        val graph = Loe.graph
        graph.settings.completeOnboarding("Sam Lee", null)
        graph.settings.setApiKey(Provider.OPENROUTER, "test-key")
        var intro by mutableStateOf(true)
        compose.mainClock.autoAdvance = false
        compose.setContent {
            LoeTheme(dark = false) {
                Box(Modifier.fillMaxSize()) {
                    LoeApp(graph, openConversationId = null, onOpenedConversation = {})
                    if (intro) GlitchIntro(onFinished = { intro = false })
                }
            }
        }
        val frames = (IntroTimeline.TOTAL / 32).toInt() + 8
        var first = 0f
        for (i in 0..frames) {
            compose.mainClock.advanceTimeBy(32)  // a multiple of the 16 ms frame, so steps are exact
            compose.waitForIdle()
            val b = brightness(frame(i))
            if (i == 0) first = b
        }
        assertTrue("logo visible on the first frame", first > 0.02f)
        assertEquals(false, intro)
        assertTrue(compose.onAllNodesWithText("Official bots").fetchSemanticsNodes().isNotEmpty())
    }
}

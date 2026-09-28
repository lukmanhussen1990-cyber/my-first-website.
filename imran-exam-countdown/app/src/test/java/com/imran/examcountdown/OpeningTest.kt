package com.imran.examcountdown

import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.view.View
import android.view.WindowInsetsController
import android.widget.ImageView
import com.imran.examcountdown.core.MotionPref
import com.imran.examcountdown.data.AppClock
import com.imran.examcountdown.data.Store
import com.imran.examcountdown.ui.screens.HomeScreen
import com.imran.examcountdown.ui.widgets.IntroView
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.Robolectric
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode
import org.robolectric.shadows.ShadowChoreographer
import kotlin.math.abs
import kotlin.math.cos
import kotlin.math.sin

/**
 * The opening: forest-green start, two gold arcs joining into a border, the emblem only faded,
 * scaled and moved, the hand-over into Home's header, and the Replay/Disable settings. Drawn with
 * Android's native graphics, one 16 ms frame at a time.
 */
@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = [35], qualifiers = "w360dp-h780dp-xxhdpi")
class OpeningTest {

    private val forest = 0xFF0F3B26.toInt()
    private val cream = 0xFFF7F3E8.toInt()

    @Before
    fun setUp() {
        ShadowChoreographer.setPaused(true)
        AppClock.pinnedWall = ist(2026, 9, 27, 18, 0)
        ExamCountdownApp.introHandled = false
        Store(RuntimeEnvironment.getApplication()).apply {
            setupDone = true
            motion = MotionPref.FULL
        }
    }

    @After
    fun tearDown() {
        ShadowChoreographer.setPaused(false)
        AppClock.pinnedWall = null
        ExamCountdownApp.introHandled = true
    }

    private fun launch(): MainActivity = Robolectric.buildActivity(MainActivity::class.java).setup().get().also {
        it.applySystemBars(24, 16)
    }

    private fun MainActivity.intro(): IntroView? = root().allViews().filterIsInstance<IntroView>().firstOrNull()
    private fun IntroView.emblem(): ImageView = getChildAt(0) as ImageView
    private fun MainActivity.home(): HomeScreen = currentScreen as HomeScreen

    private fun MainActivity.snapshot(): Bitmap {
        val decor = window.decorView
        return Bitmap.createBitmap(decor.width, decor.height, Bitmap.Config.ARGB_8888).also { decor.draw(Canvas(it)) }
    }

    private fun close(a: Int, b: Int, tolerance: Int): Boolean =
        abs(Color.red(a) - Color.red(b)) <= tolerance && abs(Color.green(a) - Color.green(b)) <= tolerance && abs(Color.blue(a) - Color.blue(b)) <= tolerance

    private fun isGold(p: Int): Boolean = Color.red(p) > 150 && Color.red(p) - Color.blue(p) > 90 && Color.green(p) > 100

    /** Fraction of 72 points round the border circle that are gold. */
    private fun MainActivity.borderCoverage(): Float {
        val intro = intro()!!
        val emblem = intro.emblem()
        val at = IntArray(2)
        intro.getLocationInWindow(at)
        val cx = at[0] + emblem.left + emblem.width / 2f
        val cy = at[1] + emblem.top + emblem.height / 2f
        val d = resources.displayMetrics.density
        val radius = (emblem.width / 2f + 7 * d) * emblem.scaleX
        val shot = snapshot()
        var gold = 0
        for (k in 0 until 72) {
            val a = Math.toRadians(k * 5.0)
            // A pixel or two either side of the line, to allow for anti-aliasing.
            val hit = (-3..3).any { dr ->
                val x = (cx + cos(a) * (radius + dr)).toInt()
                val y = (cy + sin(a) * (radius + dr)).toInt()
                isGold(shot.getPixel(x, y))
            }
            if (hit) gold++
        }
        return gold / 72f
    }

    @Test
    fun launchWindowIsForestGreenAndTheAppIsCream() {
        val activity = launch()
        val info = activity.packageManager.getActivityInfo(activity.componentName, 0)
        assertEquals("the launch window uses the green launch theme", R.style.Theme_ExamCountdown_Launch, info.theme)
        fun background(theme: android.content.res.Resources.Theme): Int {
            val a = theme.obtainStyledAttributes(intArrayOf(android.R.attr.windowBackground))
            return a.getColor(0, 0).also { a.recycle() }
        }
        fun splash(theme: android.content.res.Resources.Theme): Int {
            val a = theme.obtainStyledAttributes(intArrayOf(android.R.attr.windowSplashScreenBackground))
            return a.getColor(0, 0).also { a.recycle() }
        }
        val launchTheme = activity.resources.newTheme().apply { applyStyle(R.style.Theme_ExamCountdown_Launch, true) }
        assertEquals(forest, background(launchTheme))
        assertEquals("Android 12+ launch screen: plain green, no icon", forest, splash(launchTheme))
        assertEquals("the app itself runs on cream", cream, background(activity.theme))
    }

    @Test
    fun startsOnForestGreenAndEndsOnTheCreamHomeScreen() {
        val activity = launch()
        frames(16)
        val first = activity.snapshot()
        // Well away from the emblem and the name.
        val x = first.width / 2
        val y = (first.height * 0.9f).toInt()
        assertTrue("first frame is forest green: ${Integer.toHexString(first.getPixel(x, y))}", close(first.getPixel(x, y), forest, 14))
        frames(2600)
        assertNull("finished", activity.intro())
        val last = activity.snapshot()
        val p = last.getPixel(3, last.height / 2)
        assertTrue("ends on the light background: ${Integer.toHexString(p)}", Color.red(p) > 225 && Color.green(p) > 220 && Color.blue(p) > 200)
    }

    @Test
    fun twoGoldArcsJoinIntoACompleteBorder() {
        val activity = launch()
        frames(420)
        val sweeping = activity.borderCoverage()
        assertTrue("arcs part of the way round at 0.4 s: $sweeping", sweeping in 0.15f..0.8f)
        frames(700)
        val joined = activity.borderCoverage()
        assertTrue("a complete border by 1.1 s: $joined", joined >= 0.97f)
    }

    @Test
    fun theEmblemIsOnlyFadedScaledAndMovedNeverSpun() {
        val activity = launch()
        val intro = activity.intro()!!
        val emblem = intro.emblem()
        var minScale = 2f
        var maxScale = 0f
        for (i in 0 until 100) {
            frames(16)
            if (activity.intro() == null) break
            assertEquals(0f, emblem.rotation, 0f)
            assertEquals(0f, emblem.rotationX, 0f)
            assertEquals(0f, emblem.rotationY, 0f)
            assertNull("never recoloured", emblem.colorFilter)
            assertEquals("drawn undistorted", emblem.scaleX, emblem.scaleY, 0f)
            minScale = minOf(minScale, emblem.scaleX)
            maxScale = maxOf(maxScale, emblem.scaleX)
        }
        assertTrue("a gentle scale-up from 92 %: $minScale", minScale >= 0.915f)
        assertTrue("barely overshoots: $maxScale", maxScale <= 1.02f)
        // Only the emblem is a view; no loading bar or second splash anywhere.
        assertEquals(1, intro.childCount)
        assertTrue(activity.root().allViews().none { it is android.widget.ProgressBar })
    }

    @Test
    fun homeIsReadyAtOnceAndRisesInDuringTheHandOver() {
        val activity = launch()
        frames(50)
        // Nothing waits for the opening: Home is already built underneath with the right time.
        assertTrue(activity.hasText("Hey, Imran"))
        val figures = activity.root().allViews().filterIsInstance<com.imran.examcountdown.ui.widgets.RollingNumberView>().filter { it.isShown }.map { it.value }
        assertEquals(listOf("18", "30", "00"), figures)
        assertTrue("taps skip the opening before the hand-over", activity.intro()!!.isClickable)
        frames(IntroView.EXIT.toLong() + 60)
        assertFalse("from the hand-over, touches reach Home", activity.intro()!!.isClickable)
        frames(200)
        assertNotNull(activity.intro())
        val rising = activity.home().entranceViews().drop(1)
        assertTrue("Home's content rises in while the opening hands over", rising.any { it.alpha < 1f || it.translationY > 0f })
        frames(900)
        assertNull(activity.intro())
        assertTrue("settled", activity.home().entranceViews().all { it.alpha == 1f && it.translationY == 0f })
    }

    @Test
    fun theEmblemLandsExactlyOnTheHomeHeader() {
        val activity = launch()
        val intro = activity.intro()!!
        val header = activity.home().emblem
        assertEquals("the header emblem waits for the opening", View.INVISIBLE, header.visibility)
        frames(2260)
        assertNotNull("still there just before the end", activity.intro())
        val emblem = intro.emblem()
        val at = IntArray(2)
        emblem.getLocationInWindow(at)
        val size = emblem.width * emblem.scaleX
        val target = header.windowRect()
        assertEquals(target.left.toFloat(), at[0].toFloat(), 3f)
        assertEquals(target.top.toFloat(), at[1].toFloat(), 3f)
        assertEquals(target.width().toFloat(), size, 3f)
        frames(300)
        assertNull(activity.intro())
        assertEquals(View.VISIBLE, header.visibility)
    }

    @Test
    fun statusBarIconsAreLightOnGreenAndDarkOnCream() {
        val activity = launch()
        frames(100)
        val controller = activity.window.decorView.windowInsetsController!!
        assertEquals(0, controller.systemBarsAppearance and WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS)
        frames(2600)
        assertTrue(controller.systemBarsAppearance and WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS != 0)
    }

    @Test
    fun replayOpeningFromSettings() {
        ExamCountdownApp.introHandled = true
        val activity = launch()
        frames(500)
        activity.click("Settings")
        frames(500)
        activity.click("Replay opening")
        frames(100)
        assertNotNull("the opening plays again", activity.intro())
        frames(250)
        assertTrue("Home comes up underneath once the green covers the screen", activity.currentScreen is HomeScreen)
        frames(2600)
        assertNull(activity.intro())
        assertEquals(View.VISIBLE, activity.home().emblem.visibility)
        assertTrue(activity.home().entranceViews().all { it.alpha == 1f })
    }

    @Test
    fun disableOpeningInSettings() {
        ExamCountdownApp.introHandled = true
        val activity = launch()
        frames(500)
        activity.click("Settings")
        frames(500)
        activity.click("Opening animation")
        assertFalse(Store(RuntimeEnvironment.getApplication()).introEnabled)
        // The next cold start goes straight to Home.
        ExamCountdownApp.introHandled = false
        val next = launch()
        frames(16)
        assertNull(next.intro())
        assertEquals(View.VISIBLE, next.home().emblem.visibility)
    }

    @Test
    fun reducedMotionReplayIsAStillPictureThatFades() {
        ExamCountdownApp.introHandled = true
        Store(RuntimeEnvironment.getApplication()).motion = MotionPref.REDUCED
        val activity = launch()
        frames(300)
        activity.click("Settings")
        frames(300)
        activity.click("Replay opening")
        frames(16)
        val intro = activity.intro()!!
        val emblem = intro.emblem()
        var faded = false
        for (i in 0 until 100) {
            frames(16)
            if (activity.intro() == null) break
            assertEquals(1f, emblem.scaleX, 0f)
            assertEquals(0f, emblem.translationX, 0f)
            assertEquals(0f, emblem.translationY, 0f)
            if (intro.alpha in 0.05f..0.95f) faded = true
        }
        assertTrue("fades in and out", faded)
        assertNull("done within 1.6 s", activity.intro())
    }

    @Test
    fun backSkipsToTheHandOver() {
        val activity = launch()
        frames(300)
        @Suppress("DEPRECATION")
        activity.onBackPressed()
        frames(600)
        assertNull(activity.intro())
        assertFalse("the app stays open", activity.isFinishing)
        assertEquals(View.VISIBLE, activity.home().emblem.visibility)
    }
}

package com.imran.examcountdown

import android.app.Activity
import android.graphics.Bitmap
import android.graphics.Canvas
import com.imran.examcountdown.core.Choices
import com.imran.examcountdown.core.Elective
import com.imran.examcountdown.core.MilLanguage
import com.imran.examcountdown.core.MotionPref
import com.imran.examcountdown.data.AppClock
import com.imran.examcountdown.data.Store
import org.junit.After
import org.junit.Assume.assumeTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.Robolectric
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode
import org.robolectric.shadows.ShadowChoreographer
import java.io.File
import java.io.FileOutputStream

/**
 * Records animations frame by frame with Android's native graphics, for reviewing motion design
 * (tools/run-tests.sh with SCREENSHOT_DIR set; frames land in SCREENSHOT_DIR/frames/<name>/).
 * The choreographer is paused so every frame happens at an exact, known time.
 */
@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = [35], qualifiers = "w360dp-h780dp-xxhdpi")
class MotionFramesTest {

    private val dir: File? = System.getProperty("screenshotDir")?.takeIf { it.isNotBlank() }?.let { File(it, "frames") }

    @Before
    fun setUp() {
        assumeTrue("set SCREENSHOT_DIR to record frames", dir != null)
        ShadowChoreographer.setPaused(true)
        ExamCountdownApp.introHandled = true
        Store(RuntimeEnvironment.getApplication()).apply {
            setupDone = true
            choices = Choices(MilLanguage.BENGALI, Elective.COMPUTER_SCIENCE)
            motion = MotionPref.FULL
        }
    }

    @After
    fun tearDown() {
        ShadowChoreographer.setPaused(false)
        AppClock.pinnedWall = null
        ExamCountdownApp.introHandled = true
    }

    private fun launch(now: Long): MainActivity {
        AppClock.pinnedWall = now
        val activity = Robolectric.buildActivity(MainActivity::class.java).setup().get()
        activity.applySystemBars(24, 16)
        return activity
    }

    @Test
    @Config(qualifiers = "+night")
    fun introDark() {
        ExamCountdownApp.introHandled = false
        val activity = launch(ist(2026, 9, 27, 18, 0))
        record(activity, "intro-dark", 66)
    }

    @Test
    @Config(qualifiers = "+night")
    fun liveExamDark() {
        val activity = launch(ist(2026, 9, 28, 12, 45))
        record(activity, "live-dark", 40, stepMs = 50)
    }

    @Test
    fun homeEntrance() {
        val activity = launch(ist(2026, 9, 27, 18, 0))
        record(activity, "home-entrance", 54)
    }

    @Test
    fun tabs() {
        val activity = launch(ist(2026, 9, 30, 10, 0))
        frames(2500)
        activity.click("Timetable")
        record(activity, "tab-timetable", 30)
        frames(1500)
        activity.click("Study")
        record(activity, "tab-study", 24)
        frames(1500)
        activity.click("Home")
        record(activity, "tab-home", 24)
    }

    @Test
    fun liveExam() {
        val activity = launch(ist(2026, 9, 28, 12, 45))
        frames(2500)
        record(activity, "live-exam", 48, stepMs = 100)
    }

    @Test
    fun toggle() {
        val activity = launch(ist(2026, 9, 27, 18, 0))
        frames(2000)
        activity.click("Settings")
        frames(1500)
        val toggle = activity.root().allViews().filterIsInstance<com.imran.examcountdown.ui.widgets.ToggleView>().first { it.isShown }
        val scroll = activity.root().allViews().filterIsInstance<android.widget.ScrollView>().first { it.isShown }
        scroll.scrollTo(0, (toggle.windowRect().top - activity.resources.displayMetrics.heightPixels / 3).coerceAtLeast(0))
        idle(100)
        toggle.performClick()
        record(activity, "toggle", 24, stepMs = 25)
    }

    @Test
    fun checklist() {
        val activity = launch(ist(2026, 9, 27, 18, 0))
        frames(2000)
        activity.openChecklist(com.imran.examcountdown.core.Subject.MIL)
        settle(activity, 1500)
        activity.click("Read through every lesson and poem")
        record(activity, "checklist", 36, stepMs = 33)
    }

    /** Saves the whole window at half resolution. */
    private fun frame(activity: Activity, name: String, index: Int) {
        val root = activity.window.decorView
        val full = Bitmap.createBitmap(root.width, root.height, Bitmap.Config.ARGB_8888)
        root.draw(Canvas(full))
        val small = Bitmap.createScaledBitmap(full, root.width / 2, root.height / 2, true)
        val out = File(dir, name).apply { mkdirs() }
        FileOutputStream(File(out, "%04d.png".format(index))).use { small.compress(Bitmap.CompressFormat.PNG, 100, it) }
    }

    /** Records [count] frames, [stepMs] apart, running [each] before every frame. */
    private fun record(activity: Activity, name: String, count: Int, stepMs: Long = 33, each: (Int) -> Unit = {}) {
        for (i in 0 until count) {
            each(i)
            frame(activity, name, i)
            idle(stepMs)
        }
    }

    /**
     * Lets [millis] pass frame by frame, drawing the window each time as a screen would. Some
     * motion (a ScrollView's smooth scroll) only advances when it is drawn.
     */
    private fun settle(activity: Activity, millis: Long) {
        val root = activity.window.decorView
        val canvas = Canvas(Bitmap.createBitmap(root.width.coerceAtLeast(1), root.height.coerceAtLeast(1), Bitmap.Config.ARGB_8888))
        var left = millis
        while (left > 0) {
            root.draw(canvas)
            idle(16)
            left -= 16
        }
    }

    private fun MainActivity.countdown() = root().allViews().filterIsInstance<com.imran.examcountdown.ui.widgets.CountdownView>().single()

    @Test
    fun countdownSpinIn() {
        val start = ist(2026, 9, 27, 18, 0, 0)
        AppClock.pinnedWall = start
        val activity = Robolectric.buildActivity(MainActivity::class.java).setup().get()
        activity.applySystemBars(24, 16)
        frames(1500)
        activity.countdown().spinIn()
        record(activity, "countdown-spin", 60)
    }

    @Test
    fun countdownSpinWhileTicking() {
        // The clock keeps running during the slot-machine spin, so drums are re-aimed mid-spin.
        val start = ist(2026, 9, 27, 17, 59, 58)
        AppClock.pinnedWall = start
        val activity = Robolectric.buildActivity(MainActivity::class.java).setup().get()
        activity.applySystemBars(24, 16)
        frames(1500)
        val t0 = start + 1500
        AppClock.pinnedWall = t0
        activity.countdown().spinIn()
        record(activity, "countdown-spin-ticking", 75) { i -> AppClock.pinnedWall = t0 + i * 33L }
        frames(1200)
        // Whatever happened mid-spin, the drums end up showing the true time left.
        val cd = com.imran.examcountdown.core.Countdown.until(ist(2026, 9, 28, 12, 30), AppClock.pinnedWall!!)
        val expected = listOf(cd.hours, cd.minutes, cd.seconds).map { it.toString().padStart(2, '0') }
        val shown = activity.root().allViews().filterIsInstance<com.imran.examcountdown.ui.widgets.RollingNumberView>().filter { it.isShown }.map { it.value }
        org.junit.Assert.assertEquals(expected, shown)
        org.junit.Assert.assertTrue("drums at rest", activity.root().allViews().filterIsInstance<com.imran.examcountdown.ui.widgets.RollingNumberView>().none { it.isAnimating })
    }

    @Test
    fun countdownRollover() {
        // 18:30:01 left: two seconds later the minutes (and seconds) turn over.
        val start = ist(2026, 9, 27, 17, 59, 59)
        AppClock.pinnedWall = start
        val activity = Robolectric.buildActivity(MainActivity::class.java).setup().get()
        activity.applySystemBars(24, 16)
        frames(1500)
        AppClock.pinnedWall = start + 400
        idle(700)
        record(activity, "countdown-roll", 60, stepMs = 33) { i -> AppClock.pinnedWall = start + 1100 + i * 33L }
    }

    @Test
    fun celebration() {
        AppClock.pinnedWall = ist(2026, 10, 13, 9, 0)
        val activity = Robolectric.buildActivity(MainActivity::class.java).setup().get()
        activity.applySystemBars(24, 16)
        record(activity, "celebration", 95, stepMs = 50)
    }

    @Test
    fun intro() {
        ExamCountdownApp.introHandled = false
        AppClock.pinnedWall = ist(2026, 9, 27, 18, 0)
        val activity = Robolectric.buildActivity(MainActivity::class.java).setup().get()
        activity.applySystemBars(24, 16)
        record(activity, "intro", 72)
    }
}

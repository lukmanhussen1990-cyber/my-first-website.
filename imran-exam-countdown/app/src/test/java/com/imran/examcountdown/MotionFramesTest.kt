package com.imran.examcountdown

import android.app.Activity
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.view.View
import com.imran.examcountdown.core.AvatarFrame
import com.imran.examcountdown.core.Choices
import com.imran.examcountdown.core.Elective
import com.imran.examcountdown.core.MilLanguage
import com.imran.examcountdown.core.MotionPref
import com.imran.examcountdown.data.AppClock
import com.imran.examcountdown.data.Avatar
import com.imran.examcountdown.data.Store
import com.imran.examcountdown.ui.Ui
import com.imran.examcountdown.ui.screens.HomeScreen
import com.imran.examcountdown.ui.widgets.AvatarView
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

    private fun savePhotoAndFrame(frame: AvatarFrame) {
        val app = RuntimeEnvironment.getApplication()
        Avatar.save(app, portrait())
        Store(app).avatarFrame = frame
    }

    // ------------------------------------------------------------------ opening

    @Test
    fun intro() {
        ExamCountdownApp.introHandled = false
        val activity = launch(ist(2026, 9, 27, 18, 0))
        record(activity, "intro", 76)
    }

    @Test
    @Config(qualifiers = "+night")
    fun introDark() {
        ExamCountdownApp.introHandled = false
        val activity = launch(ist(2026, 9, 27, 18, 0))
        record(activity, "intro-dark", 76)
    }

    @Test
    fun introReplayFromSettings() {
        val activity = launch(ist(2026, 9, 27, 18, 0))
        frames(1500)
        activity.click("Settings")
        frames(800)
        activity.click("Replay opening")
        record(activity, "intro-replay", 76)
    }

    @Test
    fun introReducedMotionReplay() {
        Store(RuntimeEnvironment.getApplication()).motion = MotionPref.REDUCED
        val activity = launch(ist(2026, 9, 27, 18, 0))
        frames(500)
        activity.click("Settings")
        frames(300)
        activity.click("Replay opening")
        record(activity, "intro-still", 30, stepMs = 50)
    }

    // ------------------------------------------------------------------ profile

    @Test
    fun profileOpenAndClose() {
        savePhotoAndFrame(AvatarFrame.GOLD_ORBIT)
        val activity = launch(ist(2026, 9, 27, 18, 0))
        frames(1500)
        val avatar = (activity.currentScreen as HomeScreen).avatar
        // A tap: pressed for a moment (it squeezes), then released.
        avatar.isPressed = true
        record(activity, "profile-open", 4, stepMs = 25)
        avatar.isPressed = false
        avatar.performClick()
        record(activity, "profile-open", 40, stepMs = 25, startIndex = 4)
        frames(600)
        activity.root().allViews().first { it.contentDescription == "Close without saving" }.performClick()
        record(activity, "profile-close", 26, stepMs = 25)
    }

    @Test
    @Config(qualifiers = "+night")
    fun profileOpenDark() {
        savePhotoAndFrame(AvatarFrame.TWIN_COMETS)
        val activity = launch(ist(2026, 9, 27, 18, 0))
        frames(1500)
        (activity.currentScreen as HomeScreen).avatar.performClick()
        record(activity, "profile-open-dark", 30, stepMs = 25)
    }

    @Test
    fun framePicker() {
        savePhotoAndFrame(AvatarFrame.DEFAULT)
        val activity = launch(ist(2026, 9, 27, 18, 0))
        frames(1500)
        (activity.currentScreen as HomeScreen).avatar.performClick()
        frames(1200)
        activity.click("Twin Comets")
        record(activity, "picker-preview", 20, stepMs = 25)
        activity.click("Apply")
        record(activity, "picker-apply", 6, stepMs = 50)
    }

    /** Every frame style on its own, large, over time: frames/style-<name>/. */
    @Test
    fun frameStyles() {
        val activity = launch(ist(2026, 9, 27, 18, 0))
        frames(500)
        for (dark in listOf(false, true)) {
            Ui.c = if (dark) Ui.DARK else Ui.LIGHT
            for (frame in AvatarFrame.entries) {
                val view = AvatarView(activity).apply {
                    setPhoto(portrait())
                    setFrame(frame)
                    animateFrame = true
                }
                val size = (150 * activity.resources.displayMetrics.density).toInt()
                val spec = View.MeasureSpec.makeMeasureSpec(size, View.MeasureSpec.EXACTLY)
                view.measure(spec, spec)
                view.layout(0, 0, size, size)
                val out = File(dir, "style-${frame.name.lowercase()}${if (dark) "-dark" else ""}").apply { mkdirs() }
                for (i in 0 until 50) {
                    val bitmap = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888)
                    val canvas = Canvas(bitmap)
                    canvas.drawColor(if (dark) Ui.DARK.bg else Ui.LIGHT.bg)
                    view.draw(canvas)
                    FileOutputStream(File(out, "%04d.png".format(i))).use { bitmap.compress(Bitmap.CompressFormat.PNG, 100, it) }
                    idle(100)
                }
            }
        }
        Ui.c = Ui.LIGHT
    }

    // ------------------------------------------------------------------ everyday motion

    @Test
    fun homeEntrance() {
        val activity = launch(ist(2026, 9, 27, 18, 0))
        record(activity, "home-entrance", 30, stepMs = 25)
    }

    @Test
    fun tabs() {
        val activity = launch(ist(2026, 9, 30, 10, 0))
        frames(2500)
        activity.click("Timetable")
        record(activity, "tab-timetable", 20, stepMs = 25)
        frames(1500)
        activity.click("Study")
        record(activity, "tab-study", 16, stepMs = 25)
        frames(1500)
        activity.click("Home")
        record(activity, "tab-home", 16, stepMs = 25)
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
        record(activity, "toggle", 14, stepMs = 25)
    }

    @Test
    fun checklist() {
        val activity = launch(ist(2026, 9, 27, 18, 0))
        frames(2000)
        activity.openChecklist(com.imran.examcountdown.core.Subject.MIL)
        settle(activity, 1500)
        activity.click("Read through every lesson and poem")
        record(activity, "checklist", 18, stepMs = 25)
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
        record(activity, "countdown-roll", 40, stepMs = 25) { i -> AppClock.pinnedWall = start + 1100 + i * 25L }
    }

    @Test
    fun celebration() {
        AppClock.pinnedWall = ist(2026, 10, 13, 9, 0)
        val activity = Robolectric.buildActivity(MainActivity::class.java).setup().get()
        activity.applySystemBars(24, 16)
        record(activity, "celebration", 95, stepMs = 50)
    }

    /**
     * One continuous take at 30 frames a second for the screen recording: the opening, tapping
     * the avatar, previewing and applying frames, closing, the countdown ticking and a few tabs.
     */
    @Test
    fun showreel() {
        val app = RuntimeEnvironment.getApplication()
        Avatar.save(app, portrait())
        ExamCountdownApp.introHandled = false
        var now = ist(2026, 9, 27, 17, 59, 57)
        AppClock.pinnedWall = now
        val activity = Robolectric.buildActivity(MainActivity::class.java).setup().get()
        activity.applySystemBars(24, 16)
        var index = 0
        fun take(count: Int) {
            repeat(count) {
                frame(activity, "showreel", index++)
                idle(33)
                now += 33
                AppClock.pinnedWall = now
            }
        }
        take(80)
        take(20)
        val avatar = (activity.currentScreen as HomeScreen).avatar
        avatar.isPressed = true
        take(3)
        avatar.isPressed = false
        avatar.performClick()
        take(36)
        for (name in listOf("Gold Orbit", "Emerald Wave", "Twin Comets", "Gold Shimmer")) {
            activity.click(name)
            take(if (name == "Gold Shimmer") 50 else 36)
        }
        activity.click("Twin Comets")
        take(12)
        activity.click("Apply")
        take(24)
        activity.root().allViews().first { it.contentDescription == "Close without saving" }.performClick()
        take(40)
        activity.click("Timetable")
        take(30)
        activity.click("Study")
        take(20)
        activity.openChecklist(com.imran.examcountdown.core.Subject.MIL)
        take(30)
        activity.click("Read through every lesson and poem")
        take(24)
        activity.click("Settings")
        take(24)
        activity.click("Home")
        take(40)
    }

    // ------------------------------------------------------------------ helpers

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
    private fun record(activity: Activity, name: String, count: Int, stepMs: Long = 33, startIndex: Int = 0, each: (Int) -> Unit = {}) {
        for (i in 0 until count) {
            each(i)
            frame(activity, name, startIndex + i)
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
}

/** A stand-in portrait for tests: a face, hair and a green school shirt on a blue background. */
fun portrait(): Bitmap = Bitmap.createBitmap(512, 512, Bitmap.Config.ARGB_8888).apply {
    val c = Canvas(this)
    c.drawColor(Color.rgb(96, 140, 176))
    val p = Paint(Paint.ANTI_ALIAS_FLAG)
    p.color = Color.rgb(34, 84, 58)
    c.drawOval(96f, 360f, 416f, 640f, p)
    p.color = Color.rgb(222, 184, 146)
    c.drawOval(166f, 150f, 346f, 360f, p)
    p.color = Color.rgb(38, 32, 30)
    c.drawArc(160f, 120f, 352f, 300f, 180f, 180f, true, p)
}

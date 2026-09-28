package com.imran.examcountdown

import android.app.Activity
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.RectF
import android.widget.ScrollView
import com.imran.examcountdown.core.Choices
import com.imran.examcountdown.core.Elective
import com.imran.examcountdown.core.MilLanguage
import com.imran.examcountdown.core.MotionPref
import com.imran.examcountdown.data.AppClock
import com.imran.examcountdown.data.Store
import com.imran.examcountdown.ui.Ui
import com.imran.examcountdown.ui.screens.HomeScreen
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
 * Renders real screens with Android's native graphics (Robolectric) at 360×780 dp and saves
 * PNGs to -DscreenshotDir. The status and navigation bars are drawn in afterwards to show where
 * Android's own bars sit (gesture pill or three buttons); everything else is the app itself.
 */
@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = [35], qualifiers = "w360dp-h780dp-xxhdpi")
class ScreenshotTest {

    private val dir: File? = System.getProperty("screenshotDir")?.takeIf { it.isNotBlank() }?.let { File(it).apply { mkdirs() } }

    @Before
    fun setUp() {
        assumeTrue("set SCREENSHOT_DIR to render screenshots", dir != null)
        ExamCountdownApp.introHandled = true
        Store(RuntimeEnvironment.getApplication()).apply {
            setupDone = true
            choices = Choices(MilLanguage.BENGALI, Elective.COMPUTER_SCIENCE)
            motion = MotionPref.REDUCED
        }
    }

    @After
    fun tearDown() {
        AppClock.pinnedWall = null
    }

    private fun launchAt(now: Long, threeButtons: Boolean = false): MainActivity {
        AppClock.pinnedWall = now
        val activity = Robolectric.buildActivity(MainActivity::class.java).setup().get()
        idle(200)
        activity.applySystemBars(24, if (threeButtons) 48 else 16)
        idle(200)
        return activity
    }

    private fun shoot(activity: Activity, name: String, threeButtons: Boolean = false) {
        idle(100)
        val root = activity.window.decorView
        val bitmap = Bitmap.createBitmap(root.width, root.height, Bitmap.Config.ARGB_8888)
        val canvas = Canvas(bitmap)
        root.draw(canvas)
        drawSystemBars(canvas, activity, threeButtons)
        FileOutputStream(File(dir, "$name.png")).use { bitmap.compress(Bitmap.CompressFormat.PNG, 100, it) }
    }

    /** Simulated Android status bar (time + icons) and navigation bar, in the system's contrast colour. */
    private fun drawSystemBars(canvas: Canvas, activity: Activity, threeButtons: Boolean) {
        val d = activity.resources.displayMetrics.density
        val w = canvas.width.toFloat()
        val h = canvas.height.toFloat()
        val ink = if (Ui.c.dark) Color.argb(230, 240, 240, 235) else Color.argb(220, 30, 30, 30)
        val p = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = ink; textSize = 13 * d }
        canvas.drawText("12:30", 16 * d, 17 * d, p)
        canvas.drawRoundRect(RectF(w - 38 * d, 7 * d, w - 16 * d, 17 * d), 2 * d, 2 * d, p.apply { style = Paint.Style.STROKE; strokeWidth = 1.2f * d })
        canvas.drawRect(w - 36 * d, 9 * d, w - 24 * d, 15 * d, p.apply { style = Paint.Style.FILL })
        if (threeButtons) {
            val cy = h - 24 * d
            p.style = Paint.Style.STROKE
            p.strokeWidth = 1.6f * d
            canvas.drawCircle(w / 2, cy, 8 * d, p)
            canvas.drawRoundRect(RectF(w * 0.78f - 7 * d, cy - 7 * d, w * 0.78f + 7 * d, cy + 7 * d), 2 * d, 2 * d, p)
            val path = android.graphics.Path().apply {
                moveTo(w * 0.22f + 6 * d, cy - 8 * d)
                lineTo(w * 0.22f - 6 * d, cy)
                lineTo(w * 0.22f + 6 * d, cy + 8 * d)
                close()
            }
            canvas.drawPath(path, p)
        } else {
            p.style = Paint.Style.FILL
            canvas.drawRoundRect(RectF(w / 2 - 54 * d, h - 10 * d, w / 2 + 54 * d, h - 6 * d), 2 * d, 2 * d, p)
        }
    }

    private fun MainActivity.scrollToBottom() {
        root().allViews().filterIsInstance<ScrollView>().first { it.isShown }.scrollTo(0, Int.MAX_VALUE / 2)
        idle(50)
    }

    @Test
    fun firstRunSetup() {
        Store(RuntimeEnvironment.getApplication()).setupDone = false
        val activity = launchAt(ist(2026, 9, 27, 18, 0))
        shoot(activity, "01-setup-welcome")
        activity.click("Let’s go")
        activity.click("Bengali")
        shoot(activity, "02-setup-mil")
    }

    @Test
    fun home() {
        val activity = launchAt(ist(2026, 9, 27, 18, 0))
        shoot(activity, "03-home")
        activity.scrollToBottom()
        shoot(activity, "04-home-scrolled")
    }

    @Test
    fun homeThreeButtonNavigation() {
        val activity = launchAt(ist(2026, 9, 27, 18, 0), threeButtons = true)
        activity.scrollToBottom()
        shoot(activity, "05-home-scrolled-three-button-nav", threeButtons = true)
    }

    @Test
    @Config(qualifiers = "+night")
    fun homeDark() {
        val activity = launchAt(ist(2026, 9, 27, 18, 0))
        shoot(activity, "06-home-dark")
    }

    @Test
    fun examTime() {
        val activity = launchAt(ist(2026, 9, 28, 12, 45))
        shoot(activity, "07-exam-time")
    }

    @Test
    fun timetable() {
        val activity = launchAt(ist(2026, 9, 30, 10, 0))
        activity.click("Timetable")
        idle(300)
        shoot(activity, "08-timetable")
    }

    @Test
    fun study() {
        val activity = launchAt(ist(2026, 9, 27, 18, 0))
        activity.click("Study")
        idle(200)
        activity.click("Start focus")
        AppClock.pinnedWall = ist(2026, 9, 27, 18, 0) + 7 * 60_000L
        idle(1000)
        activity.openChecklist(com.imran.examcountdown.core.Subject.MIL)
        idle(300)
        activity.root().allViews().filterIsInstance<ScrollView>().first { it.isShown }.scrollTo(0, 0)
        shoot(activity, "09-study")
    }

    @Test
    fun settings() {
        val activity = launchAt(ist(2026, 9, 27, 18, 0))
        activity.click("Settings")
        idle(200)
        shoot(activity, "10-settings")
        val scroll = activity.root().allViews().filterIsInstance<ScrollView>().first { it.isShown }
        val appearance = activity.findText("APPEARANCE").first()
        scroll.scrollTo(0, appearance.top + (appearance.parent as android.view.View).top - activity.resources.displayMetrics.density.toInt() * 80)
        shoot(activity, "11-settings-appearance")
    }

    @Test
    fun profilePhoto() {
        val activity = launchAt(ist(2026, 9, 27, 18, 0))
        (activity.currentScreen as HomeScreen).avatar.performClick()
        idle(300)
        shoot(activity, "12-profile-editor")
        val photo = Bitmap.createBitmap(900, 1200, Bitmap.Config.ARGB_8888).apply {
            val c = Canvas(this)
            c.drawColor(Color.rgb(58, 120, 160))
            val paint = Paint(Paint.ANTI_ALIAS_FLAG)
            paint.color = Color.rgb(233, 196, 150)
            c.drawCircle(450f, 520f, 230f, paint)
            paint.color = Color.rgb(40, 40, 40)
            c.drawCircle(450f, 330f, 200f, paint)
            paint.color = Color.rgb(30, 90, 60)
            c.drawRect(170f, 780f, 730f, 1200f, paint)
        }
        activity.profileEditor!!.onPhotoPicked(photo)
        idle(200)
        shoot(activity, "13-profile-crop")
        activity.click("Use photo")
        activity.click("Save")
        idle(400)
        shoot(activity, "14-home-with-photo")
    }

    @Test
    fun celebration() {
        Store(RuntimeEnvironment.getApplication()).motion = MotionPref.FULL
        AppClock.pinnedWall = ist(2026, 10, 13, 9, 0)
        val activity = Robolectric.buildActivity(MainActivity::class.java).setup().get()
        activity.applySystemBars(24, 16)
        idle(700)
        shoot(activity, "15-celebration")
    }

    @Test
    fun introSequence() {
        ExamCountdownApp.introHandled = false
        Store(RuntimeEnvironment.getApplication()).motion = MotionPref.FULL
        AppClock.pinnedWall = ist(2026, 9, 27, 18, 0)
        // Frames advance only with the clock, so each shot shows the intro at that moment.
        ShadowChoreographer.setPaused(true)
        try {
            val activity = Robolectric.buildActivity(MainActivity::class.java).setup().get()
            activity.applySystemBars(24, 16)
            idle(330)
            shoot(activity, "16-intro-0.35s")
            idle(620)
            shoot(activity, "17-intro-0.95s")
            idle(250)
            shoot(activity, "18-intro-1.2s")
            idle(450)
            shoot(activity, "19-intro-1.65s")
            idle(700)
            shoot(activity, "20-intro-done")
        } finally {
            ShadowChoreographer.setPaused(false)
        }
    }

    @Test
    @Config(qualifiers = "w320dp-h568dp-hdpi")
    fun smallPhoneLargeText() {
        RuntimeEnvironment.setFontScale(1.5f)
        val activity = launchAt(ist(2026, 9, 27, 18, 0), threeButtons = true)
        shoot(activity, "21-small-phone-large-text", threeButtons = true)
    }
}

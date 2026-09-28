package com.imran.examcountdown

import android.graphics.Bitmap
import android.graphics.Canvas
import android.os.SystemClock
import android.view.View
import com.imran.examcountdown.core.AvatarFrame
import com.imran.examcountdown.core.MotionPref
import com.imran.examcountdown.data.AppClock
import com.imran.examcountdown.data.Avatar
import com.imran.examcountdown.data.Store
import com.imran.examcountdown.ui.Ui
import com.imran.examcountdown.ui.screens.HomeScreen
import com.imran.examcountdown.ui.widgets.AvatarView
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.Robolectric
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode
import kotlin.math.abs
import kotlin.math.hypot

/**
 * Profile frames: every style draws only its border (the photo's pixels never change), they are
 * all different, animated ones move only when allowed, and the picker previews, applies,
 * cancels, resets and remembers the choice.
 */
@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = [35], qualifiers = "w360dp-h780dp-xxhdpi")
class ProfileFramesTest {

    private val app get() = RuntimeEnvironment.getApplication()
    private val store get() = Store(app)

    @Before
    fun setUp() {
        AppClock.pinnedWall = ist(2026, 9, 27, 18, 0)
        ExamCountdownApp.introHandled = true
        store.apply {
            setupDone = true
            motion = MotionPref.REDUCED
        }
        Avatar.save(app, portrait())
    }

    @After
    fun tearDown() {
        AppClock.pinnedWall = null
        Ui.c = Ui.LIGHT
    }

    private fun launch(): MainActivity = Robolectric.buildActivity(MainActivity::class.java).setup().get().also { idle(100) }

    private fun MainActivity.home(): HomeScreen = currentScreen as HomeScreen

    private fun MainActivity.openProfile() {
        home().avatar.performClick()
        idle(400)
        assertNotNull(profileEditor)
    }

    /** The picker tile for [frame], found by what it tells a screen reader. */
    private fun MainActivity.tile(frame: AvatarFrame): View =
        root().allViews().first { it.contentDescription?.toString()?.startsWith("${frame.label} frame") == true }

    private fun MainActivity.savedTiles(): List<String> =
        AvatarFrame.entries.filter { tile(it).contentDescription.toString().contains("saved") }.map { it.label }

    private fun MainActivity.closeProfile() {
        root().allViews().first { it.contentDescription == "Close without saving" }.performClick()
        idle(400)
    }

    // ------------------------------------------------------------------ drawing

    /** Renders a standalone 150 dp avatar with [frame] at the current time. */
    private fun render(view: AvatarView): Bitmap {
        val bitmap = Bitmap.createBitmap(view.width, view.height, Bitmap.Config.ARGB_8888)
        val canvas = Canvas(bitmap)
        canvas.drawColor(Ui.c.bg)
        view.draw(canvas)
        return bitmap
    }

    private fun avatar(frame: AvatarFrame, moving: Boolean): AvatarView = AvatarView(app).apply {
        setPhoto(portrait())
        setFrame(frame)
        animateFrame = moving
        val size = (150 * app.resources.displayMetrics.density).toInt()
        val spec = View.MeasureSpec.makeMeasureSpec(size, View.MeasureSpec.EXACTLY)
        measure(spec, spec)
        layout(0, 0, size, size)
    }

    /** Sum of colour differences over the pixels between [from] and [to] (radius fractions). */
    private fun difference(a: Bitmap, b: Bitmap, from: Float, to: Float): Long {
        val c = a.width / 2f
        var sum = 0L
        for (y in 0 until a.height) for (x in 0 until a.width) {
            val r = hypot(x + 0.5f - c, y + 0.5f - c) / c
            if (r < from || r > to) continue
            val p = a.getPixel(x, y)
            val q = b.getPixel(x, y)
            sum += abs((p shr 16 and 255) - (q shr 16 and 255)) + abs((p shr 8 and 255) - (q shr 8 and 255)) + abs((p and 255) - (q and 255))
        }
        return sum
    }

    /** Photo circle, keeping a pixel clear of its anti-aliased edge. */
    private val photo = 0f to AvatarView.PHOTO - 0.012f

    /** The band round the photo where frames are drawn. */
    private val band = AvatarView.PHOTO + 0.01f to 1f

    /** Waits until [period]'s cycle is [phase] ms in (for the occasional shimmer sweep). */
    private fun idleUntil(period: Long, phase: Long) {
        val now = SystemClock.uptimeMillis() % period
        idle(((phase - now) % period + period) % period)
    }

    @Test
    fun everyFrameLeavesThePhotoUntouched() {
        for (dark in listOf(false, true)) {
            Ui.c = if (dark) Ui.DARK else Ui.LIGHT
            val plain = render(avatar(AvatarFrame.NONE, moving = false))
            for (frame in AvatarFrame.entries) {
                val view = avatar(frame, moving = true)
                for (step in 0 until 4) {
                    assertEquals("$frame (dark=$dark) covers none of the photo", 0L, difference(plain, render(view), photo.first, photo.second))
                    idle(700)
                }
            }
        }
    }

    @Test
    fun theSixFramesAreClearlyDifferent() {
        idleUntil(4800, 500)
        val shots = AvatarFrame.entries.associateWith { render(avatar(it, moving = true)) }
        val none = shots.getValue(AvatarFrame.NONE)
        val background = render(avatar(AvatarFrame.NONE, moving = false))
        assertEquals("No Frame is just the photo", 0L, difference(none, background, band.first, band.second))
        val frames = AvatarFrame.entries
        for (i in frames.indices) for (j in i + 1 until frames.size) {
            val d = difference(shots.getValue(frames[i]), shots.getValue(frames[j]), band.first, band.second)
            assertTrue("${frames[i]} vs ${frames[j]}: $d", d > 20_000)
        }
    }

    @Test
    fun animatedFramesMoveOnlyWhenAllowed() {
        for (frame in AvatarFrame.entries) {
            for (moving in listOf(true, false)) {
                val view = avatar(frame, moving)
                if (frame == AvatarFrame.GOLD_SHIMMER) idleUntil(4800, 200)
                val a = render(view)
                idle(450)
                val b = render(view)
                val d = difference(a, b, band.first, band.second)
                if (moving && frame.animated) assertTrue("$frame moves: $d", d > 5_000) else assertEquals("$frame still (moving=$moving)", 0L, d)
            }
        }
    }

    // ------------------------------------------------------------------ picker

    @Test
    fun tappingAFramePreviewsItWithoutSaving() {
        val activity = launch()
        activity.openProfile()
        assertTrue("real photo in the previews", activity.root().allViews().filterIsInstance<AvatarView>().filter { it.isShown }.all { it.hasPhoto })
        assertEquals(listOf("Default"), activity.savedTiles())
        activity.click("Gold Orbit")
        assertEquals("previewed on the large avatar at once", AvatarFrame.GOLD_ORBIT, activity.profileEditor!!.avatar.frame)
        assertEquals("not saved yet", AvatarFrame.DEFAULT, store.avatarFrame)
        assertEquals(listOf("Default"), activity.savedTiles())
        assertTrue(activity.hasText("Previewing Gold Orbit. Tap Apply to keep it."))
    }

    @Test
    fun cancelGoesBackToTheSavedFrame() {
        val activity = launch()
        activity.openProfile()
        activity.click("Emerald Wave")
        activity.click("Cancel")
        assertEquals(AvatarFrame.DEFAULT, activity.profileEditor!!.avatar.frame)
        assertEquals(AvatarFrame.DEFAULT, store.avatarFrame)
    }

    @Test
    fun applySavesMarksWithACheckAndShowsOnHomeAndSettings() {
        val activity = launch()
        activity.openProfile()
        activity.click("Twin Comets")
        activity.click("Apply")
        assertEquals(AvatarFrame.TWIN_COMETS, store.avatarFrame)
        assertEquals(listOf("Twin Comets"), activity.savedTiles())
        assertTrue(activity.hasText("Twin Comets saved."))
        activity.closeProfile()
        assertEquals("Home", AvatarFrame.TWIN_COMETS, activity.home().avatar.frame)
        activity.click("Settings")
        idle(300)
        val settingsAvatar = activity.root().allViews().filterIsInstance<AvatarView>().single { it.isShown }
        assertEquals("Settings", AvatarFrame.TWIN_COMETS, settingsAvatar.frame)
    }

    @Test
    fun resetToDefault() {
        store.avatarFrame = AvatarFrame.GOLD_SHIMMER
        val activity = launch()
        activity.openProfile()
        assertEquals(listOf("Gold Shimmer"), activity.savedTiles())
        activity.click("Reset to Default")
        assertEquals(AvatarFrame.DEFAULT, store.avatarFrame)
        assertEquals(AvatarFrame.DEFAULT, activity.profileEditor!!.avatar.frame)
        assertEquals(listOf("Default"), activity.savedTiles())
    }

    @Test
    fun theChoiceSurvivesARestart() {
        val activity = launch()
        activity.openProfile()
        activity.click("Gold Shimmer")
        activity.click("Apply")
        activity.closeProfile()
        val restarted = launch()
        assertEquals(AvatarFrame.GOLD_SHIMMER, restarted.home().avatar.frame)
        assertTrue(restarted.home().avatar.hasPhoto)
        restarted.openProfile()
        assertEquals(AvatarFrame.GOLD_SHIMMER, restarted.profileEditor!!.avatar.frame)
        assertEquals(listOf("Gold Shimmer"), restarted.savedTiles())
    }

    @Test
    fun saveKeepsAPreviewAndClosingDiscardsIt() {
        val activity = launch()
        activity.openProfile()
        activity.click("Gold Orbit")
        activity.click("Save")
        idle(400)
        assertEquals("Save keeps the frame being previewed", AvatarFrame.GOLD_ORBIT, store.avatarFrame)
        activity.openProfile()
        activity.click("No Frame")
        activity.closeProfile()
        assertEquals("closing without saving discards it", AvatarFrame.GOLD_ORBIT, store.avatarFrame)
        assertEquals(AvatarFrame.GOLD_ORBIT, activity.home().avatar.frame)
    }

    @Test
    fun theAnimationSwitchKeepsTheBorderStill() {
        store.motion = MotionPref.FULL
        store.avatarFrame = AvatarFrame.GOLD_ORBIT
        val activity = launch()
        assertTrue("moving on Home", activity.home().avatar.isFrameMoving)
        activity.openProfile()
        activity.click("Animate frame")
        assertFalse(store.frameAnimated)
        assertFalse(activity.profileEditor!!.avatar.animateFrame)
        activity.closeProfile()
        assertFalse("still on Home too", activity.home().avatar.animateFrame)
        assertFalse(launch().home().avatar.animateFrame)
    }

    @Test
    fun reducedMotionShowsFramesStill() {
        store.avatarFrame = AvatarFrame.TWIN_COMETS
        val activity = launch()
        assertTrue(store.frameAnimated)
        assertFalse(activity.home().avatar.animateFrame)
        assertEquals(AvatarFrame.TWIN_COMETS, activity.home().avatar.frame)
    }

    @Test
    fun replacingAndRemovingThePhotoKeepsTheFrame() {
        store.avatarFrame = AvatarFrame.EMERALD_WAVE
        val activity = launch()
        activity.openProfile()
        activity.profileEditor!!.onPhotoPicked(portrait())
        idle(50)
        assertTrue("crop step", activity.hasText("Move and zoom"))
        activity.click("Use photo")
        assertTrue("previews show the new photo", activity.tile(AvatarFrame.NONE).allViews().filterIsInstance<AvatarView>().single().hasPhoto)
        activity.click("Save")
        idle(400)
        assertTrue(activity.home().avatar.hasPhoto)
        assertEquals(AvatarFrame.EMERALD_WAVE, activity.home().avatar.frame)
        activity.openProfile()
        activity.click("Remove photo")
        assertFalse("previews show the initials", activity.tile(AvatarFrame.NONE).allViews().filterIsInstance<AvatarView>().single().hasPhoto)
        activity.click("Save")
        idle(400)
        assertFalse(activity.home().avatar.hasPhoto)
        assertEquals("the frame stays round the initials", AvatarFrame.EMERALD_WAVE, activity.home().avatar.frame)
    }
}

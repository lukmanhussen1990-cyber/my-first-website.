package com.imran.examcountdown

import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.view.View
import com.imran.examcountdown.core.AvatarFrame
import com.imran.examcountdown.core.MotionPref
import com.imran.examcountdown.data.AppClock
import com.imran.examcountdown.data.Avatar
import com.imran.examcountdown.data.Store
import com.imran.examcountdown.ui.screens.HomeScreen
import org.junit.After
import org.junit.Assert.assertEquals
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
import kotlin.math.cos
import kotlin.math.sin

/**
 * Tapping the avatar: it springs back from the press, a gold ripple runs round its border, and
 * it flies (always round and undistorted) into the profile screen, whose controls then fade in;
 * closing reverses it. Frames are stepped 16 ms at a time.
 */
@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = [35], qualifiers = "w360dp-h780dp-xxhdpi")
class ProfileTransitionTest {

    private val app get() = RuntimeEnvironment.getApplication()

    @Before
    fun setUp() {
        ShadowChoreographer.setPaused(true)
        AppClock.pinnedWall = ist(2026, 9, 27, 18, 0)
        ExamCountdownApp.introHandled = true
        Store(app).apply {
            setupDone = true
            motion = MotionPref.FULL
            avatarFrame = AvatarFrame.GOLD_ORBIT
        }
        Avatar.save(app, portrait())
    }

    @After
    fun tearDown() {
        ShadowChoreographer.setPaused(false)
        AppClock.pinnedWall = null
    }

    private fun launch(): MainActivity = Robolectric.buildActivity(MainActivity::class.java).setup().get().also {
        it.applySystemBars(24, 16)
        frames(1500)
    }

    private fun MainActivity.home(): HomeScreen = currentScreen as HomeScreen

    private fun MainActivity.snapshot(): Bitmap {
        val decor = window.decorView
        return Bitmap.createBitmap(decor.width, decor.height, Bitmap.Config.ARGB_8888).also { decor.draw(Canvas(it)) }
    }

    private fun MainActivity.topBar(): View = findText("Save").first().parent as View

    @Test
    fun tapRipplesAndExpandsTheAvatarIntoTheProfileScreen() {
        val activity = launch()
        val home = activity.home().avatar
        val from = home.windowRect()
        home.performClick()
        frames(32)
        val fly = activity.flyingAvatar
        assertNotNull("a shared avatar flies", fly)
        assertEquals("the tapped avatar hands over to it", View.INVISIBLE, home.visibility)
        val editor = activity.profileEditor!!
        assertEquals("the large avatar waits for it", View.INVISIBLE, editor.avatar.visibility)
        assertEquals("controls wait until it lands", 0f, activity.topBar().alpha, 0f)

        // A thin gold ring spreads just outside the avatar's border.
        frames(100)
        val shot = activity.snapshot()
        val cx = from.exactCenterX()
        val cy = from.exactCenterY()
        val d = activity.resources.displayMetrics.density
        var gold = 0
        for (k in 0 until 36) {
            val a = Math.toRadians(k * 10.0)
            val hit = (2..14).any { dp ->
                val r = from.width() / 2f + dp * d
                val p = shot.getPixel((cx + cos(a) * r).toInt(), (cy + sin(a) * r).toInt())
                Color.red(p) - Color.blue(p) > 70 && Color.red(p) > 170
            }
            if (hit) gold++
        }
        assertTrue("gold ripple round the border ($gold of 36)", gold >= 30)

        // In flight it is always a square view drawn as a circle, growing towards the target.
        var last = 0
        var landed = false
        for (i in 0 until 60) {
            frames(16)
            val f = activity.flyingAvatar
            if (f == null) {
                landed = true
                break
            }
            assertEquals("never stretched", f.width.toFloat(), f.height.toFloat(), 1f)
            assertTrue("grows smoothly", f.width >= last - 2)
            last = f.width
            assertTrue(f.hasPhoto)
            assertEquals(AvatarFrame.GOLD_ORBIT, f.frame)
        }
        assertTrue("landed within a second", landed)
        assertEquals(editor.avatar.width.toFloat(), last.toFloat(), 3f)
        assertEquals(View.VISIBLE, editor.avatar.visibility)
        assertEquals(View.VISIBLE, home.visibility)
        frames(500)
        assertEquals("controls faded in after it settled", 1f, activity.topBar().alpha, 0f)
    }

    @Test
    fun closingReversesTheTransition() {
        val activity = launch()
        val home = activity.home().avatar
        home.performClick()
        frames(1200)
        val editor = activity.profileEditor!!
        activity.root().allViews().first { it.contentDescription == "Close without saving" }.performClick()
        frames(32)
        assertNotNull("flies back", activity.flyingAvatar)
        assertEquals(View.INVISIBLE, home.visibility)
        assertTrue("still on screen while it flies back", editor.root.parent != null)
        frames(700)
        assertNull(activity.flyingAvatar)
        assertNull(activity.profileEditor)
        assertNull("removed", editor.root.parent)
        assertEquals(View.VISIBLE, home.visibility)
        assertEquals(2, activity.appRoot().childCount)
    }

    @Test
    fun rapidTapsNeverStackTransitions() {
        val activity = launch()
        val home = activity.home().avatar
        repeat(6) {
            home.performClick()
            frames(48)
            @Suppress("DEPRECATION")
            activity.onBackPressed()
            frames(48)
        }
        frames(1000)
        assertNull(activity.flyingAvatar)
        assertNull(activity.profileEditor)
        assertEquals("only the app's own layers are left", 2, activity.appRoot().childCount)
        assertEquals(View.VISIBLE, home.visibility)
        // And it still opens normally afterwards.
        home.performClick()
        frames(1200)
        assertNotNull(activity.profileEditor)
        assertEquals(View.VISIBLE, activity.profileEditor!!.avatar.visibility)
    }

    @Test
    fun reducedMotionOpensWithASimpleFade() {
        Store(app).motion = MotionPref.REDUCED
        val activity = launch()
        activity.home().avatar.performClick()
        frames(48)
        assertNull("nothing flies", activity.flyingAvatar)
        val root = activity.profileEditor!!.root
        assertTrue("fading in: ${root.alpha}", root.alpha > 0f && root.alpha < 1f)
        frames(300)
        assertEquals(1f, root.alpha, 0f)
        assertEquals(View.VISIBLE, activity.profileEditor!!.avatar.visibility)
    }

    @Test
    fun settingsAvatarAlsoExpandsIntoTheProfile() {
        val activity = launch()
        activity.click("Settings")
        frames(600)
        activity.click("Imran Hussain")
        frames(32)
        assertNotNull(activity.flyingAvatar)
        frames(1200)
        assertNull(activity.flyingAvatar)
        assertNotNull(activity.profileEditor)
    }
}

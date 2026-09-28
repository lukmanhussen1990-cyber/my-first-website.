package com.imran.examcountdown

import com.imran.examcountdown.core.AvatarFrame
import com.imran.examcountdown.core.Countdown
import com.imran.examcountdown.core.MotionPref
import com.imran.examcountdown.data.AppClock
import com.imran.examcountdown.data.Avatar
import com.imran.examcountdown.data.Store
import com.imran.examcountdown.ui.screens.HomeScreen
import com.imran.examcountdown.ui.widgets.RollingNumberView
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertSame
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.Robolectric
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config
import org.robolectric.shadows.ShadowChoreographer

/**
 * Performance and lifecycle: continuous effects stop in the background and resume after,
 * navigating back and forth never piles up animation loops, the countdown only moves the digits
 * that change, and the screen isn't rebuilt every second.
 */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35])
class MotionLifecycleTest {

    private val app get() = RuntimeEnvironment.getApplication()

    @Before
    fun setUp() {
        ShadowChoreographer.setPaused(true)
        ExamCountdownApp.introHandled = true
        Store(app).apply {
            setupDone = true
            motion = MotionPref.FULL
            avatarFrame = AvatarFrame.TWIN_COMETS
        }
        Avatar.save(app, portrait())
    }

    @After
    fun tearDown() {
        ShadowChoreographer.setPaused(false)
        AppClock.pinnedWall = null
    }

    private fun MainActivity.numbers(): List<RollingNumberView> =
        root().allViews().filterIsInstance<RollingNumberView>().filter { it.isShown }

    @Test
    fun continuousEffectsStopInTheBackgroundAndResumeAfter() {
        AppClock.pinnedWall = ist(2026, 9, 27, 18, 0)
        val controller = Robolectric.buildActivity(MainActivity::class.java).setup()
        val activity = controller.get()
        frames(1000)
        val avatar = (activity.currentScreen as HomeScreen).avatar
        assertTrue(activity.ambient.isRunning)
        assertTrue("the frame moves while Home is in front", avatar.isFrameMoving)

        controller.pause().stop()
        idle(100)
        assertFalse("drifting light and pulses stop", activity.ambient.isRunning)
        assertFalse("the frame stops", avatar.animateFrame)

        controller.restart().start().resume()
        frames(100)
        assertTrue(activity.ambient.isRunning)
        assertTrue(avatar.isFrameMoving)
        assertEquals(1, activity.ambient.listenerCount)
    }

    @Test
    fun navigatingBackAndForthNeverPilesUpLoops() {
        AppClock.pinnedWall = ist(2026, 9, 27, 18, 0)
        val activity = Robolectric.buildActivity(MainActivity::class.java).setup().get()
        frames(800)
        val home = (activity.currentScreen as HomeScreen).avatar
        repeat(6) {
            for (tab in listOf("Timetable", "Study", "Settings", "Home")) {
                activity.click(tab)
                frames(40)
            }
        }
        // Once another tab has replaced Home (240 ms), Home's frame stops.
        for (tab in listOf("Timetable", "Study", "Settings")) {
            activity.click(tab)
            frames(300)
            assertFalse("$tab shown: Home's frame is still", home.isFrameMoving)
            activity.click("Home")
            frames(300)
        }
        frames(600)
        assertEquals("only the visible screen follows the ambient clock", 1, activity.ambient.listenerCount)
        assertTrue(home.isFrameMoving)
        activity.click("Settings")
        frames(400)
        assertEquals("Settings has no continuous effects", 0, activity.ambient.listenerCount)
    }

    @Test
    fun onlyTheDigitsThatChangeSlide() {
        // 18:29:55 left; a second later only the seconds change.
        val start = ist(2026, 9, 27, 18, 0, 5)
        AppClock.pinnedWall = start
        val activity = Robolectric.buildActivity(MainActivity::class.java).setup().get()
        frames(1500)
        val (hours, minutes, seconds) = activity.numbers()
        assertEquals(listOf("18", "29", "55"), listOf(hours.value, minutes.value, seconds.value))
        AppClock.pinnedWall = start + 1000
        var waited = 0
        while (seconds.value == "55" && waited < 1100) {
            frames(16)
            waited += 16
        }
        assertEquals("54", seconds.value)
        assertTrue("the seconds slide", seconds.isAnimating)
        assertFalse("minutes stay still", minutes.isAnimating)
        assertFalse("hours stay still", hours.isAnimating)
        frames(300)
        assertFalse("each slide takes under 300 ms", seconds.isAnimating)
    }

    @Test
    fun tickingDoesNotRebuildTheScreen() {
        val start = ist(2026, 9, 27, 18, 0, 5)
        AppClock.pinnedWall = start
        val activity = Robolectric.buildActivity(MainActivity::class.java).setup().get()
        frames(1500)
        val before = activity.root().allViews()
        val greeting = activity.findText("Hey, Imran").single()
        for (s in 1..5) {
            AppClock.pinnedWall = start + s * 1000L
            frames(1000)
        }
        val after = activity.root().allViews()
        assertEquals("no views added or removed by five ticks", before.size, after.size)
        assertSame(greeting, activity.findText("Hey, Imran").single())
        assertEquals(listOf("18", "29", "50"), activity.numbers().map { it.value })
    }

    @Test
    fun theCountdownIsRightAfterComingBackFromTheBackground() {
        val start = ist(2026, 9, 27, 18, 0)
        AppClock.pinnedWall = start
        val controller = Robolectric.buildActivity(MainActivity::class.java).setup()
        val activity = controller.get()
        frames(1000)
        controller.pause().stop()
        // Two hours, thirteen minutes and twenty seconds pass with the app in the background.
        val later = start + (2 * 3600 + 13 * 60 + 20) * 1000L
        AppClock.pinnedWall = later
        controller.restart().start().resume()
        frames(100)
        val cd = Countdown.until(ist(2026, 9, 28, 12, 30), later)
        val expected = listOf(cd.hours, cd.minutes, cd.seconds).map { it.toString().padStart(2, '0') }
        assertEquals(expected, activity.numbers().map { it.value })
    }
}

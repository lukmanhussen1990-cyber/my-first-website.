package com.imran.examcountdown

import android.view.View
import com.imran.examcountdown.core.MotionPref
import com.imran.examcountdown.data.AppClock
import com.imran.examcountdown.data.Store
import com.imran.examcountdown.ui.screens.HomeScreen
import com.imran.examcountdown.ui.widgets.IntroView
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
import org.robolectric.shadows.ShadowChoreographer

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35])
class IntroTest {

    @Before
    fun setUp() {
        // Frames only advance with the clock, so the animation plays in real (simulated) time
        // instead of running to its end on the first idle.
        ShadowChoreographer.setPaused(true)
        AppClock.pinnedWall = ist(2026, 9, 27, 18, 0)
        ExamCountdownApp.introHandled = false
        Store(RuntimeEnvironment.getApplication()).setupDone = true
    }

    @After
    fun tearDown() {
        ShadowChoreographer.setPaused(false)
        AppClock.pinnedWall = null
        ExamCountdownApp.introHandled = true
    }

    private fun MainActivity.intro(): IntroView? = root().allViews().filterIsInstance<IntroView>().firstOrNull()
    private fun MainActivity.homeEmblem(): View = (currentScreen as HomeScreen).emblem

    @Test
    fun coldLaunchPlaysTheIntroThenSettlesIntoTheHeader() {
        val activity = Robolectric.buildActivity(MainActivity::class.java).setup().get()
        idle(16)
        assertNotNull("intro plays on a cold launch", activity.intro())
        assertEquals("header emblem waits for the intro", View.INVISIBLE, activity.homeEmblem().visibility)
        frames(900)
        assertNotNull("still running at 0.9 s", activity.intro())
        frames(1300)
        assertNull("finished within about 2 s", activity.intro())
        assertEquals(View.VISIBLE, activity.homeEmblem().visibility)
        assertTrue(activity.hasText("Hey, Imran"))
    }

    @Test
    fun returningToTheAppIsImmediate() {
        ExamCountdownApp.introHandled = true
        val activity = Robolectric.buildActivity(MainActivity::class.java).setup().get()
        idle(16)
        assertNull(activity.intro())
        assertEquals(View.VISIBLE, activity.homeEmblem().visibility)
    }

    @Test
    fun onlyOncePerProcess() {
        Robolectric.buildActivity(MainActivity::class.java).setup()
        frames(2500)
        val second = Robolectric.buildActivity(MainActivity::class.java).setup().get()
        idle(16)
        assertNull("a second activity in the same process skips it", second.intro())
    }

    @Test
    fun reducedMotionSkipsTheIntro() {
        Store(RuntimeEnvironment.getApplication()).motion = MotionPref.REDUCED
        val activity = Robolectric.buildActivity(MainActivity::class.java).setup().get()
        idle(16)
        assertNull(activity.intro())
        assertTrue(activity.hasText("Hey, Imran"))
    }

    @Test
    fun settingTurnsTheIntroOff() {
        Store(RuntimeEnvironment.getApplication()).introEnabled = false
        val activity = Robolectric.buildActivity(MainActivity::class.java).setup().get()
        idle(16)
        assertNull(activity.intro())
    }

    @Test
    fun tapSkipsAhead() {
        val activity = Robolectric.buildActivity(MainActivity::class.java).setup().get()
        frames(300)
        activity.intro()!!.performClick()
        frames(600)
        assertNull(activity.intro())
        assertEquals(View.VISIBLE, activity.homeEmblem().visibility)
    }

    @Test
    fun firstRunIntroLeadsIntoSetup() {
        Store(RuntimeEnvironment.getApplication()).setupDone = false
        val activity = Robolectric.buildActivity(MainActivity::class.java).setup().get()
        frames(2300)
        assertNull(activity.intro())
        assertTrue(activity.hasText("Let’s go"))
    }
}

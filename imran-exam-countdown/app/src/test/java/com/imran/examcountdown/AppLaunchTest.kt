package com.imran.examcountdown

import com.imran.examcountdown.core.Choices
import com.imran.examcountdown.core.Elective
import com.imran.examcountdown.core.MilLanguage
import com.imran.examcountdown.data.AppClock
import com.imran.examcountdown.data.Store
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.Robolectric
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config

/** Launches the real activity and walks through setup into the Home screen. */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [26, 35])
class AppLaunchTest {

    @Before
    fun pinClock() {
        AppClock.pinnedWall = ist(2026, 9, 27, 18, 0)
        ExamCountdownApp.introHandled = true
    }

    @After
    fun unpinClock() {
        AppClock.pinnedWall = null
    }

    @Test
    fun setupThenHomeShowsNextExam() {
        val activity = Robolectric.buildActivity(MainActivity::class.java).setup().get()
        idle()

        assertTrue(activity.hasText("Hey, Imran"))
        activity.click("Let’s go")
        activity.click("Bengali")
        activity.click("Continue")
        activity.click("Computer Science")
        activity.click("Continue")
        activity.click("Not now")
        idle(1500)

        val store = Store(RuntimeEnvironment.getApplication())
        assertTrue(store.setupDone)
        assertEquals(MilLanguage.BENGALI, store.choices.mil)
        assertEquals(Elective.COMPUTER_SCIENCE, store.choices.elective)

        // Home: greeting, identity, next subject, date, start time, hall and the revise action.
        assertTrue(activity.hasText("Hey, Imran"))
        assertTrue(activity.hasText("Class VIII Blue · Roll 47"))
        assertTrue(activity.hasText("NEXT EXAM · MIL"))
        assertTrue(activity.hasText("Bengali"))
        assertTrue(activity.hasText("Mon, 28 Sep"))
        assertTrue(activity.hasText("12:30 PM IST"))
        assertTrue(activity.hasText("Hall 24"))
        assertTrue(activity.hasText("Revise Bengali"))
        assertFalse(activity.hasText("It’s exam time!"))
    }

    @Test
    fun everyTabRenders() {
        Store(RuntimeEnvironment.getApplication()).apply {
            setupDone = true
            choices = Choices(MilLanguage.HINDI, Elective.ARABIC)
        }
        val activity = Robolectric.buildActivity(MainActivity::class.java).setup().get()
        idle(500)
        activity.click("Timetable")
        idle(1500)
        assertTrue(activity.hasText("MIL (Hindi)"))
        assertTrue(activity.hasText("Elective (Arabic)"))
        activity.click("Study")
        idle(500)
        assertTrue(activity.hasText("REVISION CHECKLISTS"))
        activity.click("Settings")
        idle(500)
        assertTrue(activity.hasText("Imran Hussain"))
        activity.click("Home")
        idle(500)
        assertTrue(activity.hasText("Hindi"))
        assertTrue(activity.hasText("Revise Hindi"))
    }
}

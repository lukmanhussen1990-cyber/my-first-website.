package com.imran.examcountdown

import com.imran.examcountdown.core.Choices
import com.imran.examcountdown.core.Elective
import com.imran.examcountdown.core.MilLanguage
import com.imran.examcountdown.core.Timetable
import com.imran.examcountdown.data.AppClock
import com.imran.examcountdown.data.Store
import com.imran.examcountdown.ui.widgets.ConfettiView
import com.imran.examcountdown.ui.widgets.CountdownView
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

/** Home at key moments of the season, including a transition while the app is open. */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35])
class ExamStatesTest {

    @Before
    fun setUp() {
        ExamCountdownApp.introHandled = true
        Store(RuntimeEnvironment.getApplication()).apply {
            setupDone = true
            choices = Choices(MilLanguage.BENGALI, Elective.COMPUTER_SCIENCE)
        }
    }

    @After
    fun tearDown() {
        AppClock.pinnedWall = null
    }

    private fun launchAt(now: Long): MainActivity {
        AppClock.pinnedWall = now
        return Robolectric.buildActivity(MainActivity::class.java).setup().get().also { idle(200) }
    }

    private fun MainActivity.countdownText(): String =
        root().allViews().filterIsInstance<CountdownView>().single().contentDescription.toString()

    @Test
    fun countdownIsCalculatedFromTheCurrentTime() {
        val activity = launchAt(ist(2026, 9, 27, 18, 0))
        assertEquals("18 hours and 30 minutes", activity.countdownText())
        assertTrue(activity.hasText("18"))
        assertTrue(activity.hasText("30"))
        assertTrue(activity.hasText("NEXT EXAM · MIL"))
        assertTrue(activity.hasText("0 of 8 done"))
    }

    @Test
    fun whenTheExamStartsItsExamTimeAndTheFollowingExamIsCountedDown() {
        val activity = launchAt(ist(2026, 9, 28, 12, 29, 58))
        assertFalse(activity.hasText("It’s exam time!"))
        // The clock passes 12:30 while the app is open.
        AppClock.pinnedWall = ist(2026, 9, 28, 12, 30, 1)
        idle(3000)
        assertTrue(activity.hasText("It’s exam time!"))
        assertTrue(activity.hasTextContaining("MIL (Bengali) · started 12:30 PM · Hall 24"))
        assertTrue(activity.hasTextContaining("Duration not confirmed"))
        assertTrue(activity.hasText("FOLLOWING EXAM"))
        assertTrue(activity.hasText("English-I"))
        assertTrue(activity.countdownText().startsWith("1 day, 23 hours"))
        assertTrue("not claimed finished", activity.hasText("0 of 8 done"))
    }

    @Test
    fun markingFinishedCountsTheExam() {
        val activity = launchAt(ist(2026, 9, 28, 15, 40))
        assertTrue(activity.hasText("It’s exam time!"))
        activity.click("Mark as finished")
        activity.click("Mark as finished") // confirm in the dialog
        idle(300)
        assertFalse(activity.hasText("It’s exam time!"))
        assertTrue(activity.hasText("1 of 8 done"))
        assertTrue(Store(RuntimeEnvironment.getApplication()).markedDone.contains(Timetable.DEFAULT[0].key))
    }

    @Test
    fun finalExamThenCelebration() {
        val live = launchAt(ist(2026, 10, 12, 13, 0))
        assertTrue(live.hasText("It’s exam time!"))
        assertTrue(live.hasText("AFTER THIS"))
        assertTrue(live.hasTextContaining("last paper"))
        assertTrue(live.hasText("7 of 8 done"))

        val over = launchAt(ist(2026, 10, 13, 9, 0))
        assertTrue(over.hasText("You did it, Imran! 🎉"))
        assertTrue(over.hasText("All 8 exams are done. Time to relax — you’ve earned it."))
        assertTrue(over.hasText("8 of 8 done"))
        idle(50)
        assertTrue("brief celebration plays", over.root().allViews().filterIsInstance<ConfettiView>().single().isRunning)
        idle(5000)
        assertFalse("and ends", over.root().allViews().filterIsInstance<ConfettiView>().single().isRunning)
    }

    @Test
    fun noCelebrationBeforeTheFinalPaperIsDone() {
        val activity = launchAt(ist(2026, 10, 12, 15, 45))
        idle(100)
        assertFalse(activity.root().allViews().filterIsInstance<ConfettiView>().single().isRunning)
        assertFalse(activity.hasText("You did it, Imran! 🎉"))
    }

    @Test
    fun nextTwoTimetableEntriesAreListed() {
        val activity = launchAt(ist(2026, 9, 27, 18, 0))
        assertTrue(activity.hasText("COMING UP"))
        assertTrue(activity.hasText("English-I"))
        assertTrue(activity.hasText("Social Science"))
        assertFalse("only two", activity.hasText("General Science"))
    }
}

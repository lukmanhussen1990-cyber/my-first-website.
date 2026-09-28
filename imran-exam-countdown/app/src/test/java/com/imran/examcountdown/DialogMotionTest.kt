package com.imran.examcountdown

import com.imran.examcountdown.core.MotionPref
import com.imran.examcountdown.data.AppClock
import com.imran.examcountdown.data.Store
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.Robolectric
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config
import org.robolectric.shadows.ShadowDialog

/** Sheets and dialogs open and close with the app's own animation (a plain fade with reduced motion). */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35])
class DialogMotionTest {

    @Before
    fun setUp() {
        // During the MIL paper, so Home offers "Mark as finished".
        AppClock.pinnedWall = ist(2026, 9, 28, 12, 45)
        ExamCountdownApp.introHandled = true
        Store(RuntimeEnvironment.getApplication()).setupDone = true
    }

    @After
    fun tearDown() {
        AppClock.pinnedWall = null
    }

    private fun openedDialogAnimations(motion: MotionPref): Int {
        Store(RuntimeEnvironment.getApplication()).motion = motion
        val activity = Robolectric.buildActivity(MainActivity::class.java).setup().get()
        idle(500)
        activity.click("Mark as finished")
        return ShadowDialog.getLatestDialog()!!.window!!.attributes.windowAnimations
    }

    @Test
    fun sheetsFadeAndScale() {
        assertEquals(R.style.Animation_ExamCountdown_Sheet, openedDialogAnimations(MotionPref.FULL))
    }

    @Test
    fun reducedMotionSheetsSimplyFade() {
        assertEquals(R.style.Animation_ExamCountdown_Fade, openedDialogAnimations(MotionPref.REDUCED))
    }

    @Test
    fun dateAndTimePickersUseTheSameAnimation() {
        val activity = Robolectric.buildActivity(MainActivity::class.java).setup().get()
        val theme = activity.resources.newTheme().apply { applyStyle(R.style.Theme_ExamCountdown_Dialog, true) }
        val a = theme.obtainStyledAttributes(intArrayOf(android.R.attr.windowAnimationStyle))
        assertEquals(R.style.Animation_ExamCountdown_Sheet, a.getResourceId(0, 0))
        a.recycle()
    }
}

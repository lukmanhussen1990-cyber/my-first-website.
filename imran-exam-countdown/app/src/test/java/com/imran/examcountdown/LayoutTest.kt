package com.imran.examcountdown

import android.widget.ScrollView
import android.widget.TextView
import com.imran.examcountdown.core.AvatarFrame
import com.imran.examcountdown.core.Choices
import com.imran.examcountdown.core.Elective
import com.imran.examcountdown.core.MilLanguage
import com.imran.examcountdown.core.MotionPref
import com.imran.examcountdown.data.AppClock
import com.imran.examcountdown.data.Store
import com.imran.examcountdown.ui.widgets.CountdownView
import com.imran.examcountdown.ui.widgets.NavBar
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

/** The bottom bar must never cover content, with any navigation style or text size. */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35], qualifiers = "w360dp-h720dp-xxhdpi")
class LayoutTest {

    @Before
    fun setUp() {
        AppClock.pinnedWall = ist(2026, 9, 27, 18, 0)
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

    private fun MainActivity.nav(): NavBar = root().allViews().filterIsInstance<NavBar>().single()
    private fun MainActivity.visibleScroll(): ScrollView = root().allViews().filterIsInstance<ScrollView>().first { it.isShown }

    private fun checkNoOverlap(activity: MainActivity, topDp: Int, bottomDp: Int) {
        activity.applySystemBars(topDp, bottomDp)
        val d = activity.resources.displayMetrics.density
        val nav = activity.nav()
        val navRect = nav.windowRect()
        val screenBottom = activity.window.decorView.height
        assertEquals("nav bar reaches the bottom edge", screenBottom, navRect.bottom)
        // The nav items sit above the system navigation area.
        val items = nav.getChildAt(1) as android.view.ViewGroup
        assertEquals((bottomDp * d).toInt(), items.paddingBottom)
        for (i in 0 until items.childCount) {
            val item = items.getChildAt(i)
            assertTrue("touch target ≥ 48dp", item.height >= (48 * d).toInt())
            assertTrue("item above system bar", item.windowRect().bottom <= screenBottom - (bottomDp * d).toInt() + 1)
        }
        for (tab in listOf("Home", "Timetable", "Study", "Settings")) {
            activity.click(tab)
            idle(100)
            val scroll = activity.visibleScroll()
            // Content starts below the status bar...
            val first = (scroll.getChildAt(0) as android.view.ViewGroup).getChildAt(0)
            assertTrue("$tab: content below status bar", first.windowRect().top >= (topDp * d).toInt())
            // ...and its last item can scroll fully above the bottom bar.
            scroll.scrollTo(0, Int.MAX_VALUE / 2)
            idle(16)
            val content = scroll.getChildAt(0) as android.view.ViewGroup
            val last = (content.childCount - 1 downTo 0).map { content.getChildAt(it) }.first { it.visibility == android.view.View.VISIBLE }
            assertTrue("$tab: last item (${last.windowRect()}) clears the nav bar ($navRect)", last.windowRect().bottom <= navRect.top)
            assertTrue("$tab: scroll area ends where the nav bar starts", scroll.windowRect().bottom <= navRect.top)
        }
    }

    @Test
    fun gestureNavigation() {
        val activity = Robolectric.buildActivity(MainActivity::class.java).setup().get()
        idle(100)
        checkNoOverlap(activity, topDp = 24, bottomDp = 16)
    }

    @Test
    fun threeButtonNavigation() {
        val activity = Robolectric.buildActivity(MainActivity::class.java).setup().get()
        idle(100)
        checkNoOverlap(activity, topDp = 24, bottomDp = 48)
    }

    @Test
    @Config(qualifiers = "w320dp-h568dp-hdpi")
    fun smallPhoneWithLargeText() {
        RuntimeEnvironment.setFontScale(1.6f)
        val activity = Robolectric.buildActivity(MainActivity::class.java).setup().get()
        idle(100)
        checkNoOverlap(activity, topDp = 24, bottomDp = 48)
        activity.click("Home")
        idle(100)
        // The countdown shrinks to fit rather than clipping.
        val countdown = activity.root().allViews().filterIsInstance<CountdownView>().single()
        val parent = countdown.parent as android.view.View
        assertTrue("countdown ${countdown.width} fits ${parent.width}", countdown.width <= parent.width)
        // Navigation labels fit their items (shrunk if needed, never clipped).
        activity.nav().let { nav ->
            idle(50)
            nav.allViews().filterIsInstance<TextView>().forEach { label ->
                val needed = label.paint.measureText(label.text.toString())
                assertTrue("“${label.text}” fits: $needed <= ${label.width}", needed <= label.width + 1)
            }
        }
    }

    /** Every label of the profile screen fits: nothing clipped, buttons on one line. */
    private fun checkProfileScreen(activity: MainActivity, bottomDp: Int) {
        // With a photo, both photo buttons show: the widest the layout gets.
        com.imran.examcountdown.data.Avatar.save(activity, portrait())
        activity.onAvatarChanged()
        activity.click("Home")
        idle(100)
        (activity.currentScreen as com.imran.examcountdown.ui.screens.HomeScreen).avatar.performClick()
        idle(400)
        // Opening the profile asks for the insets again; deliver them as the phone would.
        activity.applySystemBars(24, bottomDp)
        val editor = activity.profileEditor!!
        val d = activity.resources.displayMetrics.density
        val screen = activity.window.decorView.height
        val texts = editor.root.allViews().filterIsInstance<TextView>().filter { it.isShown }
        for (label in AvatarFrame.entries.map { it.label }) {
            val tile = texts.single { it.text.toString() == label }
            assertTrue("“$label” on at most two lines (${tile.lineCount})", tile.lineCount in 1..2)
            val widest = (0 until tile.lineCount).maxOf { tile.layout.getLineWidth(it) }
            assertTrue("“$label” fits its tile", widest <= tile.width - tile.compoundPaddingLeft - tile.compoundPaddingRight + 1)
        }
        for (button in listOf("Replace photo", "Remove photo", "Cancel", "Apply", "Reset to Default", "Save")) {
            val view = texts.single { it.text.toString() == button }
            assertEquals("“$button” on one line", 1, view.lineCount)
            assertTrue("“$button” not cut off", view.layout.getLineWidth(0) <= view.width - view.compoundPaddingLeft - view.compoundPaddingRight + 1)
        }
        // The bottom of the profile screen scrolls clear of the system navigation bar.
        val scroll = editor.root.allViews().filterIsInstance<ScrollView>().single()
        scroll.scrollTo(0, Int.MAX_VALUE / 2)
        idle(16)
        val column = scroll.getChildAt(0) as android.view.ViewGroup
        val panel = (0 until column.childCount).map { column.getChildAt(it) }.last { it.visibility == android.view.View.VISIBLE } as android.view.ViewGroup
        val last = (0 until panel.childCount).map { panel.getChildAt(it) }.last { it.visibility == android.view.View.VISIBLE }
        assertTrue("last line (${last.windowRect()}) above the system bar", last.windowRect().bottom <= screen - (bottomDp * d).toInt())
    }

    @Test
    fun profileScreenFitsAnOrdinaryPhone() {
        val activity = Robolectric.buildActivity(MainActivity::class.java).setup().get()
        idle(100)
        checkProfileScreen(activity, bottomDp = 16)
        val photoButtons = activity.root().allViews().filterIsInstance<com.imran.examcountdown.ui.widgets.ButtonRow>().single()
        assertFalse("photo buttons side by side", photoButtons.stacked)
    }

    @Test
    @Config(qualifiers = "w320dp-h568dp-hdpi")
    fun profileScreenFitsASmallPhoneWithLargeText() {
        RuntimeEnvironment.setFontScale(1.6f)
        val activity = Robolectric.buildActivity(MainActivity::class.java).setup().get()
        idle(100)
        checkProfileScreen(activity, bottomDp = 48)
    }

    @Test
    @Config(qualifiers = "+night")
    fun profileScreenInDarkMode() {
        val activity = Robolectric.buildActivity(MainActivity::class.java).setup().get()
        idle(100)
        checkProfileScreen(activity, bottomDp = 48)
    }

    @Test
    @Config(qualifiers = "w780dp-h360dp-xxhdpi")
    fun landscape() {
        val activity = Robolectric.buildActivity(MainActivity::class.java).setup().get()
        idle(100)
        checkNoOverlap(activity, topDp = 0, bottomDp = 16)
    }
}

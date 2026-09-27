package com.imran.examcountdown

import android.content.Context
import com.imran.examcountdown.core.CheckItem
import com.imran.examcountdown.core.Choices
import com.imran.examcountdown.core.Elective
import com.imran.examcountdown.core.FocusMode
import com.imran.examcountdown.core.FocusState
import com.imran.examcountdown.core.MilLanguage
import com.imran.examcountdown.core.MotionPref
import com.imran.examcountdown.core.Subject
import com.imran.examcountdown.core.ThemeMode
import com.imran.examcountdown.core.Timetable
import com.imran.examcountdown.data.Store
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config
import java.time.LocalDate

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35])
class StoreTest {

    private val context: Context get() = RuntimeEnvironment.getApplication()

    @Test
    fun everythingRoundTrips() {
        val store = Store(context)
        store.setupDone = true
        store.choices = Choices(MilLanguage.HINDI, Elective.ARABIC)
        store.profile = store.profile.copy(name = "Imran H", hall = "24A")
        val edited = Timetable.DEFAULT.map { if (it.subject == Subject.ENGLISH_2) it.copy(date = LocalDate.of(2026, 10, 9), durationMinutes = 90) else it }
        store.exams = edited
        store.markedDone = setOf("MIL@1")
        store.focus = FocusState(mode = FocusMode.BREAK, running = true, endWall = 5, endElapsed = 6, boot = 2, remaining = 7, sessionsToday = 3, sessionsDay = 9)
        store.saveChecklist("MIL:HINDI", listOf(CheckItem(1, "Read chapter 1", true), CheckItem(2, "Practise letters")))
        store.theme = ThemeMode.DARK
        store.motion = MotionPref.REDUCED
        store.introEnabled = false
        store.haptics = false

        // A fresh Store reads the same file, as after an app restart.
        val again = Store(context)
        assertTrue(again.setupDone)
        assertEquals(Choices(MilLanguage.HINDI, Elective.ARABIC), again.choices)
        assertEquals("Imran H", again.profile.name)
        assertEquals("24A", again.profile.hall)
        assertEquals(edited, again.exams)
        assertEquals(setOf("MIL@1"), again.markedDone)
        assertEquals(FocusState(mode = FocusMode.BREAK, running = true, endWall = 5, endElapsed = 6, boot = 2, remaining = 7, sessionsToday = 3, sessionsDay = 9), again.focus)
        assertEquals(listOf(CheckItem(1, "Read chapter 1", true), CheckItem(2, "Practise letters")), again.checklist("MIL:HINDI", emptyList()))
        assertEquals(ThemeMode.DARK, again.theme)
        assertEquals(MotionPref.REDUCED, again.motion)
        assertFalse(again.introEnabled)
        assertFalse(again.haptics)
    }

    @Test
    fun dataSavedByVersionOneStillLoads() {
        // Keys exactly as written by v1.0.0, before the redesign existed.
        context.getSharedPreferences("imran_exam_countdown", Context.MODE_PRIVATE).edit()
            .putBoolean("setup_done", true)
            .putString("choice_mil", "BENGALI")
            .putString("choice_elective", "COMPUTER_SCIENCE")
            .putString("checklist_v1:MIL:BENGALI", """[{"id":1,"text":"Read through every lesson and poem","done":true}]""")
            .putBoolean("reminders_on", true)
            .putString("motion", "SYSTEM")
            .commit()
        val store = Store(context)
        assertTrue(store.setupDone)
        assertEquals(Choices(MilLanguage.BENGALI, Elective.COMPUTER_SCIENCE), store.choices)
        assertEquals(listOf(CheckItem(1, "Read through every lesson and poem", true)), store.checklist("MIL:BENGALI", emptyList()))
        assertTrue(store.reminders.enabled)
        assertEquals(Timetable.DEFAULT, store.exams)
        // New settings get sensible defaults.
        assertEquals(ThemeMode.SYSTEM, store.theme)
        assertTrue(store.introEnabled)
        assertTrue(store.haptics)
        assertEquals(0L, store.avatarVersion)
    }

    @Test
    fun damagedDataFallsBackSafely() {
        assertEquals(Timetable.DEFAULT, Store.decodeExams("not json"))
        assertEquals(Timetable.DEFAULT, Store.decodeExams("""[{"subject":"MIL","date":"bad","start":"12:30"}]"""))
        assertEquals(FocusState(), Store.decodeFocus("{"))
        assertTrue(Store.decodeItems("[oops").isEmpty())
    }
}

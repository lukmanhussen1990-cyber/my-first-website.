package com.imran.examcountdown

import android.app.Activity
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import com.imran.examcountdown.core.MotionPref
import com.imran.examcountdown.data.AppClock
import com.imran.examcountdown.data.Avatar
import com.imran.examcountdown.data.Store
import com.imran.examcountdown.ui.screens.HomeScreen
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

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35])
class AvatarTest {

    @Before
    fun setUp() {
        AppClock.pinnedWall = ist(2026, 9, 27, 18, 0)
        ExamCountdownApp.introHandled = true
        Store(RuntimeEnvironment.getApplication()).apply {
            setupDone = true
            motion = MotionPref.REDUCED
        }
    }

    @After
    fun tearDown() {
        AppClock.pinnedWall = null
    }

    private fun photo(): Bitmap = Bitmap.createBitmap(800, 600, Bitmap.Config.ARGB_8888).apply {
        val c = Canvas(this)
        c.drawColor(Color.rgb(40, 110, 70))
        c.drawCircle(400f, 300f, 200f, Paint().apply { color = Color.rgb(240, 200, 60) })
    }

    private fun launch(): MainActivity = Robolectric.buildActivity(MainActivity::class.java).setup().get().also { idle(100) }

    private fun MainActivity.homeAvatarHasPhoto(): Boolean = (currentScreen as HomeScreen).avatar.hasPhoto

    @Test
    fun choosingAPhotoPersistsAfterRestart() {
        val activity = launch()
        assertFalse("initials by default", activity.homeAvatarHasPhoto())
        (activity.currentScreen as HomeScreen).avatar.performClick()
        idle(100)
        assertTrue(activity.hasText("Choose photo"))
        val editor = activity.profileEditor
        assertNotNull(editor)
        editor!!
        editor.onPhotoPicked(photo())
        idle(50)
        assertTrue("crop step shown", activity.hasText("Move and zoom"))
        activity.click("Use photo")
        activity.click("Save")
        idle(300)
        val store = Store(RuntimeEnvironment.getApplication())
        assertTrue(store.avatarVersion != 0L)
        assertTrue(Avatar.file(RuntimeEnvironment.getApplication()).exists())
        assertTrue(activity.homeAvatarHasPhoto())

        // A brand-new activity (as after restarting the app) loads the saved photo.
        val restarted = launch()
        assertTrue(restarted.homeAvatarHasPhoto())
        val saved = Avatar.load(RuntimeEnvironment.getApplication(), 512)!!
        assertEquals("saved as a square", saved.width, saved.height)
    }

    @Test
    fun removingThePhotoGoesBackToInitials() {
        val activity = launch()
        (activity.currentScreen as HomeScreen).avatar.performClick()
        idle(100)
        activity.profileEditor!!.onPhotoPicked(photo())
        activity.click("Use photo")
        activity.click("Save")
        idle(300)
        (activity.currentScreen as HomeScreen).avatar.performClick()
        idle(100)
        activity.click("Remove photo")
        activity.click("Save")
        idle(300)
        assertEquals(0L, Store(RuntimeEnvironment.getApplication()).avatarVersion)
        assertFalse(launch().homeAvatarHasPhoto())
    }

    @Test
    fun cancelledPickChangesNothing() {
        val activity = launch()
        (activity.currentScreen as HomeScreen).avatar.performClick()
        idle(100)
        activity.click("Choose photo")
        val shadow = org.robolectric.Shadows.shadowOf(activity)
        val started = shadow.nextStartedActivityForResult
        assertEquals("Android's photo picker, no storage permission", android.provider.MediaStore.ACTION_PICK_IMAGES, started.intent.action)
        shadow.receiveResult(started.intent, Activity.RESULT_CANCELED, null)
        idle(50)
        assertTrue(activity.hasText("No photo chosen. Your current picture is unchanged."))
        assertEquals(0L, Store(RuntimeEnvironment.getApplication()).avatarVersion)
    }

    @Test
    fun displayNameIsEditable() {
        val activity = launch()
        (activity.currentScreen as HomeScreen).avatar.performClick()
        idle(100)
        val field = activity.root().allViews().filterIsInstance<android.widget.EditText>().single()
        field.setText("Imran Hussain Laskar")
        activity.click("Save")
        idle(300)
        assertEquals("Imran Hussain Laskar", Store(RuntimeEnvironment.getApplication()).profile.name)
        assertTrue(activity.hasText("Hey, Imran"))
    }
}

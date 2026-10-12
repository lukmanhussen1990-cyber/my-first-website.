package com.weplay.guesserai.overlay

import android.content.Context
import android.os.SystemClock
import android.view.MotionEvent
import android.view.View
import android.view.WindowManager
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.size
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.test.core.app.ApplicationProvider
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode
import org.robolectric.shadow.api.Shadow
import org.robolectric.shadows.ShadowLooper
import org.robolectric.shadows.ShadowWindowManagerImpl
import java.util.concurrent.TimeUnit

/** The real floating window in Robolectric's window manager: drag moves it, a tap reaches the button. */
@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = [34], qualifiers = "w393dp-h852dp-xxhdpi")
class OverlayWindowTest {
    private val ctx: Context = ApplicationProvider.getApplicationContext()
    private val wm = ctx.getSystemService(WindowManager::class.java)
    private val window = OverlayWindow(ctx)
    private var taps = 0

    @After fun tearDown() = window.hide()

    private fun root(): View = Shadow.extract<ShadowWindowManagerImpl>(wm).views.single()
    private fun params() = root().layoutParams as WindowManager.LayoutParams

    private fun idle() {
        repeat(5) { ShadowLooper.idleMainLooper(); ShadowLooper.idleMainLooper(400, TimeUnit.MILLISECONDS) }
    }

    private fun touch(action: Int, x: Float, y: Float, down: Long) =
        root().dispatchTouchEvent(MotionEvent.obtain(down, SystemClock.uptimeMillis(), action, x, y, 0).apply { setLocation(x - params().x, y - params().y) })

    private fun show(keepOff: Boolean = false) {
        window.keepOffDrawing = keepOff
        window.show { Box(Modifier.size(120.dp, 40.dp).clickable { taps++ }) }
        idle()
        assertTrue("window laid out", root().width > 0)
    }

    @Test fun `dragging moves the window with the finger`() {
        show()
        val (x0, y0) = params().x to params().y
        val down = SystemClock.uptimeMillis()
        val sx = x0 + 20f
        val sy = y0 + 20f
        touch(MotionEvent.ACTION_DOWN, sx, sy, down)
        touch(MotionEvent.ACTION_MOVE, sx - 60f, sy + 30f, down)
        touch(MotionEvent.ACTION_MOVE, sx - 200f, sy + 300f, down)
        assertEquals(x0 - 200, params().x)
        assertEquals(y0 + 300, params().y)
        touch(MotionEvent.ACTION_UP, sx - 200f, sy + 300f, down)
        idle()
        assertEquals("a drag is not a tap", 0, taps)
        assertEquals(x0 - 200, params().x)
    }

    @Test fun `a tap reaches the button and leaves the window where it is`() {
        show()
        val (x0, y0) = params().x to params().y
        val down = SystemClock.uptimeMillis()
        touch(MotionEvent.ACTION_DOWN, x0 + 30f, y0 + 20f, down)
        touch(MotionEvent.ACTION_UP, x0 + 30f, y0 + 20f, down)
        idle()
        assertEquals(1, taps)
        assertEquals(x0 to y0, params().x to params().y)
    }

    @Test fun `with keep-off-drawing it starts below the drawing and moves off it when dropped on it`() {
        val band = 300 to 1_400 // hint top .. canvas bottom, in screen pixels
        window.avoidBand = { band }
        show(keepOff = true)
        fun overlapsBand() = params().y < band.second && params().y + root().height > band.first
        assertTrue("starts off the drawing at y=${params().y}", !overlapsBand())
        val (x0, y0) = params().x to params().y
        val down = SystemClock.uptimeMillis()
        touch(MotionEvent.ACTION_DOWN, x0 + 10f, y0 + 10f, down)
        touch(MotionEvent.ACTION_MOVE, x0 + 10f, y0 - 100f, down)
        touch(MotionEvent.ACTION_MOVE, x0 + 10f, 800f, down) // onto the middle of the canvas
        assertTrue("follows the finger onto the drawing", overlapsBand())
        touch(MotionEvent.ACTION_UP, x0 + 10f, 800f, down)
        idle()
        assertTrue("moved off the drawing: y=${params().y} h=${root().height}", !overlapsBand())
    }

    @Test fun `a window dropped past the edge glides back on screen`() {
        show()
        val (x0, y0) = params().x to params().y
        val down = SystemClock.uptimeMillis()
        touch(MotionEvent.ACTION_DOWN, x0 + 10f, y0 + 10f, down)
        touch(MotionEvent.ACTION_MOVE, x0 + 400f, y0 + 10f, down)
        touch(MotionEvent.ACTION_MOVE, x0 + 2_000f, y0 + 10f, down)
        touch(MotionEvent.ACTION_UP, x0 + 2_000f, y0 + 10f, down)
        idle()
        val screenW = wm.currentWindowMetrics.bounds.width()
        assertTrue("x=${params().x} w=${root().width} screen=$screenW", params().x + root().width <= screenW)
    }
}

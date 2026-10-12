package com.weplay.guesserai.overlay

import android.animation.ValueAnimator
import android.annotation.SuppressLint
import android.content.Context
import android.graphics.PixelFormat
import android.graphics.Rect
import android.os.Build
import android.util.DisplayMetrics
import android.view.Gravity
import android.view.MotionEvent
import android.view.View
import android.view.ViewConfiguration
import android.view.WindowManager
import android.view.animation.DecelerateInterpolator
import android.view.animation.OvershootInterpolator
import android.widget.FrameLayout
import androidx.compose.runtime.Composable
import androidx.compose.ui.platform.ComposeView
import androidx.compose.ui.platform.ViewCompositionStrategy
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleOwner
import androidx.lifecycle.LifecycleRegistry
import androidx.lifecycle.setViewTreeLifecycleOwner
import androidx.savedstate.SavedStateRegistry
import androidx.savedstate.SavedStateRegistryController
import androidx.savedstate.SavedStateRegistryOwner
import androidx.savedstate.setViewTreeSavedStateRegistryOwner
import com.weplay.guesserai.domain.OverlayPlacement
import kotlin.math.abs
import kotlin.math.roundToInt

/**
 * A floating, draggable window drawn over other apps (TYPE_APPLICATION_OVERLAY).
 *
 * Dragging is handled on the View level with raw screen coordinates: a touch that moves past
 * the touch slop is intercepted and moves the whole window, while taps fall through to the
 * Compose buttons inside. On release the window glides back inside the screen and, with
 * [keepOffDrawing], off the canvas; when minimised it snaps to the nearest edge like a chat head.
 */
class OverlayWindow(
    private val context: Context,
    /** Reads the window's position on screen (tests stand in for the phone's status bar here). */
    private val locate: (View, IntArray) -> Unit = { v, out -> v.getLocationOnScreen(out) },
) : LifecycleOwner, SavedStateRegistryOwner {

    private val wm = context.getSystemService(WindowManager::class.java)
    private val lifecycleRegistry = LifecycleRegistry(this)
    private val savedStateController = SavedStateRegistryController.create(this)
    override val lifecycle: Lifecycle get() = lifecycleRegistry
    override val savedStateRegistry: SavedStateRegistry get() = savedStateController.savedStateRegistry

    private val params = WindowManager.LayoutParams(
        WindowManager.LayoutParams.WRAP_CONTENT,
        WindowManager.LayoutParams.WRAP_CONTENT,
        WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY,
        // Not focusable: the game keeps the keyboard and touches outside the panel.
        WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS,
        PixelFormat.TRANSLUCENT,
    ).apply {
        gravity = Gravity.TOP or Gravity.START
        windowAnimations = android.R.style.Animation_Toast
    }

    private val root = DragFrame(context)
    private var attached = false

    /**
     * Where the window's (0, 0) is on screen. Android lays overlay windows out inside the system
     * bars: while the status bar shows (it does in WePlay), y = 0 is just below it, but the
     * captures, the canvas band and the screen size count from the top of the screen. Measured
     * after every layout; positions are worked out in screen pixels and converted with it.
     */
    private var originX = 0
    private var originY = 0
    private val onScreen = IntArray(2)
    private var animator: ValueAnimator? = null
    private val margin get() = (8 * context.resources.displayMetrics.density).roundToInt()

    /** The panel has been put below the canvas once, or the user moved it; either way it is not placed again. */
    private var placed = false
    private var canvasChecks = 0

    /**
     * Vertical band the window must not cover, in screen pixels (top, bottom): the hint and the
     * canvas the AI reads. Null if unknown.
     */
    var avoidBand: (() -> Pair<Int, Int>?)? = null

    /**
     * When true, the panel starts just below [avoidBand] and is moved off it after a drag, a resize
     * or [settle], so it does not hide the drawing. Turning it on moves the panel right away.
     */
    var keepOffDrawing: Boolean = true
        set(value) {
            val turnedOn = value && !field
            field = value
            if (turnedOn) settle()
        }

    private val settleNow = Runnable { animateInside(bounce = false) }

    /**
     * Starts the panel on the right, just below the canvas. The canvas may only be measured after
     * the first frames are captured, so this looks again for a few seconds before giving up.
     */
    private val placeBelowCanvas = object : Runnable {
        override fun run() {
            if (!attached || placed || !keepOffDrawing) return
            val band = avoidBand?.invoke()
            if (band == null || root.width == 0) {
                if (++canvasChecks < CANVAS_CHECKS) root.postDelayed(this, CANVAS_CHECK_MS)
                return
            }
            placed = true
            val (sw, _) = screenSize()
            val (x, y) = restingPlace(sw - root.width - margin, band.second + margin) // screen pixels
            // Right after show() the window is still fading in, so jump there; once it has been seen, glide.
            if (canvasChecks == 0) {
                animator?.cancel()
                moveTo(x, y)
            } else glide(params.x, params.y, x, y, bounce = false)
        }
    }

    init {
        savedStateController.performRestore(null)
        lifecycleRegistry.currentState = Lifecycle.State.CREATED
        // A panel that grows (hint editor, "+N more", answer banner) must not run off screen or onto the canvas.
        root.addOnLayoutChangeListener { _, l, t, r, b, oldL, oldT, oldR, oldB ->
            if (r - l != oldR - oldL || b - t != oldB - oldT) settle()
        }
        // Right after the window was laid out where params say, so the two agree.
        root.viewTreeObserver.addOnPreDrawListener {
            locate(root, onScreen)
            originX = onScreen[0] - params.x
            originY = onScreen[1] - params.y
            true
        }
    }

    fun show(content: @Composable () -> Unit) {
        if (attached) return
        val compose = ComposeView(context).apply {
            setViewCompositionStrategy(ViewCompositionStrategy.DisposeOnDetachedFromWindow)
            setContent(content)
        }
        root.setViewTreeLifecycleOwner(this)
        root.setViewTreeSavedStateRegistryOwner(this)
        root.addView(compose)

        val (sw, sh) = screenSize()
        params.x = (sw * 0.60f).roundToInt()
        params.y = (sh * 0.16f).roundToInt()
        wm.addView(root, params)
        attached = true
        lifecycleRegistry.currentState = Lifecycle.State.RESUMED
        // Runs after the first layout pass, when the panel's width is known.
        root.post(placeBelowCanvas)
    }

    fun hide() {
        if (!attached) return
        animator?.cancel()
        root.removeCallbacks(placeBelowCanvas)
        root.removeCallbacks(settleNow)
        lifecycleRegistry.currentState = Lifecycle.State.DESTROYED
        runCatching { wm.removeViewImmediate(root) }
        attached = false
    }

    /** Window bounds in screen pixels (used to mask the overlay out of screenshots). */
    fun bounds(): Rect? {
        if (!attached || root.width == 0) return null
        val left = params.x + originX
        val top = params.y + originY
        return Rect(left, top, left + root.width, top + root.height)
    }

    /**
     * Keep the panel fully on screen (and off the canvas, with [keepOffDrawing]) after its size or
     * the screen changes. Calls within one frame are merged into one.
     */
    fun settle() {
        root.removeCallbacks(settleNow)
        root.post(settleNow)
    }

    fun screenSize(): Pair<Int, Int> {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            val b = wm.currentWindowMetrics.bounds
            return b.width() to b.height()
        }
        val m = DisplayMetrics()
        @Suppress("DEPRECATION")
        wm.defaultDisplay.getRealMetrics(m)
        return m.widthPixels to m.heightPixels
    }

    private fun moveTo(x: Int, y: Int) {
        params.x = x
        params.y = y
        if (attached) runCatching { wm.updateViewLayout(root, params) }
    }

    /**
     * Where a window dropped at ([x], [y]) (screen pixels) should rest, as window params: on
     * screen below the status bar, and below or above the canvas with [keepOffDrawing].
     */
    private fun restingPlace(x: Int = params.x + originX, y: Int = params.y + originY): Pair<Int, Int> {
        val (sw, sh) = screenSize()
        val w = root.width
        val h = root.height
        val minX = originX.coerceAtLeast(0) + margin
        val minY = originY.coerceAtLeast(0) + margin
        val maxX = (sw - w - margin).coerceAtLeast(minX)
        val maxY = (sh - h - margin).coerceAtLeast(minY)
        val insideY = y.coerceIn(minY, maxY)
        val band = if (keepOffDrawing) avoidBand?.invoke() else null
        val restY = if (band == null) insideY
        else OverlayPlacement.yOutside(insideY, h, band.first, band.second, sh, margin, minY)
        return x.coerceIn(minX, maxX) - originX to restY - originY
    }

    private fun animateInside(bounce: Boolean) {
        // Never pull the window out from under the user's finger.
        if (!attached || root.width == 0 || root.dragging) return
        val (targetX, targetY) = restingPlace()
        if (targetX == params.x && targetY == params.y) return
        glide(params.x, params.y, targetX, targetY, bounce)
    }

    private fun glide(startX: Int, startY: Int, targetX: Int, targetY: Int, bounce: Boolean) {
        animator?.cancel()
        animator = ValueAnimator.ofFloat(0f, 1f).apply {
            duration = 280
            interpolator = if (bounce) OvershootInterpolator(0.8f) else DecelerateInterpolator()
            addUpdateListener {
                val f = it.animatedValue as Float
                moveTo((startX + (targetX - startX) * f).roundToInt(), (startY + (targetY - startY) * f).roundToInt())
            }
            start()
        }
    }

    @SuppressLint("ViewConstructor", "ClickableViewAccessibility")
    private inner class DragFrame(context: Context) : FrameLayout(context) {
        private val slop = ViewConfiguration.get(context).scaledTouchSlop
        private var downRawX = 0f
        private var downRawY = 0f
        private var startX = 0
        private var startY = 0

        /** A finger is moving the window (rather than tapping a button inside it). */
        var dragging = false
            private set

        override fun dispatchTouchEvent(ev: MotionEvent): Boolean {
            if (ev.actionMasked == MotionEvent.ACTION_DOWN) {
                // Catch the window mid-glide; it settles again when the finger lifts.
                animator?.cancel()
                downRawX = ev.rawX; downRawY = ev.rawY
                startX = params.x; startY = params.y
                dragging = false
            }
            val handled = super.dispatchTouchEvent(ev)
            if (ev.actionMasked == MotionEvent.ACTION_UP || ev.actionMasked == MotionEvent.ACTION_CANCEL) {
                val dropped = dragging
                dragging = false
                // Also after a tap: a glide it interrupted must still finish.
                animateInside(bounce = dropped)
            }
            return handled
        }

        override fun onInterceptTouchEvent(ev: MotionEvent): Boolean {
            if (ev.actionMasked == MotionEvent.ACTION_MOVE && !dragging &&
                (abs(ev.rawX - downRawX) > slop || abs(ev.rawY - downRawY) > slop)
            ) startDrag()
            return dragging
        }

        override fun onTouchEvent(ev: MotionEvent): Boolean {
            if (ev.actionMasked == MotionEvent.ACTION_MOVE) {
                if (!dragging) startDrag()
                moveTo(startX + (ev.rawX - downRawX).roundToInt(), startY + (ev.rawY - downRawY).roundToInt())
            }
            return true
        }

        private fun startDrag() {
            dragging = true
            // The user chose a spot; do not move the panel below the canvas on its own any more.
            placed = true
        }
    }

    private companion object {
        const val CANVAS_CHECKS = 12
        const val CANVAS_CHECK_MS = 500L
    }
}

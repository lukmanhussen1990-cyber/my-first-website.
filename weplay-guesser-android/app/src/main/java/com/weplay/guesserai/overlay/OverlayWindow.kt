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
import kotlin.math.abs
import kotlin.math.roundToInt

/**
 * A floating, draggable window drawn over other apps (TYPE_APPLICATION_OVERLAY).
 *
 * Dragging is handled on the View level with raw screen coordinates: a touch that moves past
 * the touch slop is intercepted and moves the whole window, while taps fall through to the
 * Compose buttons inside. On release the window glides back inside the screen; when minimised
 * it snaps to the nearest edge like a chat head.
 */
class OverlayWindow(private val context: Context) : LifecycleOwner, SavedStateRegistryOwner {

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
    private var animator: ValueAnimator? = null

    /** Edge-snapping is only used for the minimised bubble. */
    var snapToEdge = false

    /** Vertical band of the drawing canvas in screen pixels (top, bottom), or null if unknown. */
    var avoidBand: (() -> Pair<Int, Int>?)? = null

    /** When true, the panel is moved off [avoidBand] after a drag so it does not hide the drawing. */
    var keepOffDrawing: Boolean = true

    init {
        savedStateController.performRestore(null)
        lifecycleRegistry.currentState = Lifecycle.State.CREATED
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
    }

    fun hide() {
        if (!attached) return
        animator?.cancel()
        lifecycleRegistry.currentState = Lifecycle.State.DESTROYED
        runCatching { wm.removeViewImmediate(root) }
        attached = false
    }

    /** Window bounds in screen pixels (used to mask the overlay out of screenshots). */
    fun bounds(): Rect? = if (!attached || root.width == 0) null
    else Rect(params.x, params.y, params.x + root.width, params.y + root.height)

    /** Keep the panel fully on screen after its size changes (e.g. expanding from the bubble). */
    fun settle() = root.post { animateInside(bounce = false) }

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

    private fun animateInside(bounce: Boolean) {
        if (!attached) return
        val (sw, sh) = screenSize()
        val margin = (8 * context.resources.displayMetrics.density).roundToInt()
        val maxX = (sw - root.width - margin).coerceAtLeast(margin)
        val maxY = (sh - root.height - margin).coerceAtLeast(margin)
        val targetX = if (snapToEdge) {
            if (params.x + root.width / 2 < sw / 2) 0 else sw - root.width
        } else params.x.coerceIn(margin, maxX)
        val targetY = params.y.coerceIn(margin, maxY)
        if (targetX == params.x && targetY == params.y) return

        val startX = params.x
        val startY = params.y
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
        private var dragging = false

        override fun onInterceptTouchEvent(ev: MotionEvent): Boolean {
            when (ev.actionMasked) {
                MotionEvent.ACTION_DOWN -> {
                    animator?.cancel()
                    downRawX = ev.rawX; downRawY = ev.rawY
                    startX = params.x; startY = params.y
                    dragging = false
                }
                MotionEvent.ACTION_MOVE -> {
                    if (!dragging && (abs(ev.rawX - downRawX) > slop || abs(ev.rawY - downRawY) > slop)) {
                        dragging = true
                    }
                }
            }
            return dragging
        }

        override fun onTouchEvent(ev: MotionEvent): Boolean {
            when (ev.actionMasked) {
                MotionEvent.ACTION_DOWN -> return true
                MotionEvent.ACTION_MOVE -> {
                    dragging = true
                    moveTo(startX + (ev.rawX - downRawX).roundToInt(), startY + (ev.rawY - downRawY).roundToInt())
                }
                MotionEvent.ACTION_UP, MotionEvent.ACTION_CANCEL -> {
                    if (dragging) animateInside(bounce = true)
                    dragging = false
                }
            }
            return true
        }
    }
}

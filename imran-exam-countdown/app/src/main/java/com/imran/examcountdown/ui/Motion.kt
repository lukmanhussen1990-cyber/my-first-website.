package com.imran.examcountdown.ui

import android.animation.ValueAnimator
import android.content.Context
import android.os.PowerManager
import android.view.Choreographer
import com.imran.examcountdown.core.MotionPref

/**
 * Decides how much animation to show. Reduced motion removes movement (particles, rolling
 * digits, confetti, entrance effects). Battery Saver pauses the ambient effects only.
 */
class MotionPolicy(
    /** Movement allowed at all. */
    val motion: Boolean,
    /** Continuous ambient effects (particles, glow breathing) allowed. */
    val ambient: Boolean,
) {
    companion object {
        fun resolve(context: Context, pref: MotionPref): MotionPolicy {
            val motion = when (pref) {
                MotionPref.REDUCED -> false
                MotionPref.FULL -> true
                // Off when the user turned on "Remove animations" (or set animator scale to 0).
                MotionPref.SYSTEM -> ValueAnimator.areAnimatorsEnabled()
            }
            val saver = context.getSystemService(PowerManager::class.java)?.isPowerSaveMode == true
            return MotionPolicy(motion = motion, ambient = motion && !saver)
        }
    }
}

/** Something drawn with a continuous, time-based animation. */
interface AmbientListener {
    /** [frameTimeMs] is a monotonic time in milliseconds; animate from it, not from frame counts. */
    fun onAmbientFrame(frameTimeMs: Long)
}

/**
 * One shared ~30 fps clock for ambient effects, aligned to the display's vsync. It only runs
 * while the screen is visible and ambient motion is allowed, which keeps battery use low.
 */
class AmbientTicker(private val fps: Int = 30) {
    private val listeners = LinkedHashSet<AmbientListener>()
    private var running = false
    private val choreographer: Choreographer = Choreographer.getInstance()
    private val frame = object : Choreographer.FrameCallback {
        override fun doFrame(frameTimeNanos: Long) {
            if (!running) return
            val ms = frameTimeNanos / 1_000_000
            for (l in listeners.toList()) l.onAmbientFrame(ms)
            choreographer.postFrameCallbackDelayed(this, (1000L / fps - 4).coerceAtLeast(0))
        }
    }

    val isRunning: Boolean get() = running

    fun add(listener: AmbientListener) {
        listeners += listener
    }

    fun remove(listener: AmbientListener) {
        listeners -= listener
    }

    fun start() {
        if (running) return
        running = true
        choreographer.postFrameCallback(frame)
    }

    fun stop() {
        running = false
        choreographer.removeFrameCallback(frame)
    }
}

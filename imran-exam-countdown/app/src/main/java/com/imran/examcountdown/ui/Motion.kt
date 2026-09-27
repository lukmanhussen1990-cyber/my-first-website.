package com.imran.examcountdown.ui

import android.animation.ValueAnimator
import android.content.Context
import android.os.Build
import android.os.PowerManager
import android.view.Choreographer
import android.view.HapticFeedbackConstants
import android.view.View
import com.imran.examcountdown.core.MotionPref

/**
 * How much animation to show. Reduced motion removes movement (intro, sliding digits,
 * entrances, confetti) but keeps every function. Battery Saver only pauses continuous effects.
 */
class MotionPolicy(
    /** Movement allowed at all. */
    val motion: Boolean,
    /** Continuous effects (smooth timer progress, gentle pulses) allowed. */
    val ambient: Boolean,
) {
    companion object {
        fun resolve(context: Context, pref: MotionPref): MotionPolicy {
            val motion = when (pref) {
                MotionPref.REDUCED -> false
                MotionPref.FULL -> true
                // Off when Android's "Remove animations" is on (animator scale 0).
                MotionPref.SYSTEM -> ValueAnimator.areAnimatorsEnabled()
            }
            val saver = context.getSystemService(PowerManager::class.java)?.isPowerSaveMode == true
            return MotionPolicy(motion = motion, ambient = motion && !saver)
        }
    }
}

/** Something drawn with a continuous, time-based animation. */
interface AmbientListener {
    /** [frameTimeMs] is monotonic; animate from it rather than from frame counts. */
    fun onAmbientFrame(frameTimeMs: Long)
}

/**
 * One shared ~30 fps clock for continuous effects, aligned to vsync. It only runs while the
 * app is in the foreground and motion is allowed.
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

/** Optional, subtle haptics. Also respects Android's own touch-feedback setting. */
object Haptics {
    @Volatile
    var enabled = true

    fun tap(view: View) {
        if (enabled) view.performHapticFeedback(HapticFeedbackConstants.CONTEXT_CLICK)
    }

    fun confirm(view: View) {
        if (!enabled) return
        val type = if (Build.VERSION.SDK_INT >= 30) HapticFeedbackConstants.CONFIRM else HapticFeedbackConstants.VIRTUAL_KEY
        view.performHapticFeedback(type)
    }
}

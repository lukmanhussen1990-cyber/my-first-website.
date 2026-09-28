package com.imran.examcountdown.ui

import android.animation.TimeInterpolator
import android.animation.ValueAnimator
import android.graphics.Color
import android.graphics.RenderEffect
import android.graphics.Shader
import android.os.Build
import android.view.View
import android.view.animation.PathInterpolator
import kotlin.math.cos
import kotlin.math.exp
import kotlin.math.sin
import kotlin.math.sqrt

/**
 * The app's motion vocabulary: easing curves, springs and a few drawing helpers, shared by every
 * animation so that they all feel like one system. Everything here is pure maths or a guarded
 * platform call, so it is safe on Android 8.0 and in tests.
 */
object Ease {
    /** Fast start, long soft landing (Material "emphasized decelerate"). For things arriving. */
    val out: TimeInterpolator = PathInterpolator(0.05f, 0.7f, 0.1f, 1f)

    /** Slow start, quick finish. For things leaving. */
    val exit: TimeInterpolator = PathInterpolator(0.3f, 0f, 0.8f, 0.15f)

    /** Smooth both ends, for moves between two resting places. */
    val inOut: TimeInterpolator = PathInterpolator(0.2f, 0f, 0f, 1f)

    fun cubicOut(x: Float): Float = 1f - (1f - x).let { it * it * it }
    fun cubicIn(x: Float): Float = x * x * x
    fun cubicInOut(x: Float): Float = if (x < 0.5f) 4f * x * x * x else 1f - ((-2f * x + 2f).let { it * it * it }) / 2f
    fun quintOut(x: Float): Float = 1f - (1f - x).let { it * it * it * it * it }
}

/**
 * A damped spring, as a fixed-length curve from 0 to 1: it overshoots and settles like a real
 * spring and lands exactly on 1 at the end. [damping] sets the character: 1 glides in with no
 * overshoot, 0.75 overshoots about 3 %, 0.55 about 12 % (a lively pop), 0.4 about 25 %.
 */
class Spring(private val damping: Float = 0.7f) : TimeInterpolator {
    override fun getInterpolation(input: Float): Float = spring(input, damping)

    companion object {
        /** Settles with a barely visible overshoot: panels, pages, indicators. */
        val gentle = Spring(0.78f)

        /** A lively pop: icons, knobs, badges. */
        val bouncy = Spring(0.5f)

        /** In between: cards and rising content. */
        val soft = Spring(0.66f)
    }
}

/** Position of a unit spring released at t = 0 (see [Spring]); pure, so views can scrub it. */
fun spring(t: Float, damping: Float): Float {
    if (t <= 0f) return 0f
    if (t >= 1f) return 1f
    val z = damping.coerceIn(0.05f, 1f)
    // Natural frequency chosen so the motion has died away (e^-7 ≈ 0.1 %) by t = 1.
    val w = 7f / z
    val decay = exp(-z * w * t)
    if (z >= 0.999f) return 1f - decay * (1f + w * t)
    val wd = w * sqrt(1f - z * z)
    return 1f - decay * (cos(wd * t) + (z * w / wd) * sin(wd * t))
}

/** 0..1 progress of [t] through the window [start, start + length], clamped. */
fun window(t: Float, start: Float, length: Float): Float = ((t - start) / length).coerceIn(0f, 1f)

fun lerp(a: Float, b: Float, t: Float): Float = a + (b - a) * t

/** Blends two colours (including alpha) in sRGB. */
fun lerpColor(a: Int, b: Int, t: Float): Int {
    val f = t.coerceIn(0f, 1f)
    return Color.argb(
        (Color.alpha(a) + (Color.alpha(b) - Color.alpha(a)) * f).toInt(),
        (Color.red(a) + (Color.red(b) - Color.red(a)) * f).toInt(),
        (Color.green(a) + (Color.green(b) - Color.green(a)) * f).toInt(),
        (Color.blue(a) + (Color.blue(b) - Color.blue(a)) * f).toInt(),
    )
}

/**
 * Fades the view to [to] on its own animator, so it can run alongside a spring on the view's
 * other properties (a spring would overshoot the alpha).
 */
fun View.fadeTo(to: Float, ms: Long, delayMs: Long = 0L): ValueAnimator {
    val view = this
    return ValueAnimator.ofFloat(view.alpha, to).apply {
        duration = ms
        startDelay = delayMs
        interpolator = Ease.out
        addUpdateListener { view.alpha = it.animatedValue as Float }
        start()
    }
}

/**
 * Gaussian blur as a view effect (Android 12+, drawn on the GPU). Used only for short depth
 * transitions; on older phones, or where the effect isn't available, it does nothing.
 */
object Blur {
    private val supported = Build.VERSION.SDK_INT >= 31

    fun set(view: View, radiusPx: Float) {
        if (!supported) return
        try {
            view.setRenderEffect(
                if (radiusPx < 0.5f) null else RenderEffect.createBlurEffect(radiusPx, radiusPx, Shader.TileMode.DECAL),
            )
        } catch (e: Throwable) {
            // No render effect on this device (or in a JVM test): the transition still plays without it.
        }
    }
}

package com.imran.examcountdown.ui.screens

import android.animation.Animator
import android.animation.AnimatorListenerAdapter
import android.animation.ValueAnimator
import android.content.Context
import android.view.View
import android.view.animation.LinearInterpolator
import com.imran.examcountdown.MainActivity
import com.imran.examcountdown.core.Season
import com.imran.examcountdown.ui.Ease
import com.imran.examcountdown.ui.spring
import com.imran.examcountdown.ui.window
import java.util.WeakHashMap

/** One tab of the app. Screens build their views in code and are refreshed by the host. */
abstract class Screen(val host: MainActivity) {
    val ctx: Context get() = host

    abstract val root: View

    /** Called each time the screen becomes visible. */
    open fun onShow(first: Boolean) {}

    open fun onHide() {}

    /** Called on every tick while visible, with a freshly computed season. */
    open fun tick(season: Season) {}

    /** Milliseconds until this screen next needs [tick]. */
    open fun nextTickDelay(now: Long): Long = 1000 - now % 1000

    /** Height of the status bar, so content starts below it. */
    open fun applyInsets(top: Int, bottom: Int) {}

    /** Saved data (profile, choices, timetable, settings) changed. */
    open fun onDataChanged() {}

    /** Reduced-motion or battery-saver state changed. */
    open fun onMotionChanged() {}
}

fun View.setVisible(visible: Boolean) {
    visibility = if (visible) View.VISIBLE else View.GONE
}

private val entrances = WeakHashMap<View, ValueAnimator>()

/**
 * A short staggered rise-in for a list of views (skipped entirely with reduced motion): each
 * block fades in as it rises 14 dp on a soft spring, 300 ms each, 40 ms apart.
 */
fun staggerIn(views: List<View>, motion: Boolean, startDelay: Long = 0L) {
    views.forEachIndexed { i, v ->
        v.animate().cancel()
        entrances.remove(v)?.cancel()
        if (!motion) {
            settle(v)
            return@forEachIndexed
        }
        val rise = v.resources.displayMetrics.density * 14
        v.alpha = 0f
        v.translationY = rise
        entrances[v] = ValueAnimator.ofFloat(0f, ENTRANCE_MS).apply {
            duration = ENTRANCE_MS.toLong()
            this.startDelay = startDelay + i * STAGGER_MS
            interpolator = LinearInterpolator()
            addUpdateListener {
                val ms = it.animatedValue as Float
                v.alpha = Ease.cubicOut(window(ms, 0f, 200f))
                v.translationY = rise * (1f - spring(ms / ENTRANCE_MS, 0.86f))
            }
            addListener(object : AnimatorListenerAdapter() {
                override fun onAnimationEnd(animation: Animator) {
                    settle(v)
                    entrances.remove(v)
                }
            })
            start()
        }
    }
}

private fun settle(v: View) {
    v.alpha = 1f
    v.translationY = 0f
    v.scaleX = 1f
    v.scaleY = 1f
}

private const val ENTRANCE_MS = 300f
private const val STAGGER_MS = 40L

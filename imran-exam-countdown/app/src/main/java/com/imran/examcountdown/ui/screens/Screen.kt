package com.imran.examcountdown.ui.screens

import android.content.Context
import android.view.View
import com.imran.examcountdown.MainActivity
import com.imran.examcountdown.core.Season

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

/** A short, staggered rise-in for a list of views (skipped entirely with reduced motion). */
fun staggerIn(views: List<View>, motion: Boolean, startDelay: Long = 0L) {
    views.forEachIndexed { i, v ->
        v.animate().cancel()
        if (!motion) {
            v.alpha = 1f
            v.translationY = 0f
            return@forEachIndexed
        }
        v.alpha = 0f
        v.translationY = v.resources.displayMetrics.density * 12
        v.animate().alpha(1f).translationY(0f)
            .setStartDelay(startDelay + i * 45L)
            .setDuration(260)
            .start()
    }
}

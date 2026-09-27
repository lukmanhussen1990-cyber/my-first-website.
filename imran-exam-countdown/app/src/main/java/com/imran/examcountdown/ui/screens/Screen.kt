package com.imran.examcountdown.ui.screens

import android.content.Context
import android.view.View
import android.view.ViewGroup
import android.widget.FrameLayout
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

    /** System bar sizes, so content can scroll behind them without being hidden. */
    open fun applyInsets(top: Int, bottom: Int) {}

    /** Saved data (profile, choices, timetable, settings) changed. */
    open fun onDataChanged() {}

    /** Reduced-motion or battery-saver state changed. */
    open fun onMotionChanged() {}
}

/** A frame that is always square, at most [maxSize] pixels wide. */
class SquareFrame(context: Context, private val maxSize: Int) : FrameLayout(context) {
    var onSize: ((Int) -> Unit)? = null
    private var lastSize = -1

    override fun onMeasure(widthMeasureSpec: Int, heightMeasureSpec: Int) {
        val available = MeasureSpec.getSize(widthMeasureSpec)
        val size = if (available == 0) maxSize else minOf(available, maxSize)
        if (size != lastSize) {
            lastSize = size
            onSize?.invoke(size)
        }
        val exact = MeasureSpec.makeMeasureSpec(size, MeasureSpec.EXACTLY)
        super.onMeasure(exact, exact)
    }
}

fun View.setVisible(visible: Boolean) {
    visibility = if (visible) View.VISIBLE else View.GONE
}

fun ViewGroup.removeAllAndAdd(vararg views: View) {
    removeAllViews()
    views.forEach { addView(it) }
}

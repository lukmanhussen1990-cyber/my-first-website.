package com.imran.examcountdown.ui.widgets

import android.content.Context
import android.view.Gravity
import android.view.View
import android.widget.LinearLayout
import android.widget.TextView
import com.imran.examcountdown.core.Countdown
import com.imran.examcountdown.ui.Fonts
import com.imran.examcountdown.ui.Ui
import com.imran.examcountdown.ui.WRAP
import com.imran.examcountdown.ui.dp
import com.imran.examcountdown.ui.label
import com.imran.examcountdown.ui.lp
import com.imran.examcountdown.ui.update

/**
 * A typeset countdown: large days, hours and minutes, smaller seconds, and a label under each.
 * The number size adapts to the available width, so it fits small phones and large text.
 */
class CountdownView(context: Context) : LinearLayout(context) {

    private class Unit(val number: RollingNumberView, val label: TextView, val column: LinearLayout)

    private val days = unit("Days")
    private val hours = unit("Hours")
    private val minutes = unit("Min")
    private val seconds = unit("Sec")
    private val all = listOf(days, hours, minutes, seconds)
    private var maxSizePx = context.dp(64).toFloat()
    private var lastWidth = -1
    private var showDays = true

    var animateChanges = true
        set(value) {
            field = value
            all.forEach { it.number.animateChanges = value }
        }

    init {
        orientation = HORIZONTAL
        gravity = Gravity.BOTTOM or Gravity.START
        all.forEachIndexed { i, u ->
            addView(u.column, lp(WRAP, WRAP) { if (i > 0) marginStart = dp(18) })
        }
        seconds.number.color = Ui.c.text2
        importantForAccessibility = IMPORTANT_FOR_ACCESSIBILITY_YES
    }

    private fun unit(name: String): Unit {
        val number = RollingNumberView(context).apply { color = Ui.c.text }
        val label = context.label(name, Ui.c.text3, 11f)
        val column = LinearLayout(context).apply {
            orientation = VERTICAL
            gravity = Gravity.START
            addView(number, lp(WRAP, WRAP))
            addView(label, lp(WRAP, WRAP) { topMargin = dp(2) })
        }
        return Unit(number, label, column)
    }

    fun set(cd: Countdown) {
        val wantDays = cd.days > 0
        if (wantDays != showDays) {
            showDays = wantDays
            days.column.visibility = if (wantDays) View.VISIBLE else View.GONE
            lastWidth = -1
            requestLayout()
        }
        val before = days.number.value.length
        days.number.minDigits = if (cd.days >= 100) 3 else if (cd.days >= 10) 2 else 1
        days.number.setValue(cd.days)
        if (days.number.value.length != before) {
            lastWidth = -1
            requestLayout()
        }
        days.label.update(if (cd.days == 1L) "Day" else "Days")
        hours.number.setValue(cd.hours.toLong())
        hours.label.update(if (cd.hours == 1) "Hour" else "Hours")
        minutes.number.setValue(cd.minutes.toLong())
        seconds.number.setValue(cd.seconds.toLong())
        contentDescription = cd.spoken()
    }

    override fun onMeasure(widthMeasureSpec: Int, heightMeasureSpec: Int) {
        val available = MeasureSpec.getSize(widthMeasureSpec)
        if (available > 0 && available != lastWidth) {
            lastWidth = available
            fitTo(available)
        }
        super.onMeasure(widthMeasureSpec, heightMeasureSpec)
    }

    /** Largest size (up to 64 dp) at which the whole row fits [width]. Tabular digits are ~0.55 em. */
    private fun fitTo(width: Int) {
        val dayDigits = if (showDays) days.number.value.length else 0
        val gaps = dp(18) * (if (showDays) 3 else 2)
        val em = 0.56f
        val secondsScale = 0.5f
        val units = em * (dayDigits + 4) + em * 2 * secondsScale
        val big = ((width - gaps) / units).coerceAtMost(maxSizePx).coerceAtLeast(dp(24).toFloat())
        val gap = big * 0.06f
        listOf(days, hours, minutes).forEach {
            it.number.textSizePx = big
            it.number.verticalGapPx = gap
        }
        seconds.number.textSizePx = big * secondsScale
        seconds.number.verticalGapPx = gap
    }
}

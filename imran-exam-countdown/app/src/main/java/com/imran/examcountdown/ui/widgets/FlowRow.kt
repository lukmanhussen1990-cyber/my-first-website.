package com.imran.examcountdown.ui.widgets

import android.content.Context
import android.view.ViewGroup
import com.imran.examcountdown.ui.dp

/** Lays children out left to right and wraps to a new line when they don't fit. */
class FlowRow(context: Context) : ViewGroup(context) {

    var horizontalGap = context.dp(16)
    var verticalGap = context.dp(6)

    override fun onMeasure(widthMeasureSpec: Int, heightMeasureSpec: Int) {
        val maxWidth = MeasureSpec.getSize(widthMeasureSpec) - paddingLeft - paddingRight
        var x = 0
        var y = 0
        var lineHeight = 0
        var widest = 0
        for (i in 0 until childCount) {
            val child = getChildAt(i)
            if (child.visibility == GONE) continue
            measureChild(child, MeasureSpec.makeMeasureSpec(maxWidth, MeasureSpec.AT_MOST), heightMeasureSpec)
            val w = child.measuredWidth
            if (x > 0 && x + w > maxWidth) {
                y += lineHeight + verticalGap
                x = 0
                lineHeight = 0
            }
            x += w + horizontalGap
            widest = maxOf(widest, x - horizontalGap)
            lineHeight = maxOf(lineHeight, child.measuredHeight)
        }
        val height = y + lineHeight + paddingTop + paddingBottom
        setMeasuredDimension(
            resolveSize(widest + paddingLeft + paddingRight, widthMeasureSpec),
            resolveSize(height, heightMeasureSpec),
        )
    }

    override fun onLayout(changed: Boolean, l: Int, t: Int, r: Int, b: Int) {
        val maxWidth = r - l - paddingLeft - paddingRight
        var x = 0
        var y = 0
        var lineHeight = 0
        for (i in 0 until childCount) {
            val child = getChildAt(i)
            if (child.visibility == GONE) continue
            val w = child.measuredWidth
            if (x > 0 && x + w > maxWidth) {
                y += lineHeight + verticalGap
                x = 0
                lineHeight = 0
            }
            child.layout(paddingLeft + x, paddingTop + y, paddingLeft + x + w, paddingTop + y + child.measuredHeight)
            x += w + horizontalGap
            lineHeight = maxOf(lineHeight, child.measuredHeight)
        }
    }
}

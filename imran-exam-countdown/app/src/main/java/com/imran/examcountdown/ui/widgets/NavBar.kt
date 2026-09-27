package com.imran.examcountdown.ui.widgets

import android.content.Context
import android.content.res.ColorStateList
import android.view.Gravity
import android.view.View
import android.view.animation.DecelerateInterpolator
import android.widget.FrameLayout
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.TextView
import com.imran.examcountdown.ui.Fonts
import com.imran.examcountdown.ui.MATCH
import com.imran.examcountdown.ui.Palette
import com.imran.examcountdown.ui.Shapes
import com.imran.examcountdown.ui.WRAP
import com.imran.examcountdown.ui.dp
import com.imran.examcountdown.ui.lp
import com.imran.examcountdown.ui.text

/** Floating bottom navigation with a gradient pill that slides to the selected tab. */
class NavBar(
    context: Context,
    labels: List<String>,
    iconRes: List<Int>,
    private val onSelect: (Int) -> Unit,
) : FrameLayout(context) {

    var selected = -1
        private set
    var animateChanges = true

    private val indicator = View(context).apply {
        background = Shapes.gradient(
            context, 22,
            intArrayOf(Palette.withAlpha(Palette.BLUE, 0.95f), Palette.withAlpha(Palette.VIOLET, 0.95f)),
            GradientDrawableOrientation.LEFT_RIGHT,
        )
        visibility = INVISIBLE
    }
    private val row = LinearLayout(context).apply { orientation = LinearLayout.HORIZONTAL }
    private val icons = ArrayList<ImageView>()
    private val texts = ArrayList<TextView>()

    init {
        background = Shapes.rounded(context, 30, 0xF20A1134.toInt(), Palette.STROKE_STRONG)
        setPadding(dp(6), dp(6), dp(6), dp(6))
        addView(indicator, LayoutParams(0, MATCH))
        labels.forEachIndexed { index, label ->
            val icon = ImageView(context).apply {
                setImageResource(iconRes[index])
                importantForAccessibility = IMPORTANT_FOR_ACCESSIBILITY_NO
            }
            val text = context.text(label, 11.5f, Palette.TEXT_3, Fonts.medium) { gravity = Gravity.CENTER }
            icons += icon
            texts += text
            val item = LinearLayout(context).apply {
                orientation = LinearLayout.VERTICAL
                gravity = Gravity.CENTER
                background = Shapes.ripple(context, null, 22)
                contentDescription = label
                addView(icon, lp(dp(22), dp(22)))
                addView(text, lp(WRAP, WRAP) { topMargin = dp(3) })
                setOnClickListener { onSelect(index) }
            }
            row.addView(item, LinearLayout.LayoutParams(0, MATCH, 1f))
        }
        addView(row, LayoutParams(MATCH, MATCH))
    }

    fun select(index: Int, animate: Boolean) {
        val changed = index != selected
        selected = index
        icons.forEachIndexed { i, v ->
            v.imageTintList = ColorStateList.valueOf(if (i == index) Palette.WHITE else Palette.TEXT_3)
        }
        texts.forEachIndexed { i, t ->
            t.setTextColor(if (i == index) Palette.WHITE else Palette.TEXT_3)
            t.typeface = if (i == index) Fonts.semibold else Fonts.medium
        }
        row.getChildAt(index)?.isSelected = true
        for (i in 0 until row.childCount) row.getChildAt(i).isSelected = i == index
        place(animate && changed && animateChanges && indicator.visibility == VISIBLE)
    }

    private fun place(animate: Boolean) {
        if (selected < 0 || row.width == 0) return
        val w = row.width / row.childCount
        if (indicator.layoutParams.width != w) indicator.layoutParams = LayoutParams(w, row.height)
        indicator.visibility = VISIBLE
        val x = (selected * w).toFloat()
        if (animate) {
            indicator.animate().translationX(x).setDuration(260).setInterpolator(DecelerateInterpolator(1.5f)).start()
        } else {
            indicator.translationX = x
        }
    }

    override fun onLayout(changed: Boolean, left: Int, top: Int, right: Int, bottom: Int) {
        super.onLayout(changed, left, top, right, bottom)
        if (changed) post { place(false) }
    }
}

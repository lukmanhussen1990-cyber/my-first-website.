package com.imran.examcountdown.ui.widgets

import android.content.Context
import android.content.res.ColorStateList
import android.util.TypedValue
import android.view.Gravity
import android.widget.FrameLayout
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.TextView
import com.imran.examcountdown.ui.Fonts
import com.imran.examcountdown.ui.Haptics
import com.imran.examcountdown.ui.MATCH
import com.imran.examcountdown.ui.Shapes
import com.imran.examcountdown.ui.Ui
import com.imran.examcountdown.ui.WRAP
import com.imran.examcountdown.ui.dp
import com.imran.examcountdown.ui.lp
import com.imran.examcountdown.ui.separator
import com.imran.examcountdown.ui.text

/**
 * Bottom navigation that sits below the content (it never overlaps it). Its bottom padding
 * covers the system navigation bar, whether that's gesture navigation or three buttons.
 */
class NavBar(
    context: Context,
    labels: List<String>,
    iconRes: List<Int>,
    private val onSelect: (Int) -> Unit,
) : LinearLayout(context) {

    var selected = -1
        private set
    var animateChanges = true

    private val pills = ArrayList<FrameLayout>()
    private val icons = ArrayList<ImageView>()
    private val texts = ArrayList<TextView>()
    private val items = ArrayList<LinearLayout>()
    private val row = LinearLayout(context)

    init {
        orientation = VERTICAL
        setBackgroundColor(Ui.c.surface)
        addView(context.separator())
        row.orientation = HORIZONTAL
        labels.forEachIndexed { index, label ->
            val icon = ImageView(context).apply {
                setImageResource(iconRes[index])
                importantForAccessibility = IMPORTANT_FOR_ACCESSIBILITY_NO
            }
            val pill = FrameLayout(context).apply {
                addView(icon, FrameLayout.LayoutParams(dp(24), dp(24), Gravity.CENTER))
            }
            val text = context.text(label, 12.5f, Ui.c.text2, Fonts.sansMedium) {
                gravity = Gravity.CENTER
                maxLines = 1
            }
            val item = LinearLayout(context).apply {
                orientation = VERTICAL
                gravity = Gravity.CENTER
                minimumHeight = dp(64)
                setPadding(0, dp(8), 0, dp(8))
                background = Shapes.ripple(context, null, 0)
                contentDescription = label
                addView(pill, lp(dp(60), dp(32)))
                addView(text, lp(MATCH, WRAP) { topMargin = dp(4) })
                setOnClickListener {
                    if (index != selected) Haptics.tap(it)
                    onSelect(index)
                }
            }
            pills += pill
            icons += icon
            texts += text
            items += item
            row.addView(item, LayoutParams(0, WRAP, 1f))
        }
        addView(row, lp())
    }

    /** Space for the system navigation bar below the items. */
    fun setBottomInset(px: Int) {
        if (row.paddingBottom != px) row.setPadding(0, 0, 0, px)
    }

    fun select(index: Int, animate: Boolean) {
        val previous = selected
        selected = index
        val c = Ui.c
        for (i in items.indices) {
            val on = i == index
            icons[i].imageTintList = ColorStateList.valueOf(if (on) c.greenText else c.text2)
            texts[i].setTextColor(if (on) c.greenText else c.text2)
            texts[i].typeface = if (on) Fonts.sansSemibold else Fonts.sansMedium
            items[i].isSelected = on
            pills[i].background = if (on) Shapes.rounded(context, 16, c.greenSoft) else null
        }
        if (animate && animateChanges && previous != index && index in pills.indices) {
            val pill = pills[index]
            pill.scaleX = 0.7f
            pill.alpha = 0.4f
            pill.animate().scaleX(1f).alpha(1f).setDuration(200).start()
        }
    }

    override fun onLayout(changed: Boolean, l: Int, t: Int, r: Int, b: Int) {
        super.onLayout(changed, l, t, r, b)
        if (changed) texts.forEach { fitWidth(it) }
    }

    /** Shrinks a label (down to 9 sp) instead of clipping it with very large system text. */
    private fun fitWidth(view: TextView) {
        val available = view.width - dp(4)
        if (available <= 0) return
        val paint = view.paint
        val base = TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_SP, 12.5f, resources.displayMetrics)
        paint.textSize = base
        val needed = paint.measureText(view.text.toString())
        val min = TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, 9f, resources.displayMetrics)
        val size = if (needed > available) (base * available / needed).coerceAtLeast(min) else base
        if (view.textSize != size) view.post { view.setTextSize(TypedValue.COMPLEX_UNIT_PX, size) }
    }
}

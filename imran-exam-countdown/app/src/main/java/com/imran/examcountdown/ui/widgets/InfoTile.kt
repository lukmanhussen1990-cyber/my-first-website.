package com.imran.examcountdown.ui.widgets

import android.content.Context
import android.view.Gravity
import android.widget.LinearLayout
import android.widget.TextView
import com.imran.examcountdown.ui.Fonts
import com.imran.examcountdown.ui.Palette
import com.imran.examcountdown.ui.Shapes
import com.imran.examcountdown.ui.WRAP
import com.imran.examcountdown.ui.icon
import com.imran.examcountdown.ui.lp
import com.imran.examcountdown.ui.text

/** A small tile with an icon, a value and a caption, e.g. "12:30 PM / India time". */
class InfoTile(context: Context, iconRes: Int, tint: Int) : LinearLayout(context) {
    val value: TextView
    val caption: TextView

    init {
        orientation = VERTICAL
        gravity = Gravity.CENTER_HORIZONTAL
        val pad = (12 * resources.displayMetrics.density).toInt()
        setPadding(pad / 2, pad, pad / 2, pad)
        background = Shapes.rounded(context, 18, 0x0FFFFFFF, Palette.STROKE)
        addView(context.icon(iconRes, tint, 18))
        value = context.text("", 15.5f, Palette.TEXT, Fonts.semibold) {
            gravity = Gravity.CENTER
            maxLines = 1
        }
        caption = context.text("", 11.5f, Palette.TEXT_3, Fonts.medium) {
            gravity = Gravity.CENTER
            maxLines = 2
        }
        addView(value, lp(WRAP, WRAP) { topMargin = (7 * resources.displayMetrics.density).toInt() })
        addView(caption, lp(WRAP, WRAP) { topMargin = (3 * resources.displayMetrics.density).toInt() })
    }

    fun bind(valueText: String, captionText: String) {
        if (value.text.toString() != valueText) value.text = valueText
        if (caption.text.toString() != captionText) caption.text = captionText
        contentDescription = "$valueText, $captionText"
    }
}

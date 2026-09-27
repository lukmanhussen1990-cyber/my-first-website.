package com.imran.examcountdown.ui.widgets

import android.animation.AnimatorSet
import android.animation.ObjectAnimator
import android.animation.StateListAnimator
import android.animation.ValueAnimator
import android.content.Context
import android.content.res.ColorStateList
import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.RectF
import android.view.Gravity
import android.view.View
import android.view.accessibility.AccessibilityNodeInfo
import android.view.animation.DecelerateInterpolator
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.Switch
import android.widget.TextView
import com.imran.examcountdown.ui.Fonts
import com.imran.examcountdown.ui.Haptics
import com.imran.examcountdown.ui.MATCH
import com.imran.examcountdown.ui.Shapes
import com.imran.examcountdown.ui.Ui
import com.imran.examcountdown.ui.WRAP
import com.imran.examcountdown.ui.dp
import com.imran.examcountdown.ui.dpf
import com.imran.examcountdown.ui.text

/** On/off switch that reads as a switch to screen readers. */
class ToggleView(context: Context) : View(context) {

    var isChecked = false
        private set

    var onChange: ((Boolean) -> Unit)? = null
    var animateChanges = true

    private var knob = 0f
    private var animator: ValueAnimator? = null
    private val rect = RectF()
    private val track = Paint(Paint.ANTI_ALIAS_FLAG)
    private val outline = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        style = Paint.Style.STROKE
        strokeWidth = dpf(1.5f)
    }
    private val knobPaint = Paint(Paint.ANTI_ALIAS_FLAG)

    init {
        isClickable = true
        isFocusable = true
    }

    fun setChecked(value: Boolean, animate: Boolean = false) {
        if (value == isChecked && animator == null) return
        isChecked = value
        animator?.cancel()
        val to = if (value) 1f else 0f
        if (animate && animateChanges && isAttachedToWindow) {
            animator = ValueAnimator.ofFloat(knob, to).apply {
                duration = 170
                interpolator = DecelerateInterpolator()
                addUpdateListener {
                    knob = it.animatedValue as Float
                    invalidate()
                }
                start()
            }
        } else {
            animator = null
            knob = to
            invalidate()
        }
    }

    override fun performClick(): Boolean {
        setChecked(!isChecked, animate = true)
        Haptics.tap(this)
        onChange?.invoke(isChecked)
        return super.performClick()
    }

    override fun onMeasure(widthMeasureSpec: Int, heightMeasureSpec: Int) {
        setMeasuredDimension(dp(50), dp(30))
    }

    override fun onDraw(canvas: Canvas) {
        val c = Ui.c
        val h = height.toFloat()
        val inset = outline.strokeWidth / 2
        rect.set(inset, inset, width - inset, h - inset)
        track.color = if (knob > 0.5f) c.green else c.surfaceAlt
        canvas.drawRoundRect(rect, h / 2, h / 2, track)
        if (knob < 1f) {
            outline.color = Ui.withAlpha(c.text3, 1f - knob)
            canvas.drawRoundRect(rect, h / 2, h / 2, outline)
        }
        val radius = dpf(8) + dpf(3) * knob
        val x = h / 2 + (width - h) * knob
        knobPaint.color = if (knob > 0.5f) c.onGreen else c.text3
        canvas.drawCircle(x, h / 2, radius, knobPaint)
    }

    override fun getAccessibilityClassName(): CharSequence = Switch::class.java.name

    override fun onInitializeAccessibilityNodeInfo(info: AccessibilityNodeInfo) {
        super.onInitializeAccessibilityNodeInfo(info)
        info.isCheckable = true
        info.isChecked = isChecked
    }
}

/** Options in a quiet track; the selected one sits on a raised ivory tile that slides. */
class SegmentedControl(context: Context, private val labels: List<String>) : FrameLayout(context) {

    var selected = -1
        private set

    var onSelect: ((Int) -> Unit)? = null
    var animateChanges = true

    private val indicator = View(context).apply {
        background = Shapes.rounded(context, 10, Ui.c.surface, Ui.c.separator)
        visibility = INVISIBLE
        elevation = 0f
    }
    private val row = LinearLayout(context).apply { orientation = LinearLayout.HORIZONTAL }
    private val options: List<TextView>

    init {
        background = Shapes.rounded(context, 12, Ui.c.surfaceAlt)
        setPadding(dp(3), dp(3), dp(3), dp(3))
        addView(indicator, LayoutParams(0, MATCH))
        options = labels.mapIndexed { index, label ->
            context.text(label, 14.5f, Ui.c.text2, Fonts.sansMedium) {
                gravity = Gravity.CENTER
                maxLines = 2
                setPadding(dp(6), dp(6), dp(6), dp(6))
                minHeight = dp(40)
                setOnClickListener {
                    Haptics.tap(it)
                    select(index, animate = true, notify = true)
                }
            }.also { row.addView(it, LinearLayout.LayoutParams(0, WRAP, 1f)) }
        }
        addView(row, LayoutParams(MATCH, WRAP))
    }

    fun select(index: Int, animate: Boolean = false, notify: Boolean = false) {
        val changed = index != selected
        selected = index
        options.forEachIndexed { i, tv ->
            tv.setTextColor(if (i == index) Ui.c.greenText else Ui.c.text2)
            tv.typeface = if (i == index) Fonts.sansSemibold else Fonts.sansMedium
            tv.isSelected = i == index
        }
        place(animate && animateChanges && changed && indicator.visibility == VISIBLE)
        if (notify && changed) onSelect?.invoke(index)
    }

    private fun place(animate: Boolean) {
        if (selected < 0 || row.width == 0) {
            if (selected < 0) indicator.visibility = INVISIBLE
            return
        }
        val w = row.width / labels.size
        if (indicator.layoutParams.width != w || indicator.layoutParams.height != row.height) {
            indicator.layoutParams = LayoutParams(w, row.height)
        }
        indicator.visibility = VISIBLE
        val x = (selected * w).toFloat()
        if (animate) {
            indicator.animate().translationX(x).setDuration(200).setInterpolator(DecelerateInterpolator()).start()
        } else {
            indicator.translationX = x
        }
    }

    override fun onLayout(changed: Boolean, left: Int, top: Int, right: Int, bottom: Int) {
        super.onLayout(changed, left, top, right, bottom)
        if (changed && selected >= 0) post { place(false) }
    }
}

enum class ButtonStyle { PRIMARY, SECONDARY, GHOST, DANGER }

/** A button with an optional leading icon and a gentle press effect. */
fun Context.pillButton(
    label: String,
    iconRes: Int? = null,
    style: ButtonStyle = ButtonStyle.PRIMARY,
    onClick: (View) -> Unit,
): TextView = text(label, 16f, Ui.c.onGreen, Fonts.sansSemibold) {
    val c = Ui.c
    gravity = Gravity.CENTER
    minHeight = dp(50)
    setPadding(dp(20), dp(8), dp(20), dp(8))
    val fill = when (style) {
        ButtonStyle.PRIMARY -> Shapes.rounded(context, 14, c.green)
        ButtonStyle.SECONDARY -> Shapes.rounded(context, 14, 0, Ui.withAlpha(c.greenText, 0.55f), 1.5f)
        ButtonStyle.GHOST -> null
        ButtonStyle.DANGER -> Shapes.rounded(context, 14, 0, Ui.withAlpha(c.danger, 0.55f), 1.5f)
    }
    setTextColor(
        when (style) {
            ButtonStyle.PRIMARY -> c.onGreen
            ButtonStyle.DANGER -> c.danger
            else -> c.greenText
        },
    )
    background = Shapes.ripple(context, fill, 14)
    if (iconRes != null) setLeadingIcon(iconRes)
    stateListAnimator = pressScale(this)
    setOnClickListener {
        Haptics.tap(it)
        onClick(it)
    }
}

fun TextView.setLeadingIcon(iconRes: Int, sizeDp: Int = 20) {
    val d = context.getDrawable(iconRes)?.mutate() ?: return
    d.setTintList(ColorStateList.valueOf(currentTextColor))
    d.setBounds(0, 0, dp(sizeDp), dp(sizeDp))
    setCompoundDrawablesRelative(d, null, null, null)
    compoundDrawablePadding = dp(8)
}

/** Scales a view down a touch while pressed. */
fun pressScale(view: View): StateListAnimator = StateListAnimator().apply {
    addState(
        intArrayOf(android.R.attr.state_pressed),
        AnimatorSet().apply {
            playTogether(ObjectAnimator.ofFloat(view, View.SCALE_X, 0.97f), ObjectAnimator.ofFloat(view, View.SCALE_Y, 0.97f))
            duration = 90
        },
    )
    addState(
        intArrayOf(),
        AnimatorSet().apply {
            playTogether(ObjectAnimator.ofFloat(view, View.SCALE_X, 1f), ObjectAnimator.ofFloat(view, View.SCALE_Y, 1f))
            duration = 150
        },
    )
}

/** A short status label, e.g. "Completed" or "Exam time". Filled only for the live state. */
fun Context.statusLabel(): TextView = text("", 13f, Ui.c.text2, Fonts.sansSemibold) {
    gravity = Gravity.CENTER_VERTICAL
}

fun TextView.styleStatus(label: String, color: Int, filled: Boolean = false) {
    text = label
    if (filled) {
        // Charcoal on gold reads well in both themes.
        setTextColor(Ui.LIGHT.text)
        background = Shapes.rounded(context, 8, color)
        setPadding(dp(8), dp(3), dp(8), dp(3))
    } else {
        setTextColor(color)
        background = null
        setPadding(0, 0, 0, 0)
    }
}

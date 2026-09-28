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
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.Switch
import android.widget.TextView
import com.imran.examcountdown.ui.Ease
import com.imran.examcountdown.ui.Fonts
import com.imran.examcountdown.ui.Haptics
import com.imran.examcountdown.ui.MATCH
import com.imran.examcountdown.ui.Shapes
import com.imran.examcountdown.ui.Spring
import com.imran.examcountdown.ui.Ui
import com.imran.examcountdown.ui.WRAP
import com.imran.examcountdown.ui.dp
import com.imran.examcountdown.ui.dpf
import com.imran.examcountdown.ui.lerp
import com.imran.examcountdown.ui.lerpColor
import com.imran.examcountdown.ui.text

/** On/off switch that reads as a switch to screen readers. The knob glides across in 220 ms. */
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
            val start = knob
            animator = ValueAnimator.ofFloat(0f, 1f).apply {
                duration = 220
                interpolator = Ease.inOut
                addUpdateListener {
                    knob = lerp(start, to, it.animatedValue as Float)
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
        val k = knob.coerceIn(0f, 1f)
        val inset = outline.strokeWidth / 2
        rect.set(inset, inset, width - inset, h - inset)
        track.color = lerpColor(c.surfaceAlt, c.green, k)
        canvas.drawRoundRect(rect, h / 2, h / 2, track)
        if (k < 1f) {
            outline.color = Ui.withAlpha(c.text3, 1f - k)
            canvas.drawRoundRect(rect, h / 2, h / 2, outline)
        }
        val radius = dpf(8) + dpf(3) * k
        val x = h / 2 + (width - h) * k
        knobPaint.color = lerpColor(c.text3, c.onGreen, k)
        canvas.drawCircle(x, h / 2, radius, knobPaint)
    }

    override fun getAccessibilityClassName(): CharSequence = Switch::class.java.name

    override fun onInitializeAccessibilityNodeInfo(info: AccessibilityNodeInfo) {
        super.onInitializeAccessibilityNodeInfo(info)
        info.isCheckable = true
        info.isChecked = isChecked
    }
}

/** Options in a quiet track; the selected one sits on a raised ivory tile that slides across (240 ms). */
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
        slide?.cancel()
        if (animate) {
            val start = indicator.translationX
            slide = ValueAnimator.ofFloat(0f, 1f).apply {
                duration = 240
                interpolator = Ease.inOut
                addUpdateListener { indicator.translationX = lerp(start, x, it.animatedValue as Float) }
                start()
            }
        } else {
            indicator.translationX = x
        }
    }

    private var slide: ValueAnimator? = null

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

/** Gentle press feedback: squeezes a view to [pressed] while held, then springs softly back. */
fun pressScale(view: View, pressed: Float = 0.96f): StateListAnimator = StateListAnimator().apply {
    addState(
        intArrayOf(android.R.attr.state_pressed),
        AnimatorSet().apply {
            playTogether(ObjectAnimator.ofFloat(view, View.SCALE_X, pressed), ObjectAnimator.ofFloat(view, View.SCALE_Y, pressed))
            duration = 90
            interpolator = Ease.out
        },
    )
    addState(
        intArrayOf(),
        AnimatorSet().apply {
            playTogether(ObjectAnimator.ofFloat(view, View.SCALE_X, 1f), ObjectAnimator.ofFloat(view, View.SCALE_Y, 1f))
            duration = 240
            interpolator = Spring(0.75f)
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

/**
 * Buttons side by side, centred, when they fit on one line; otherwise stacked at full width
 * (small screens, large text), so a label never wraps or gets cut off.
 */
class ButtonRow(context: Context, private val gap: Int) : android.view.ViewGroup(context) {

    /** True when the buttons didn't fit side by side. */
    var stacked = false
        private set

    private fun shown(): List<View> = (0 until childCount).map { getChildAt(it) }.filter { it.visibility != GONE }

    override fun onMeasure(widthMeasureSpec: Int, heightMeasureSpec: Int) {
        val width = MeasureSpec.getSize(widthMeasureSpec) - paddingLeft - paddingRight
        val children = shown()
        val free = MeasureSpec.makeMeasureSpec(0, MeasureSpec.UNSPECIFIED)
        var total = gap * (children.size - 1).coerceAtLeast(0)
        var tallest = 0
        for (child in children) {
            child.measure(free, free)
            total += child.measuredWidth
            tallest = maxOf(tallest, child.measuredHeight)
        }
        stacked = total > width
        var height = tallest
        if (stacked) {
            height = gap * (children.size - 1).coerceAtLeast(0)
            val exact = MeasureSpec.makeMeasureSpec(width, MeasureSpec.EXACTLY)
            for (child in children) {
                child.measure(exact, free)
                height += child.measuredHeight
            }
        }
        setMeasuredDimension(resolveSize(width + paddingLeft + paddingRight, widthMeasureSpec), height + paddingTop + paddingBottom)
    }

    override fun onLayout(changed: Boolean, l: Int, t: Int, r: Int, b: Int) {
        val children = shown()
        if (stacked) {
            var y = paddingTop
            for (child in children) {
                child.layout(paddingLeft, y, paddingLeft + child.measuredWidth, y + child.measuredHeight)
                y += child.measuredHeight + gap
            }
            return
        }
        val total = children.sumOf { it.measuredWidth } + gap * (children.size - 1).coerceAtLeast(0)
        var x = paddingLeft + (r - l - paddingLeft - paddingRight - total) / 2
        val height = b - t - paddingTop - paddingBottom
        for (child in children) {
            val y = paddingTop + (height - child.measuredHeight) / 2
            child.layout(x, y, x + child.measuredWidth, y + child.measuredHeight)
            x += child.measuredWidth + gap
        }
    }
}

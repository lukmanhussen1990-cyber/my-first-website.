package com.imran.examcountdown.ui.widgets

import android.animation.AnimatorSet
import android.animation.ObjectAnimator
import android.animation.StateListAnimator
import android.animation.ValueAnimator
import android.content.Context
import android.content.res.ColorStateList
import android.graphics.Canvas
import android.graphics.LinearGradient
import android.graphics.Paint
import android.graphics.RectF
import android.graphics.Shader
import android.view.Gravity
import android.view.View
import android.view.accessibility.AccessibilityNodeInfo
import android.view.animation.DecelerateInterpolator
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.Switch
import android.widget.TextView
import com.imran.examcountdown.ui.Fonts
import com.imran.examcountdown.ui.MATCH
import com.imran.examcountdown.ui.Palette
import com.imran.examcountdown.ui.Shapes
import com.imran.examcountdown.ui.WRAP
import com.imran.examcountdown.ui.dp
import com.imran.examcountdown.ui.dpf
import com.imran.examcountdown.ui.text

/** A compact on/off switch that reads as a switch to screen readers. */
class ToggleView(context: Context) : View(context) {

    var isChecked = false
        private set

    var onChange: ((Boolean) -> Unit)? = null
    var animateChanges = true

    private var knob = 0f
    private var animator: ValueAnimator? = null
    private val rect = RectF()
    private val offPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = 0x33FFFFFF }
    private val onPaint = Paint(Paint.ANTI_ALIAS_FLAG)
    private val knobPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Palette.WHITE }

    init {
        isClickable = true
        isFocusable = true
        contentDescription = null
    }

    fun setChecked(value: Boolean, animate: Boolean = false) {
        if (value == isChecked && animator == null) return
        isChecked = value
        animator?.cancel()
        val to = if (value) 1f else 0f
        if (animate && animateChanges && isAttachedToWindow) {
            animator = ValueAnimator.ofFloat(knob, to).apply {
                duration = 180
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
        onChange?.invoke(isChecked)
        return super.performClick()
    }

    override fun onMeasure(widthMeasureSpec: Int, heightMeasureSpec: Int) {
        setMeasuredDimension(dp(52), dp(32))
    }

    override fun onSizeChanged(w: Int, h: Int, oldw: Int, oldh: Int) {
        onPaint.shader = LinearGradient(0f, 0f, w.toFloat(), 0f, Palette.BLUE, Palette.VIOLET, Shader.TileMode.CLAMP)
    }

    override fun onDraw(canvas: Canvas) {
        val h = height.toFloat()
        rect.set(0f, 0f, width.toFloat(), h)
        canvas.drawRoundRect(rect, h / 2, h / 2, offPaint)
        onPaint.alpha = (255 * knob).toInt()
        canvas.drawRoundRect(rect, h / 2, h / 2, onPaint)
        val r = h / 2 - dpf(4)
        val x = h / 2 + (width - h) * knob
        canvas.drawCircle(x, h / 2, r, knobPaint)
    }

    override fun getAccessibilityClassName(): CharSequence = Switch::class.java.name

    override fun onInitializeAccessibilityNodeInfo(info: AccessibilityNodeInfo) {
        super.onInitializeAccessibilityNodeInfo(info)
        info.isCheckable = true
        info.isChecked = isChecked
    }
}

/** Pill-shaped options with a gradient highlight that slides to the selected one. */
class SegmentedControl(context: Context, private val labels: List<String>) : FrameLayout(context) {

    var selected = -1
        private set

    var onSelect: ((Int) -> Unit)? = null
    var animateChanges = true

    private val indicator = View(context).apply {
        background = Shapes.gradient(context, 14, Palette.ACCENT_GRADIENT, GradientDrawableOrientation.LEFT_RIGHT)
        visibility = INVISIBLE
    }
    private val row = LinearLayout(context).apply { orientation = LinearLayout.HORIZONTAL }
    private val options: List<TextView>

    init {
        background = Shapes.rounded(context, 18, 0x14FFFFFF, Palette.STROKE)
        setPadding(dp(4), dp(4), dp(4), dp(4))
        addView(indicator, LayoutParams(0, MATCH))
        options = labels.mapIndexed { index, label ->
            context.text(label, 14f, Palette.TEXT_2, Fonts.medium) {
                gravity = Gravity.CENTER
                maxLines = 1
                setPadding(dp(6), 0, dp(6), 0)
                background = Shapes.ripple(context, null, 14)
                setOnClickListener { select(index, animate = true, notify = true) }
            }.also { row.addView(it, LinearLayout.LayoutParams(0, dp(40), 1f)) }
        }
        addView(row, LayoutParams(MATCH, WRAP))
    }

    fun select(index: Int, animate: Boolean = false, notify: Boolean = false) {
        val changed = index != selected
        selected = index
        options.forEachIndexed { i, tv ->
            tv.setTextColor(if (i == index) Palette.WHITE else Palette.TEXT_2)
            tv.typeface = if (i == index) Fonts.semibold else Fonts.medium
            tv.isSelected = i == index
        }
        positionIndicator(animate && animateChanges && changed && indicator.visibility == VISIBLE)
        if (notify && changed) onSelect?.invoke(index)
    }

    private fun positionIndicator(animate: Boolean) {
        if (selected < 0 || row.width == 0) {
            indicator.visibility = if (selected < 0) INVISIBLE else indicator.visibility
            return
        }
        val w = row.width / labels.size
        val x = (selected * w).toFloat()
        if (indicator.layoutParams.width != w) {
            indicator.layoutParams = LayoutParams(w, row.height)
        }
        indicator.visibility = VISIBLE
        if (animate) {
            indicator.animate().translationX(x).setDuration(220).setInterpolator(DecelerateInterpolator()).start()
        } else {
            indicator.translationX = x
        }
    }

    override fun onLayout(changed: Boolean, left: Int, top: Int, right: Int, bottom: Int) {
        super.onLayout(changed, left, top, right, bottom)
        if (changed && selected >= 0) post { positionIndicator(false) }
    }
}

/** Short alias so call sites stay readable. */
typealias GradientDrawableOrientation = android.graphics.drawable.GradientDrawable.Orientation

enum class ButtonStyle { PRIMARY, SECONDARY, GHOST, DANGER }

/** A rounded, full-height button with an optional leading icon and a gentle press effect. */
fun Context.pillButton(
    label: String,
    iconRes: Int? = null,
    style: ButtonStyle = ButtonStyle.PRIMARY,
    onClick: (View) -> Unit,
): TextView = text(label, 16f, Palette.WHITE, Fonts.semibold) {
    gravity = Gravity.CENTER
    minHeight = dp(52)
    setPadding(dp(22), 0, dp(22), 0)
    val fill = when (style) {
        ButtonStyle.PRIMARY -> Shapes.gradient(context, 26, Palette.ACCENT_GRADIENT, GradientDrawableOrientation.LEFT_RIGHT)
        ButtonStyle.SECONDARY -> Shapes.rounded(context, 26, 0x14FFFFFF, Palette.STROKE_STRONG)
        ButtonStyle.GHOST -> null
        ButtonStyle.DANGER -> Shapes.rounded(context, 26, Palette.withAlpha(Palette.PINK, 0.14f), Palette.withAlpha(Palette.PINK, 0.5f))
    }
    if (style == ButtonStyle.GHOST) setTextColor(Palette.VIOLET_LIGHT)
    if (style == ButtonStyle.DANGER) setTextColor(Palette.PINK)
    background = Shapes.ripple(context, fill, 26)
    if (iconRes != null) {
        val d = context.getDrawable(iconRes)?.mutate()
        d?.setTintList(ColorStateList.valueOf(currentTextColor))
        d?.setBounds(0, 0, dp(20), dp(20))
        setCompoundDrawablesRelative(d, null, null, null)
        compoundDrawablePadding = dp(8)
    }
    stateListAnimator = pressScale(this)
    setOnClickListener(onClick)
}

/** Scales a view down slightly while pressed. */
fun pressScale(view: View): StateListAnimator = StateListAnimator().apply {
    addState(
        intArrayOf(android.R.attr.state_pressed),
        AnimatorSet().apply {
            playTogether(ObjectAnimator.ofFloat(view, View.SCALE_X, 0.96f), ObjectAnimator.ofFloat(view, View.SCALE_Y, 0.96f))
            duration = 90
        },
    )
    addState(
        intArrayOf(),
        AnimatorSet().apply {
            playTogether(ObjectAnimator.ofFloat(view, View.SCALE_X, 1f), ObjectAnimator.ofFloat(view, View.SCALE_Y, 1f))
            duration = 160
        },
    )
}

/** Small rounded label with an optional icon, e.g. a date or hall number. */
fun Context.chip(label: String, iconRes: Int? = null, tint: Int = Palette.TEXT_2, fill: Int = 0x12FFFFFF): TextView =
    text(label, 13.5f, Palette.TEXT, Fonts.medium) {
        gravity = Gravity.CENTER_VERTICAL
        setPadding(dp(11), dp(7), dp(12), dp(7))
        background = Shapes.rounded(context, 14, fill, Palette.STROKE)
        if (iconRes != null) {
            val d = context.getDrawable(iconRes)?.mutate()
            d?.setTintList(ColorStateList.valueOf(tint))
            d?.setBounds(0, 0, dp(16), dp(16))
            setCompoundDrawablesRelative(d, null, null, null)
            compoundDrawablePadding = dp(6)
        }
    }

/** Status pill used on timeline rows and checklist headers. */
fun Context.statusPill(): TextView = text("", 12f, Palette.TEXT, Fonts.semibold) {
    gravity = Gravity.CENTER
    setPadding(dp(10), dp(5), dp(10), dp(5))
    letterSpacing = 0.02f
}

fun TextView.styleStatus(label: String, color: Int, filled: Boolean = false) {
    text = label
    setTextColor(if (filled) Palette.WHITE else color)
    background = if (filled) {
        Shapes.gradient(context, 12, intArrayOf(color, Palette.withAlpha(color, 0.75f)), GradientDrawableOrientation.LEFT_RIGHT)
    } else {
        Shapes.rounded(context, 12, Palette.withAlpha(color, 0.14f), Palette.withAlpha(color, 0.35f))
    }
}

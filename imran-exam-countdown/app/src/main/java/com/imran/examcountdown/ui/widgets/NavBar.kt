package com.imran.examcountdown.ui.widgets

import android.animation.ValueAnimator
import android.content.Context
import android.content.res.ColorStateList
import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.RectF
import android.util.TypedValue
import android.view.Gravity
import android.view.animation.LinearInterpolator
import android.widget.FrameLayout
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.TextView
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
import com.imran.examcountdown.ui.lp
import com.imran.examcountdown.ui.separator
import com.imran.examcountdown.ui.spring
import com.imran.examcountdown.ui.text
import kotlin.math.abs

/**
 * Bottom navigation that sits below the content (it never overlaps it). Its bottom padding
 * covers the system navigation bar, whether that's gesture navigation or three buttons.
 *
 * The selected tab sits on a soft green pill. Choosing another tab sends the pill across like a
 * drop of liquid: its leading edge races ahead, the trailing edge catches up, and it settles
 * with a little wobble while the new icon pops.
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
    private val row = IndicatorRow(context)

    // The pill, in row coordinates: where it is drawn now, and the move in progress.
    private val pill = RectF()
    private val from = RectF()
    private val to = RectF()
    private var pillShown = false
    private var movingRight = true
    private var progress = 1f
    private var animator: ValueAnimator? = null
    private var colorAnimator: ValueAnimator? = null
    private val pillPaint = Paint(Paint.ANTI_ALIAS_FLAG)

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
                    if (index != selected) Haptics.tap(it) else nudge(index)
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
        val moving = animate && animateChanges && previous != index && previous >= 0 && index in pills.indices && pillShown
        for (i in items.indices) {
            val on = i == index
            texts[i].typeface = if (on) Fonts.sansSemibold else Fonts.sansMedium
            items[i].isSelected = on
            if (!moving) paintItem(i, if (on) 1f else 0f)
        }
        if (!moving) {
            animator?.cancel()
            progress = 1f
            placePill(index)
            return
        }
        // Colours cross-fade while the pill travels.
        colorAnimator?.cancel()
        colorAnimator = ValueAnimator.ofFloat(0f, 1f).apply {
            duration = 240
            addUpdateListener {
                val f = it.animatedValue as Float
                paintItem(index, f)
                if (previous in items.indices) paintItem(previous, 1f - f)
            }
            start()
        }
        from.set(pill)
        pillRect(index, to)
        movingRight = to.centerX() >= from.centerX()
        animator?.cancel()
        animator = ValueAnimator.ofFloat(0f, 1f).apply {
            duration = 520
            interpolator = LinearInterpolator()
            addUpdateListener {
                progress = it.animatedValue as Float
                updatePill()
            }
            start()
        }
        // The new icon pops.
        val icon = icons[index]
        icon.scaleX = 0.72f
        icon.scaleY = 0.72f
        icon.animate().scaleX(1f).scaleY(1f).setInterpolator(Spring.bouncy).setDuration(560).start()
    }

    /** A small bounce when the current tab is tapped again. */
    private fun nudge(index: Int) {
        if (!animateChanges || index !in icons.indices) return
        val icon = icons[index]
        icon.animate().cancel()
        icon.scaleX = 0.86f
        icon.scaleY = 0.86f
        icon.animate().scaleX(1f).scaleY(1f).setInterpolator(Spring.bouncy).setDuration(480).start()
    }

    private fun paintItem(i: Int, on: Float) {
        val c = Ui.c
        val color = lerpColor(c.text2, c.greenText, on)
        icons[i].imageTintList = ColorStateList.valueOf(color)
        texts[i].setTextColor(color)
    }

    /** Where the pill sits behind item [index], in row coordinates. */
    private fun pillRect(index: Int, out: RectF) {
        val item = items[index]
        val p = pills[index]
        out.set(
            (item.left + p.left).toFloat(),
            (item.top + p.top).toFloat(),
            (item.left + p.right).toFloat(),
            (item.top + p.bottom).toFloat(),
        )
    }

    private fun placePill(index: Int) {
        if (index !in items.indices || items[index].width == 0) {
            pillShown = false
            row.invalidate()
            return
        }
        pillRect(index, pill)
        pillShown = true
        row.invalidate()
    }

    /** Liquid motion: the leading edge moves first and fast, the trailing edge follows. */
    private fun updatePill() {
        val lead = spring((progress * 1.35f).coerceAtMost(1f), 0.72f)
        val trail = spring(((progress - 0.1f) / 0.9f).coerceIn(0f, 1f), 0.6f)
        val l: Float
        val r: Float
        if (movingRight) {
            l = lerp(from.left, to.left, trail)
            r = lerp(from.right, to.right, lead)
        } else {
            l = lerp(from.left, to.left, lead)
            r = lerp(from.right, to.right, trail)
        }
        // Stretched, it thins a little, like a drop.
        val base = to.width()
        val stretch = ((abs(r - l) - base) / base).coerceIn(0f, 1.5f)
        val squash = to.height() * 0.1f * stretch.coerceAtMost(1f)
        pill.set(minOf(l, r), to.top + squash, maxOf(l, r), to.bottom - squash)
        row.invalidate()
    }

    override fun onLayout(changed: Boolean, l: Int, t: Int, r: Int, b: Int) {
        super.onLayout(changed, l, t, r, b)
        if (changed) texts.forEach { fitWidth(it) }
        if (animator?.isRunning == true) {
            pillRect(selected, to)
        } else if (selected >= 0) {
            placePill(selected)
        }
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

    /** The row of items, drawing the pill behind them. */
    private inner class IndicatorRow(context: Context) : LinearLayout(context) {
        override fun dispatchDraw(canvas: Canvas) {
            if (pillShown) {
                pillPaint.color = Ui.c.greenSoft
                val radius = dpf(16).coerceAtMost(pill.height() / 2f)
                canvas.drawRoundRect(pill, radius, radius, pillPaint)
            }
            super.dispatchDraw(canvas)
        }
    }
}

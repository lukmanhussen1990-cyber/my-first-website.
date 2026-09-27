package com.imran.examcountdown.ui

import android.content.Context
import android.content.res.ColorStateList
import android.graphics.Typeface
import android.graphics.drawable.Drawable
import android.graphics.drawable.GradientDrawable
import android.graphics.drawable.RippleDrawable
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.widget.FrameLayout
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.TextView
import com.imran.examcountdown.R

/** Midnight navy with electric blue and violet accents. */
object Palette {
    const val BG_TOP = 0xFF050816.toInt()
    const val BG_MID = 0xFF0A1033.toInt()
    const val BG_BOTTOM = 0xFF150D3C.toInt()
    const val SURFACE = 0xCC0E1642.toInt()
    const val SURFACE_SOLID = 0xFF111A48.toInt()
    const val SURFACE_HIGH = 0xFF18235C.toInt()
    const val SURFACE_LOW = 0x800B1236.toInt()
    const val STROKE = 0x1AFFFFFF
    const val STROKE_STRONG = 0x33FFFFFF
    const val TRACK = 0x1FFFFFFF

    const val BLUE = 0xFF3B7BFF.toInt()
    const val CYAN = 0xFF33D6FF.toInt()
    const val VIOLET = 0xFF8B5CF6.toInt()
    const val VIOLET_LIGHT = 0xFFB794FF.toInt()
    const val PINK = 0xFFF472B6.toInt()
    const val GREEN = 0xFF34D399.toInt()
    const val AMBER = 0xFFFBBF24.toInt()
    const val WHITE = 0xFFFFFFFF.toInt()

    const val TEXT = 0xFFF4F6FF.toInt()
    const val TEXT_2 = 0xFFAEB8E0.toInt()
    const val TEXT_3 = 0xFF7883B6.toInt()

    val ACCENT_GRADIENT = intArrayOf(BLUE, VIOLET)
    val LIVE_GRADIENT = intArrayOf(VIOLET, PINK)
    val SUCCESS_GRADIENT = intArrayOf(GREEN, CYAN)

    fun withAlpha(color: Int, alpha: Float): Int =
        (color and 0x00FFFFFF) or ((alpha.coerceIn(0f, 1f) * 255).toInt() shl 24)
}

/** Outfit, bundled under the SIL Open Font License (see docs/OFL-Outfit.txt). */
object Fonts {
    lateinit var light: Typeface
    lateinit var regular: Typeface
    lateinit var medium: Typeface
    lateinit var semibold: Typeface
    lateinit var bold: Typeface

    fun init(context: Context) {
        if (::bold.isInitialized) return
        val r = context.resources
        light = r.getFont(R.font.outfit_light)
        regular = r.getFont(R.font.outfit_regular)
        medium = r.getFont(R.font.outfit_medium)
        semibold = r.getFont(R.font.outfit_semibold)
        bold = r.getFont(R.font.outfit_bold)
    }
}

const val MATCH = ViewGroup.LayoutParams.MATCH_PARENT
const val WRAP = ViewGroup.LayoutParams.WRAP_CONTENT

fun Context.dp(value: Number): Int = (value.toFloat() * resources.displayMetrics.density + 0.5f).toInt()
fun Context.dpf(value: Number): Float = value.toFloat() * resources.displayMetrics.density
fun View.dp(value: Number): Int = context.dp(value)
fun View.dpf(value: Number): Float = context.dpf(value)

// ---------------------------------------------------------------- drawables

object Shapes {
    fun rounded(context: Context, radiusDp: Number, fill: Int, stroke: Int = 0, strokeDp: Number = 1): GradientDrawable =
        GradientDrawable().apply {
            shape = GradientDrawable.RECTANGLE
            cornerRadius = context.dpf(radiusDp)
            setColor(fill)
            if (stroke != 0) setStroke(context.dp(strokeDp).coerceAtLeast(1), stroke)
        }

    fun gradient(
        context: Context,
        radiusDp: Number,
        colors: IntArray,
        orientation: GradientDrawable.Orientation = GradientDrawable.Orientation.TL_BR,
        stroke: Int = 0,
    ): GradientDrawable = GradientDrawable(orientation, colors).apply {
        cornerRadius = context.dpf(radiusDp)
        if (stroke != 0) setStroke(context.dp(1), stroke)
    }

    fun oval(fill: Int, stroke: Int = 0, strokePx: Int = 0): GradientDrawable = GradientDrawable().apply {
        shape = GradientDrawable.OVAL
        setColor(fill)
        if (stroke != 0) setStroke(strokePx, stroke)
    }

    fun ovalGradient(colors: IntArray): GradientDrawable =
        GradientDrawable(GradientDrawable.Orientation.TL_BR, colors).apply { shape = GradientDrawable.OVAL }

    /** Adds a touch ripple on top of [content], clipped to a rounded rectangle. */
    fun ripple(context: Context, content: Drawable?, radiusDp: Number, color: Int = 0x33FFFFFF): RippleDrawable =
        RippleDrawable(ColorStateList.valueOf(color), content, rounded(context, radiusDp, Palette.WHITE))

    fun card(context: Context, radiusDp: Number = 24): Drawable =
        rounded(context, radiusDp, Palette.SURFACE, Palette.STROKE)
}

// ---------------------------------------------------------------- view builders

inline fun Context.column(block: LinearLayout.() -> Unit = {}): LinearLayout =
    LinearLayout(this).apply { orientation = LinearLayout.VERTICAL; block() }

inline fun Context.row(block: LinearLayout.() -> Unit = {}): LinearLayout =
    LinearLayout(this).apply {
        orientation = LinearLayout.HORIZONTAL
        gravity = Gravity.CENTER_VERTICAL
        block()
    }

inline fun Context.frame(block: FrameLayout.() -> Unit = {}): FrameLayout = FrameLayout(this).apply(block)

fun Context.text(
    value: CharSequence = "",
    sizeSp: Float = 15f,
    color: Int = Palette.TEXT,
    font: Typeface = Fonts.regular,
    block: TextView.() -> Unit = {},
): TextView = TextView(this).apply {
    text = value
    textSize = sizeSp
    setTextColor(color)
    typeface = font
    includeFontPadding = false
    setLineSpacing(0f, 1.18f)
    block()
}

/** Sets text only when it changed, avoiding needless relayouts on every tick. */
fun TextView.update(value: CharSequence) {
    if (text.toString() != value.toString()) text = value
}

/** Small, letter-spaced caps label. */
fun Context.caps(value: CharSequence, color: Int = Palette.TEXT_2, sizeSp: Float = 11.5f): TextView =
    text(value.toString().uppercase(), sizeSp, color, Fonts.semibold) { letterSpacing = 0.14f }

fun Context.icon(res: Int, tint: Int, sizeDp: Int = 20): ImageView = ImageView(this).apply {
    setImageResource(res)
    imageTintList = ColorStateList.valueOf(tint)
    scaleType = ImageView.ScaleType.FIT_CENTER
    layoutParams = LinearLayout.LayoutParams(dp(sizeDp), dp(sizeDp))
    importantForAccessibility = View.IMPORTANT_FOR_ACCESSIBILITY_NO
}

fun Context.space(heightDp: Int): View = View(this).apply {
    layoutParams = LinearLayout.LayoutParams(1, dp(heightDp))
}

fun lp(
    width: Int = MATCH,
    height: Int = WRAP,
    weight: Float = 0f,
    block: LinearLayout.LayoutParams.() -> Unit = {},
): LinearLayout.LayoutParams = LinearLayout.LayoutParams(width, height, weight).apply(block)

fun flp(width: Int = MATCH, height: Int = WRAP, gravity: Int = Gravity.NO_GRAVITY): FrameLayout.LayoutParams =
    FrameLayout.LayoutParams(width, height, gravity)

fun LinearLayout.LayoutParams.margins(context: Context, l: Int = 0, t: Int = 0, r: Int = 0, b: Int = 0) {
    setMargins(context.dp(l), context.dp(t), context.dp(r), context.dp(b))
}

/** Rounded surface card with padding. */
fun Context.card(paddingDp: Int = 20, radiusDp: Int = 24, block: LinearLayout.() -> Unit = {}): LinearLayout =
    column {
        background = Shapes.card(context, radiusDp)
        setPadding(dp(paddingDp), dp(paddingDp), dp(paddingDp), dp(paddingDp))
        block()
    }

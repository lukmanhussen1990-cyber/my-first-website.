package com.imran.examcountdown.ui

import android.content.Context
import android.content.res.ColorStateList
import android.content.res.Configuration
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

/** A colour scheme. Light is warm ivory with forest green and gold; dark is its night-time match. */
class Colors(
    val dark: Boolean,
    val bg: Int,
    val surface: Int,
    val surfaceAlt: Int,
    val separator: Int,
    val track: Int,
    val text: Int,
    val text2: Int,
    val text3: Int,
    val green: Int,
    val onGreen: Int,
    val greenSoft: Int,
    val greenText: Int,
    val gold: Int,
    val goldText: Int,
    val goldSoft: Int,
    val danger: Int,
    val ripple: Int,
)

private fun argb(value: Long): Int = value.toInt()

object Ui {
    val LIGHT = Colors(
        dark = false,
        bg = argb(0xFFF7F3E8),
        surface = argb(0xFFFFFCF5),
        surfaceAlt = argb(0xFFEFE8D7),
        separator = argb(0xFFE3DAC6),
        track = argb(0xFFE6DECB),
        text = argb(0xFF1E2320),
        text2 = argb(0xFF555E57),
        text3 = argb(0xFF7D847C),
        green = argb(0xFF1F5A3B),
        onGreen = argb(0xFFFBF7EC),
        greenSoft = argb(0xFFE1EBDF),
        greenText = argb(0xFF1F5A3B),
        gold = argb(0xFFD4A12A),
        goldText = argb(0xFF8A6208),
        goldSoft = argb(0xFFF3E4B8),
        danger = argb(0xFFA23A2C),
        ripple = argb(0x261F5A3B),
    )

    val DARK = Colors(
        dark = true,
        bg = argb(0xFF101613),
        surface = argb(0xFF161E19),
        surfaceAlt = argb(0xFF1E2922),
        separator = argb(0xFF27332B),
        track = argb(0xFF26312A),
        text = argb(0xFFEEEADF),
        text2 = argb(0xFFB2B9AF),
        text3 = argb(0xFF868F86),
        green = argb(0xFF2F6E4A),
        onGreen = argb(0xFFF4F0E4),
        greenSoft = argb(0xFF1D3326),
        greenText = argb(0xFF7CC69A),
        gold = argb(0xFFD9AE45),
        goldText = argb(0xFFE3BD5E),
        goldSoft = argb(0xFF372E1A),
        danger = argb(0xFFE88B7C),
        ripple = argb(0x33EEEADF),
    )

    /** Deep forest green of the launch window and the opening, in both themes (@color/forest). */
    val FOREST = argb(0xFF0F3B26)

    /** The scheme in use; set by the activity before it builds any views. */
    @Volatile
    var c: Colors = LIGHT

    fun isNight(context: Context): Boolean =
        (context.resources.configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK) == Configuration.UI_MODE_NIGHT_YES

    fun apply(context: Context) {
        c = if (isNight(context)) DARK else LIGHT
    }

    fun withAlpha(color: Int, alpha: Float): Int =
        (color and 0x00FFFFFF) or ((alpha.coerceIn(0f, 1f) * 255).toInt() shl 24)
}

/** Source Serif 4 for headings and numbers, Source Sans 3 for everything else (SIL OFL 1.1). */
object Fonts {
    lateinit var serif: Typeface
    lateinit var serifItalic: Typeface
    lateinit var sans: Typeface
    lateinit var sansMedium: Typeface
    lateinit var sansSemibold: Typeface

    fun init(context: Context) {
        if (::sansSemibold.isInitialized) return
        val r = context.resources
        serif = r.getFont(R.font.serif_semibold)
        serifItalic = r.getFont(R.font.serif_italic)
        sans = r.getFont(R.font.sans_regular)
        sansMedium = r.getFont(R.font.sans_medium)
        sansSemibold = r.getFont(R.font.sans_semibold)
    }
}

const val MATCH = ViewGroup.LayoutParams.MATCH_PARENT
const val WRAP = ViewGroup.LayoutParams.WRAP_CONTENT

fun Context.dp(value: Number): Int = (value.toFloat() * resources.displayMetrics.density + 0.5f).toInt()
fun Context.dpf(value: Number): Float = value.toFloat() * resources.displayMetrics.density
fun Context.sp(value: Number): Float = value.toFloat() * resources.displayMetrics.scaledDensity
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

    fun oval(fill: Int, stroke: Int = 0, strokePx: Int = 0): GradientDrawable = GradientDrawable().apply {
        shape = GradientDrawable.OVAL
        setColor(fill)
        if (stroke != 0) setStroke(strokePx, stroke)
    }

    /** A touch ripple over [content], bounded by a rounded rectangle. */
    fun ripple(context: Context, content: Drawable?, radiusDp: Number): RippleDrawable =
        RippleDrawable(ColorStateList.valueOf(Ui.c.ripple), content, rounded(context, radiusDp, Ui.c.text))
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
    sizeSp: Float = 16f,
    color: Int = Ui.c.text,
    font: Typeface = Fonts.sans,
    block: TextView.() -> Unit = {},
): TextView = TextView(this).apply {
    text = value
    textSize = sizeSp
    setTextColor(color)
    typeface = font
    includeFontPadding = false
    setLineSpacing(0f, 1.2f)
    block()
}

/** Serif heading. */
fun Context.heading(value: CharSequence, sizeSp: Float = 28f, color: Int = Ui.c.text): TextView =
    text(value, sizeSp, color, Fonts.serif) { setLineSpacing(0f, 1.1f) }

/** Small, letter-spaced caps label, e.g. "NEXT EXAM". */
fun Context.label(value: CharSequence, color: Int = Ui.c.greenText, sizeSp: Float = 12f): TextView =
    text(value.toString().uppercase(), sizeSp, color, Fonts.sansSemibold) { letterSpacing = 0.12f }

/** Sets text only when it changed, avoiding needless relayouts on every tick. */
fun TextView.update(value: CharSequence) {
    if (text.toString() != value.toString()) text = value
}

fun Context.icon(res: Int, tint: Int, sizeDp: Int = 20): ImageView = ImageView(this).apply {
    setImageResource(res)
    imageTintList = ColorStateList.valueOf(tint)
    scaleType = ImageView.ScaleType.FIT_CENTER
    layoutParams = LinearLayout.LayoutParams(dp(sizeDp), dp(sizeDp))
    importantForAccessibility = View.IMPORTANT_FOR_ACCESSIBILITY_NO
}

/**
 * A hairline divider. It always measures exactly one hairline tall, whatever layout params it
 * is given (a plain View asked to "wrap content" would otherwise fill all available space).
 */
class Hairline(context: Context) : View(context) {
    private val thickness = 1.coerceAtLeast((context.resources.displayMetrics.density * 0.75f).toInt())

    init {
        setBackgroundColor(Ui.c.separator)
        importantForAccessibility = IMPORTANT_FOR_ACCESSIBILITY_NO
    }

    override fun onMeasure(widthMeasureSpec: Int, heightMeasureSpec: Int) {
        setMeasuredDimension(MeasureSpec.getSize(widthMeasureSpec), thickness)
    }
}

fun Context.separator(): View = Hairline(this).apply {
    layoutParams = LinearLayout.LayoutParams(MATCH, WRAP)
}

fun lp(
    width: Int = MATCH,
    height: Int = WRAP,
    weight: Float = 0f,
    block: LinearLayout.LayoutParams.() -> Unit = {},
): LinearLayout.LayoutParams = LinearLayout.LayoutParams(width, height, weight).apply(block)

fun flp(width: Int = MATCH, height: Int = WRAP, gravity: Int = Gravity.NO_GRAVITY): FrameLayout.LayoutParams =
    FrameLayout.LayoutParams(width, height, gravity)

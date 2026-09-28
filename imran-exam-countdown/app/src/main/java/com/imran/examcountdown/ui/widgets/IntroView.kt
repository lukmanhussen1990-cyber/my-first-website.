package com.imran.examcountdown.ui.widgets

import android.animation.ValueAnimator
import android.content.Context
import android.graphics.Canvas
import android.graphics.LinearGradient
import android.graphics.Matrix
import android.graphics.Paint
import android.graphics.Path
import android.graphics.RadialGradient
import android.graphics.RectF
import android.graphics.Shader
import android.graphics.Typeface
import android.view.Gravity
import android.view.View
import android.view.animation.LinearInterpolator
import android.widget.FrameLayout
import android.widget.ImageView
import com.imran.examcountdown.R
import com.imran.examcountdown.ui.Ease
import com.imran.examcountdown.ui.Fonts
import com.imran.examcountdown.ui.Ui
import com.imran.examcountdown.ui.dp
import com.imran.examcountdown.ui.dpf
import com.imran.examcountdown.ui.flp
import com.imran.examcountdown.ui.lerp
import com.imran.examcountdown.ui.lerpColor
import com.imran.examcountdown.ui.spring
import com.imran.examcountdown.ui.window
import kotlin.math.cos
import kotlin.math.max
import kotlin.math.min
import kotlin.math.sin

/**
 * The opening (2.3 s). It starts on the deep forest green of the launch window, so the hand-over
 * from Android's launch screen is seamless:
 *
 *     0–820   two fine gold arcs sweep up round the emblem from the bottom, one each way, and
 *             join at the top into a complete border
 *   220–1000  the emblem fades in and scales up gently from 92 %, settling on a soft spring
 *   780–1440  the school's name settles in underneath, letter by letter, as its spacing tightens
 *   980–1500  one restrained highlight passes across the emblem
 *  1600–2300  the emblem glides into its place in Home's header while the green gives way to the
 *             app's own background and Home's content rises in beneath it
 *
 * The emblem artwork is only faded, scaled and moved (never rotated, recoloured or warped), so
 * all its lettering stays legible. Nothing waits for the opening: Home is built underneath from
 * the start, a tap skips straight to the hand-over, and from then on touches go through to Home.
 */
class IntroView(context: Context) : FrameLayout(context) {

    /** Header emblem to settle into; hidden during the opening and shown when it lands. */
    var target: (() -> View?)? = null

    /** Called once the opening covers the screen (at once, or after its fade-in on a replay). */
    var onCovered: (() -> Unit)? = null

    /** Called once as the hand-over begins, so the screen underneath can rise in. */
    var onReveal: (() -> Unit)? = null

    /** Called once the green has given way to the app's background (for the status bar icons). */
    var onBackdropGone: (() -> Unit)? = null

    /** Called once at the very end, after the overlay has been removed. */
    var onFinished: (() -> Unit)? = null

    private val emblem = ImageView(context).apply {
        setImageResource(R.drawable.emblem)
        scaleType = ImageView.ScaleType.FIT_CENTER
        importantForAccessibility = IMPORTANT_FOR_ACCESSIBILITY_NO
    }

    private val colors = Ui.c
    private var t = 0f
    private var animator: ValueAnimator? = null
    private var exiting = false
    private var revealed = false
    private var backdropGone = false
    private var finished = false
    private var still = false

    // Where the emblem starts the hand-over from, and where it lands (dx, dy, scale).
    private var exitFrom = floatArrayOf(1f, 1f)
    private var exitTo: FloatArray? = null

    // Geometry, set in onSizeChanged.
    private var emblemSize = 0
    private var cx = 0f
    private var cy = 0f
    private var r = 0f
    private var titleTop = 0f
    private var placeTop = 0f

    private val backdrop = Paint()
    private val depth = Paint(Paint.ANTI_ALIAS_FLAG)
    private val ring = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        style = Paint.Style.STROKE
        strokeCap = Paint.Cap.BUTT
    }
    private val head = Paint(Paint.ANTI_ALIAS_FLAG)
    private val headGlow = Paint(Paint.ANTI_ALIAS_FLAG)
    private val shine = Paint(Paint.ANTI_ALIAS_FLAG)
    private var shineShader: LinearGradient? = null
    private val shineMatrix = Matrix()
    private val clip = Path()
    private val oval = RectF()

    private val textScale = context.resources.configuration.fontScale.coerceIn(1f, 1.3f)
    private val cream = Ui.LIGHT.onGreen
    private val title = Word("Al-Ameen Academy", Fonts.serif, context.dpf(23) * textScale, cream, 0.1f, 0.01f, 780f, 16f)
    private val place = Word("BADARPUR · ESTD. 1994", Fonts.sansSemibold, context.dpf(11.5f) * textScale, colors.gold, 0.42f, 0.24f, 900f, 10f)
    private val letter = Paint(Paint.ANTI_ALIAS_FLAG)

    init {
        setWillNotDraw(false)
        isClickable = true
        contentDescription = "Al-Ameen Academy, Badarpur"
        addView(emblem, flp())
        emblem.alpha = 0f
        setOnClickListener { skip() }
        title.measure(letter)
        place.measure(letter)
    }

    override fun onSizeChanged(w: Int, h: Int, oldw: Int, oldh: Int) {
        val landscape = w > h
        emblemSize = min((min(w, h) * if (landscape) 0.4f else 0.46f).toInt(), dp(212))
        // The emblem and the name below it, centred together a little above the middle.
        val group = emblemSize + dpf(30) + dpf(34) * textScale + dpf(16) * textScale
        val top = (h * 0.46f - group / 2f).toInt().coerceAtLeast(dp(24))
        emblem.layoutParams = flp(emblemSize, emblemSize, Gravity.CENTER_HORIZONTAL).apply { topMargin = top }
        cx = w / 2f
        cy = top + emblemSize / 2f
        r = emblemSize / 2f
        titleTop = top + emblemSize + dpf(30)
        placeTop = titleTop + dpf(34) * textScale
        depth.shader = RadialGradient(
            cx, cy, max(w, h) * 0.6f,
            Ui.withAlpha(0xFFFFFFFF.toInt(), 0.075f), Ui.withAlpha(0xFFFFFFFF.toInt(), 0f), Shader.TileMode.CLAMP,
        )
        headGlow.shader = RadialGradient(0f, 0f, dpf(7), Ui.withAlpha(colors.gold, 0.35f), Ui.withAlpha(colors.gold, 0f), Shader.TileMode.CLAMP)
        val band = emblemSize * 0.22f
        shineShader = LinearGradient(
            -band, 0f, band, 0f,
            intArrayOf(0x00FFFFFF, 0x4DFFFFFF, 0x00FFFFFF), floatArrayOf(0f, 0.5f, 1f), Shader.TileMode.CLAMP,
        )
        shine.shader = shineShader
        post { requestLayout() }
    }

    /**
     * Plays the opening. On a cold launch it starts at once on the launch window's green; a
     * replay ([fadeIn]) first fades the green in over the current screen.
     */
    fun play(fadeIn: Boolean = false) {
        if (animator != null || covering) return
        whenCovered(fadeIn) {
            target?.invoke()?.visibility = View.INVISIBLE
            run(0f, 1f)
        }
    }

    /**
     * Reduced motion: the finished composition fades in (on a replay), is held for a moment,
     * then simply fades away to the screen underneath. Nothing moves.
     */
    fun playStill(fadeIn: Boolean = false) {
        if (animator != null || covering) return
        still = true
        t = EXIT - 1f
        emblem.alpha = 1f
        invalidate()
        whenCovered(fadeIn) { hold() }
    }

    private var covering = false

    private fun whenCovered(fadeIn: Boolean, then: () -> Unit) {
        if (!fadeIn) {
            onCovered?.invoke()
            then()
            return
        }
        covering = true
        alpha = 0f
        animate().alpha(1f).setDuration(COVER_MS).setInterpolator(Ease.out).withEndAction {
            covering = false
            onCovered?.invoke()
            then()
        }.start()
    }

    private fun hold() {
        target?.invoke()?.visibility = View.VISIBLE
        animator = ValueAnimator.ofFloat(0f, STILL_MS).apply {
            duration = STILL_MS.toLong()
            interpolator = LinearInterpolator()
            addUpdateListener {
                val ms = it.animatedValue as Float
                if (ms >= STILL_MS - STILL_FADE) {
                    if (!revealed) {
                        revealed = true
                        onReveal?.invoke()
                        passTouches()
                    }
                    alpha = 1f - window(ms, STILL_MS - STILL_FADE, STILL_FADE)
                    if (alpha < 0.5f) backdropGoneOnce()
                }
                if (ms >= STILL_MS) finish()
            }
            start()
        }
    }

    /** Tap or back: jump straight to the hand-over, played a little faster. */
    fun skip() {
        val a = animator ?: return
        if (still || t >= EXIT) return
        // A fresh animator for just the hand-over, rather than seeking the running one.
        a.removeAllUpdateListeners()
        a.cancel()
        run(EXIT, SKIP_SPEED)
    }

    private fun run(from: Float, speed: Float) {
        animator = ValueAnimator.ofFloat(from, TOTAL).apply {
            duration = ((TOTAL - from) * speed).toLong()
            interpolator = LinearInterpolator()
            addUpdateListener { apply(it.animatedValue as Float) }
            start()
        }
    }

    private fun apply(time: Float) {
        t = time
        if (t >= EXIT) {
            if (!exiting) beginExit()
            val move = Ease.inOut.getInterpolation(window(t, EXIT, FLIGHT_MS))
            val to = exitTo
            emblem.alpha = if (to == null) exitFrom[0] * (1f - move) else lerp(exitFrom[0], 1f, window(t, EXIT, 150f))
            val scale = lerp(exitFrom[1], to?.get(2) ?: 0.9f, move)
            emblem.scaleX = scale
            emblem.scaleY = scale
            emblem.translationX = (to?.get(0) ?: 0f) * move
            emblem.translationY = (to?.get(1) ?: -dpf(20)) * move
            if (!revealed && t >= EXIT + REVEAL_DELAY) {
                revealed = true
                onReveal?.invoke()
            }
            if (t >= EXIT + BACKDROP_GONE) backdropGoneOnce()
        } else {
            emblem.alpha = Ease.cubicOut(window(t, 220f, 480f))
            // Grows from 92 % and settles on a soft spring (well under 2 % overshoot).
            val scale = 0.92f + 0.08f * spring(window(t, 220f, 780f), 0.82f)
            emblem.scaleX = scale
            emblem.scaleY = scale
        }
        invalidate()
        if (t >= TOTAL) finish()
    }

    private fun beginExit() {
        exiting = true
        exitFrom = floatArrayOf(emblem.alpha, emblem.scaleX)
        exitTo = exitTransform()
        passTouches()
    }

    /** From the hand-over on, the screen underneath is live: touches go straight to it. */
    private fun passTouches() {
        setOnClickListener(null)
        isClickable = false
    }

    private fun backdropGoneOnce() {
        if (backdropGone) return
        backdropGone = true
        onBackdropGone?.invoke()
    }

    // ------------------------------------------------------------------ drawing

    override fun onDraw(canvas: Canvas) {
        if (width == 0) return
        val w = width.toFloat()
        val h = height.toFloat()
        // The green gives way to the app's background, then the whole backdrop fades away over
        // Home as it rises in.
        val turn = if (still) 0f else Ease.cubicInOut(window(t, EXIT, 400f))
        val gone = if (still) 0f else Ease.cubicOut(window(t, EXIT + 220f, 300f))
        if (gone < 1f) {
            backdrop.color = lerpColor(Ui.FOREST, colors.bg, turn)
            backdrop.alpha = (255 * (1f - gone)).toInt()
            canvas.drawRect(0f, 0f, w, h, backdrop)
            depth.alpha = (255 * Ease.cubicOut(window(t, 0f, 500f)) * (1f - turn)).toInt()
            if (depth.alpha > 0) canvas.drawRect(0f, 0f, w, h, depth)
        }
        drawBorder(canvas)
    }

    /** The two gold arcs, and after they join, the border that follows the emblem into the header. */
    private fun drawBorder(canvas: Canvas) {
        val fade = if (still) 1f else 1f - window(t, EXIT, 300f)
        if (fade <= 0f) return
        val scale = emblem.scaleX
        val ex = cx + emblem.translationX
        val ey = cy + emblem.translationY
        val radius = (r + dpf(7)) * scale
        val sweep = 180f * Ease.cubicInOut(window(t, ARC_START, ARC_MS))
        ring.strokeWidth = dpf(1.6f) * scale.coerceAtLeast(0.5f)
        ring.color = Ui.withAlpha(colors.gold, fade)
        if (sweep >= 180f) {
            canvas.drawCircle(ex, ey, radius, ring)
            return
        }
        if (sweep <= 0f) return
        oval.set(ex - radius, ey - radius, ex + radius, ey + radius)
        // From the bottom, one arc each way round, meeting at the top.
        canvas.drawArc(oval, 90f, sweep, false, ring)
        canvas.drawArc(oval, 90f, -sweep, false, ring)
        // Small bright heads lead the arcs, fading as they meet.
        val lead = 1f - window(t, ARC_START + ARC_MS - 90f, 90f)
        if (lead <= 0f) return
        for (angle in floatArrayOf(90f + sweep, 90f - sweep)) {
            val a = angle * DEG
            val hx = ex + cos(a) * radius
            val hy = ey + sin(a) * radius
            canvas.save()
            canvas.translate(hx, hy)
            headGlow.alpha = (255 * lead).toInt()
            canvas.drawCircle(0f, 0f, dpf(7), headGlow)
            canvas.restore()
            head.color = Ui.withAlpha(lerpColor(colors.gold, 0xFFFFFFFF.toInt(), 0.55f), lead)
            canvas.drawCircle(hx, hy, dpf(2f), head)
        }
    }

    override fun dispatchDraw(canvas: Canvas) {
        super.dispatchDraw(canvas)
        if (width == 0) return
        // One restrained highlight across the emblem, clipped to its circle.
        val h = window(t, 980f, 520f)
        if (!still && h > 0f && h < 1f && t < EXIT) {
            val rr = r * emblem.scaleX
            clip.reset()
            clip.addCircle(cx, cy, rr, Path.Direction.CW)
            canvas.save()
            canvas.clipPath(clip)
            val band = emblemSize * 0.22f
            val x = cx - rr - band + (2 * rr + band * 2) * Ease.cubicInOut(h)
            shineMatrix.setTranslate(x, 0f)
            shineMatrix.postRotate(-20f, cx, cy)
            shineShader?.setLocalMatrix(shineMatrix)
            canvas.drawRect(cx - rr, cy - rr, cx + rr, cy + rr, shine)
            canvas.restore()
        }
        val out = if (still) 1f else 1f - Ease.cubicOut(window(t, EXIT, 180f))
        if (out <= 0f) return
        val drift = dpf(4) * (1f - out)
        drawWord(canvas, title, titleTop + drift, out)
        drawWord(canvas, place, placeTop + drift, out)
    }

    /** Letters settle in one after another, left to right, while the spacing tightens. */
    private fun drawWord(canvas: Canvas, word: Word, top: Float, out: Float) {
        val time = if (still) 10_000f else t
        if (time < word.start) return
        val p = Ease.quintOut(window(time, word.start, 760f))
        val spacing = lerp(word.spacingFrom, word.spacingTo, p) * word.size
        letter.typeface = word.font
        letter.textSize = word.size
        val n = word.text.length
        var total = spacing * (n - 1)
        for (i in 0 until n) total += word.widths[i]
        var x = cx - total / 2f
        val baseline = top - letter.ascent()
        for (i in 0 until n) {
            val a = Ease.cubicOut(window(time, word.start + i * word.stagger, 400f))
            if (a > 0f) {
                letter.color = Ui.withAlpha(word.color, a * out)
                canvas.drawText(word.text, i, i + 1, x, baseline + dpf(6) * (1f - a), letter)
            }
            x += word.widths[i] + spacing
        }
    }

    /** dx, dy and scale that land the emblem exactly on the header emblem, or null for a fade. */
    private fun exitTransform(): FloatArray? {
        val header = target?.invoke()
        if (header == null || header.width == 0 || emblem.width == 0) return null
        val a = IntArray(2)
        val b = IntArray(2)
        header.getLocationInWindow(a)
        getLocationInWindow(b)
        // Centres from layout positions, so the emblem's own scale doesn't matter here.
        val dx = (a[0] + header.width / 2f) - (b[0] + emblem.left + emblem.width / 2f)
        val dy = (a[1] + header.height / 2f) - (b[1] + emblem.top + emblem.height / 2f)
        return floatArrayOf(dx, dy, header.width.toFloat() / emblem.width)
    }

    private fun finish() {
        if (finished) return
        finished = true
        backdropGoneOnce()
        target?.invoke()?.visibility = View.VISIBLE
        (parent as? android.view.ViewGroup)?.removeView(this)
        onFinished?.invoke()
    }

    override fun onDetachedFromWindow() {
        super.onDetachedFromWindow()
        if (!finished) {
            animator?.cancel()
            finished = true
            target?.invoke()?.visibility = View.VISIBLE
        }
    }

    private class Word(
        val text: String,
        val font: Typeface,
        val size: Float,
        val color: Int,
        /** Extra letter spacing at the start and end, in ems. */
        val spacingFrom: Float,
        val spacingTo: Float,
        val start: Float,
        /** Delay between one letter and the next, ms. */
        val stagger: Float,
    ) {
        val widths = FloatArray(text.length)

        fun measure(paint: Paint) {
            paint.typeface = font
            paint.textSize = size
            for (i in text.indices) widths[i] = paint.measureText(text, i, i + 1)
        }
    }

    companion object {
        /** Whole opening, ms. */
        const val TOTAL = 2300f

        /** The hand-over to Home starts here. */
        const val EXIT = 1600f

        private const val ARC_START = 80f
        private const val ARC_MS = 740f
        private const val FLIGHT_MS = 620f
        private const val REVEAL_DELAY = 100f
        private const val BACKDROP_GONE = 260f
        private const val SKIP_SPEED = 0.75f
        private const val STILL_MS = 1200f
        private const val STILL_FADE = 300f
        private const val COVER_MS = 180L
        private const val DEG = (Math.PI / 180.0).toFloat()
    }
}

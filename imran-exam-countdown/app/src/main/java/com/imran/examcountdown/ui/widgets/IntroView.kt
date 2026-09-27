package com.imran.examcountdown.ui.widgets

import android.animation.ValueAnimator
import android.content.Context
import android.graphics.Canvas
import android.graphics.LinearGradient
import android.graphics.Matrix
import android.graphics.Paint
import android.graphics.Path
import android.graphics.RectF
import android.graphics.Shader
import android.view.Gravity
import android.view.View
import android.view.animation.LinearInterpolator
import android.widget.FrameLayout
import android.widget.ImageView
import android.widget.TextView
import com.imran.examcountdown.R
import com.imran.examcountdown.ui.Fonts
import com.imran.examcountdown.ui.Ui
import com.imran.examcountdown.ui.WRAP
import com.imran.examcountdown.ui.dp
import com.imran.examcountdown.ui.dpf
import com.imran.examcountdown.ui.flp
import com.imran.examcountdown.ui.text
import kotlin.math.min

/**
 * The opening sequence (about 1.9 s). The emblem artwork is only faded, scaled and moved —
 * never rotated, recoloured or warped — so its lettering stays legible throughout.
 *
 *    0 ms  ivory background (same colour as the launch window)
 *    0–750  a thin green stroke traces a circle around the emblem
 *  120–720  the emblem fades in and scales from 94% to 100%
 * 700–1200  one soft highlight passes across the emblem
 * 850–1310  "AL-AMEEN ACADEMY" and "BADARPUR" rise in
 * 1450–1900 the emblem glides into the header while the background dissolves into Home
 */
class IntroView(context: Context) : FrameLayout(context) {

    /** Header emblem to settle into; hidden during the intro and shown when it lands. */
    var target: (() -> View?)? = null

    /** Called once when the exit begins, so the screen underneath can stagger in. */
    var onReveal: (() -> Unit)? = null

    /** Called once at the very end, after the overlay has been removed. */
    var onFinished: (() -> Unit)? = null

    private val emblem = ImageView(context).apply {
        setImageResource(R.drawable.emblem)
        scaleType = ImageView.ScaleType.FIT_CENTER
        importantForAccessibility = IMPORTANT_FOR_ACCESSIBILITY_NO
    }
    private val decor = Decor(context)
    private val title: TextView = context.text("AL-AMEEN ACADEMY", 17f, Ui.c.text, Fonts.sansSemibold) {
        gravity = Gravity.CENTER
        letterSpacing = 0.18f
    }
    private val place: TextView = context.text("BADARPUR", 13f, Ui.c.goldText, Fonts.sansSemibold) {
        gravity = Gravity.CENTER
        letterSpacing = 0.34f
    }

    private var emblemSize = 0
    private var animator: ValueAnimator? = null
    private var revealed = false
    private var finished = false
    private var exitFrom: FloatArray? = null

    init {
        setBackgroundColor(Ui.c.bg)
        isClickable = true
        contentDescription = "Al-Ameen Academy, Badarpur"
        addView(decor, flp())
        addView(emblem, flp())
        addView(title, flp(WRAP, WRAP, Gravity.CENTER_HORIZONTAL))
        addView(place, flp(WRAP, WRAP, Gravity.CENTER_HORIZONTAL))
        emblem.alpha = 0f
        title.alpha = 0f
        place.alpha = 0f
        setOnClickListener { skip() }
    }

    override fun onSizeChanged(w: Int, h: Int, oldw: Int, oldh: Int) {
        emblemSize = min((min(w, h) * 0.5f).toInt(), dp(236))
        val ringPad = dp(14)
        val stage = emblemSize + ringPad * 2
        val cy = (h * 0.44f).toInt()
        val top = cy - emblemSize / 2
        emblem.layoutParams = flp(emblemSize, emblemSize, Gravity.CENTER_HORIZONTAL).apply { topMargin = top }
        decor.layoutParams = flp(stage, stage, Gravity.CENTER_HORIZONTAL).apply { topMargin = top - ringPad }
        (title.layoutParams as LayoutParams).topMargin = top + emblemSize + dp(34)
        (place.layoutParams as LayoutParams).topMargin = top + emblemSize + dp(62)
        decor.emblemInset = ringPad.toFloat()
        post { requestLayout() }
    }

    fun play() {
        if (animator != null) return
        animator = ValueAnimator.ofFloat(0f, TOTAL).apply {
            duration = TOTAL.toLong()
            interpolator = LinearInterpolator()
            addUpdateListener { apply(it.animatedValue as Float) }
            start()
        }
    }

    /** Tap to skip: jump straight to the exit. */
    fun skip() {
        val a = animator ?: return
        if ((a.animatedValue as Float) < EXIT) a.currentPlayTime = EXIT.toLong()
    }

    private fun apply(t: Float) {
        // 1. Circle traced around the emblem.
        decor.sweep = 360f * easeInOut(progress(t, 0f, 750f))
        // 2. Emblem fades in, 94% -> 100%.
        val e = easeOut(progress(t, 120f, 600f))
        // 3. One highlight across the emblem.
        decor.highlight = progress(t, 700f, 500f)
        // 4. Name and place rise in.
        val a = easeOut(progress(t, 850f, 380f))
        val b = easeOut(progress(t, 930f, 380f))
        // 5. Exit: fade surroundings, move the emblem into the header, dissolve the background.
        val out = progress(t, EXIT, 220f)
        val move = easeInOut(progress(t, EXIT, 450f))
        val dissolve = progress(t, EXIT + 100f, 350f)

        decor.alpha = 1f - out
        title.alpha = a * (1f - out)
        title.translationY = dpf(10) * (1f - a)
        place.alpha = b * (1f - out)
        place.translationY = dpf(10) * (1f - b)

        emblem.alpha = e
        val baseScale = 0.94f + 0.06f * e
        if (t >= EXIT) {
            if (!revealed) {
                revealed = true
                exitFrom = exitTransform()
                onReveal?.invoke()
            }
            val f = exitFrom
            if (f != null) {
                emblem.scaleX = 1f + (f[2] - 1f) * move
                emblem.scaleY = emblem.scaleX
                emblem.translationX = f[0] * move
                emblem.translationY = f[1] * move
            }
        } else {
            emblem.scaleX = baseScale
            emblem.scaleY = baseScale
        }
        background.alpha = (255 * (1f - dissolve)).toInt()
        if (t >= TOTAL) finish()
    }

    /** dx, dy and scale that land the emblem exactly on the header emblem, or a gentle fade-up. */
    private fun exitTransform(): FloatArray? {
        val header = target?.invoke()
        if (header == null || header.width == 0 || emblem.width == 0) return floatArrayOf(0f, -dpf(24), 0.9f)
        val a = IntArray(2)
        val b = IntArray(2)
        header.getLocationInWindow(a)
        emblem.getLocationInWindow(b)
        // getLocationInWindow includes the current transform; the emblem is at scale 1 here.
        val dx = (a[0] + header.width / 2f) - (b[0] + emblem.width / 2f)
        val dy = (a[1] + header.height / 2f) - (b[1] + emblem.height / 2f)
        return floatArrayOf(dx, dy, header.width.toFloat() / emblem.width)
    }

    private fun finish() {
        if (finished) return
        finished = true
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

    private fun progress(t: Float, start: Float, length: Float) = ((t - start) / length).coerceIn(0f, 1f)
    private fun easeOut(x: Float) = 1f - (1f - x) * (1f - x) * (1f - x)
    private fun easeInOut(x: Float) = if (x < 0.5f) 4f * x * x * x else 1f - ((-2f * x + 2f).let { it * it * it }) / 2f

    /** Draws the traced circle and the single highlight pass around/over the emblem. */
    private class Decor(context: Context) : View(context) {
        var sweep = 0f
            set(value) {
                field = value
                invalidate()
            }
        var highlight = 0f
            set(value) {
                field = value
                invalidate()
            }
        var emblemInset = 0f

        private val ring = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            style = Paint.Style.STROKE
            strokeCap = Paint.Cap.ROUND
        }
        private val shine = Paint(Paint.ANTI_ALIAS_FLAG)
        private val oval = RectF()
        private val clip = Path()
        private val m = Matrix()

        init {
            importantForAccessibility = IMPORTANT_FOR_ACCESSIBILITY_NO
            ring.strokeWidth = dpf(1.6f)
        }

        override fun onDraw(canvas: Canvas) {
            val w = width.toFloat()
            val stroke = ring.strokeWidth
            oval.set(stroke, stroke, w - stroke, height - stroke)
            ring.color = Ui.c.greenText
            if (sweep > 0f) canvas.drawArc(oval, -90f, sweep, false, ring)
            if (highlight <= 0f || highlight >= 1f) return
            // A soft diagonal band, clipped to the emblem circle, passing left to right once.
            val inner = emblemInset
            val size = w - inner * 2
            clip.reset()
            clip.addCircle(w / 2f, height / 2f, size / 2f, Path.Direction.CW)
            canvas.save()
            canvas.clipPath(clip)
            val band = size * 0.22f
            val x = inner - band + (size + band * 2) * highlight
            shine.shader = LinearGradient(
                x - band, 0f, x + band, 0f,
                intArrayOf(0x00FFFFFF, 0x59FFFFFF, 0x00FFFFFF),
                floatArrayOf(0f, 0.5f, 1f),
                Shader.TileMode.CLAMP,
            ).also {
                m.setRotate(-18f, w / 2f, height / 2f)
                it.setLocalMatrix(m)
            }
            canvas.drawRect(inner, inner, inner + size, inner + size, shine)
            canvas.restore()
        }
    }

    companion object {
        const val TOTAL = 1900f
        const val EXIT = 1450f
    }
}

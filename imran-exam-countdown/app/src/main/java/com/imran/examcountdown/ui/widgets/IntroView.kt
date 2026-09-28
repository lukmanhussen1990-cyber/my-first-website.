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
import com.imran.examcountdown.ui.spring
import com.imran.examcountdown.ui.window
import kotlin.math.abs
import kotlin.math.cos
import kotlin.math.exp
import kotlin.math.hypot
import kotlin.math.max
import kotlin.math.min
import kotlin.math.sin
import kotlin.random.Random

/**
 * The opening sequence (about 2 s): a cinematic reveal of the school emblem. The emblem artwork
 * itself is only faded, scaled and moved — never rotated, recoloured or warped — so its
 * lettering stays legible throughout; all the drama happens around it.
 *
 *     0 ms  ivory background (same colour as the launch window); a soft spotlight blooms
 *   0–900   a green ring and a gold ring trace round the emblem from opposite sides, each led by
 *           a glowing comet; 60 bezel ticks light up behind the green one like a watch face
 *  120–820  the emblem springs up from 70 % with a slight overshoot
 *  300      impact: a gold shockwave rolls outward and sparks fly off the rings
 *  180–1550 slow golden light rays turn behind the emblem
 *  820–1270 one bright highlight glides across the emblem
 *  880–1460 "AL-AMEEN ACADEMY" and "BADARPUR" gather in, letter by letter, above a gold rule
 * 1550–2050 exit: the rings burst outward and fade, the emblem glides into the header, and the
 *           ivory opens from the centre like an iris onto Home
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

    private val colors = Ui.c
    private var t = 0f
    private var animator: ValueAnimator? = null
    private var revealed = false
    private var finished = false
    private var exitFrom: FloatArray? = null

    // Geometry, set in onSizeChanged.
    private var emblemSize = 0
    private var cx = 0f
    private var cy = 0f
    private var r = 0f
    private var greenR = 0f
    private var goldR = 0f
    private var tickIn = 0f
    private var irisMax = 0f
    private var titleTop = 0f
    private var placeTop = 0f
    private var ruleY = 0f
    private var cometR = 0f

    private val bg = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = colors.bg }
    private val spot = Paint(Paint.ANTI_ALIAS_FLAG)
    private val halo = Paint(Paint.ANTI_ALIAS_FLAG)
    private val rays = Paint(Paint.ANTI_ALIAS_FLAG)
    private val rayPath = Path()
    private val ring = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        style = Paint.Style.STROKE
        strokeCap = Paint.Cap.ROUND
    }
    private val tick = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        style = Paint.Style.STROKE
        strokeCap = Paint.Cap.ROUND
    }
    private val greenComet = Paint(Paint.ANTI_ALIAS_FLAG)
    private val goldComet = Paint(Paint.ANTI_ALIAS_FLAG)
    private val core = Paint(Paint.ANTI_ALIAS_FLAG)
    private val spark = Paint(Paint.ANTI_ALIAS_FLAG)
    private val star = Path()
    private val shine = Paint(Paint.ANTI_ALIAS_FLAG)
    private var shineShader: LinearGradient? = null
    private val shineMatrix = Matrix()
    private val clip = Path()
    private val iris = Path()
    private val oval = RectF()

    private val textScale = context.resources.configuration.fontScale.coerceIn(1f, 1.3f)
    private val title = Word("AL-AMEEN ACADEMY", context.dpf(17) * textScale, colors.text, 0.62f, 0.18f, 880f)
    private val place = Word("BADARPUR", context.dpf(13) * textScale, colors.goldText, 0.95f, 0.34f, 970f)
    private val letter = Paint(Paint.ANTI_ALIAS_FLAG).apply { typeface = Fonts.sansSemibold }

    private var sparks: List<Spark> = emptyList()

    init {
        setWillNotDraw(false)
        isClickable = true
        contentDescription = "Al-Ameen Academy, Badarpur"
        addView(emblem, flp())
        emblem.alpha = 0f
        setOnClickListener { skip() }
        title.measure(letter)
        place.measure(letter)
        buildStar()
    }

    override fun onSizeChanged(w: Int, h: Int, oldw: Int, oldh: Int) {
        emblemSize = min((min(w, h) * if (w > h) 0.42f else 0.5f).toInt(), dp(236))
        val top = (h * 0.42f).toInt() - emblemSize / 2
        emblem.layoutParams = flp(emblemSize, emblemSize, Gravity.CENTER_HORIZONTAL).apply { topMargin = top }
        cx = w / 2f
        cy = top + emblemSize / 2f
        r = emblemSize / 2f
        greenR = r + dpf(10)
        goldR = r + dpf(16)
        tickIn = r + dpf(22)
        irisMax = hypot(max(cx, w - cx), max(cy, h - cy)) + dpf(8)
        titleTop = top + emblemSize + dpf(58)
        placeTop = titleTop + dpf(27)
        ruleY = placeTop + dpf(28)
        cometR = dpf(11)
        buildShaders(w, h)
        buildSparks()
        post { requestLayout() }
    }

    private fun buildShaders(w: Int, h: Int) {
        val c = colors
        val spotColor = if (c.dark) Ui.withAlpha(c.green, 0.42f) else Ui.withAlpha(WHITE, 0.85f)
        spot.shader = RadialGradient(cx, cy, max(w, h) * 0.62f, spotColor, Ui.withAlpha(spotColor, 0f), Shader.TileMode.CLAMP)
        halo.shader = RadialGradient(
            cx, cy, r * 1.9f,
            intArrayOf(Ui.withAlpha(c.gold, 0f), Ui.withAlpha(c.gold, if (c.dark) 0.2f else 0.26f), Ui.withAlpha(c.gold, 0f)),
            floatArrayOf(0.42f, 0.56f, 1f), Shader.TileMode.CLAMP,
        )
        val reach = r * 2.6f
        rays.shader = RadialGradient(
            cx, cy, reach,
            intArrayOf(Ui.withAlpha(c.gold, 0f), Ui.withAlpha(c.gold, if (c.dark) 0.24f else 0.26f), Ui.withAlpha(c.gold, 0f)),
            floatArrayOf(0.3f, 0.42f, 1f), Shader.TileMode.CLAMP,
        )
        // Eighteen thin wedges, alternating long and short, pointing out from the emblem.
        rayPath.reset()
        val n = 18
        for (i in 0 until n) {
            val a = (i * 360f / n) * DEG
            val half = (if (i % 2 == 0) 3.2f else 1.8f) * DEG
            val len = if (i % 2 == 0) reach else reach * 0.78f
            rayPath.moveTo(cx + cos(a) * r * 0.9f, cy + sin(a) * r * 0.9f)
            rayPath.lineTo(cx + cos(a - half) * len, cy + sin(a - half) * len)
            rayPath.lineTo(cx + cos(a + half) * len, cy + sin(a + half) * len)
            rayPath.close()
        }
        greenComet.shader = RadialGradient(0f, 0f, cometR, Ui.withAlpha(c.greenText, 0.75f), Ui.withAlpha(c.greenText, 0f), Shader.TileMode.CLAMP)
        goldComet.shader = RadialGradient(0f, 0f, cometR, Ui.withAlpha(c.gold, 0.9f), Ui.withAlpha(c.gold, 0f), Shader.TileMode.CLAMP)
        val band = emblemSize * 0.24f
        shineShader = LinearGradient(
            -band, 0f, band, 0f,
            intArrayOf(0x00FFFFFF, 0x80FFFFFF.toInt(), 0x00FFFFFF),
            floatArrayOf(0f, 0.5f, 1f), Shader.TileMode.CLAMP,
        )
        shine.shader = shineShader
    }

    /** A four-point star, two units across, centred on the origin. */
    private fun buildStar() {
        star.reset()
        star.moveTo(0f, -1f)
        star.quadTo(0.12f, -0.12f, 1f, 0f)
        star.quadTo(0.12f, 0.12f, 0f, 1f)
        star.quadTo(-0.12f, 0.12f, -1f, 0f)
        star.quadTo(-0.12f, -0.12f, 0f, -1f)
        star.close()
    }

    private fun buildSparks() {
        val c = colors
        val palette = if (c.dark) intArrayOf(c.gold, c.goldText, c.onGreen, c.greenText) else intArrayOf(c.gold, c.gold, c.goldText, c.greenText)
        // Seeded with the school's founding year, so every launch (and every screenshot) matches.
        val rnd = Random(1994)
        sparks = List(46) {
            Spark(
                angle = rnd.nextFloat() * 360f * DEG,
                speed = dpf(70 + rnd.nextFloat() * 150),
                drift = (rnd.nextFloat() - 0.5f) * 0.9f,
                size = dpf(1.2f + rnd.nextFloat() * 2.2f),
                life = 800f + rnd.nextFloat() * 750f,
                delay = rnd.nextFloat() * 160f,
                color = palette[rnd.nextInt(palette.size)],
                star = rnd.nextInt(4) == 0,
                twinkle = rnd.nextFloat() * 6.28f,
                fromGold = rnd.nextBoolean(),
            )
        }
    }

    fun play() {
        if (animator != null) return
        run(0f)
    }

    /** Tap to skip: jump straight to the exit. */
    fun skip() {
        val a = animator ?: return
        if ((a.animatedValue as Float) >= EXIT) return
        // A fresh animator for just the exit, rather than seeking the running one.
        a.removeAllUpdateListeners()
        a.cancel()
        run(EXIT)
    }

    private fun run(from: Float) {
        animator = ValueAnimator.ofFloat(from, TOTAL).apply {
            duration = (TOTAL - from).toLong()
            interpolator = LinearInterpolator()
            addUpdateListener { apply(it.animatedValue as Float) }
            start()
        }
    }

    private fun apply(time: Float) {
        t = time
        emblem.alpha = Ease.cubicOut(window(t, 120f, 300f))
        if (t >= EXIT) {
            if (!revealed) {
                revealed = true
                emblem.scaleX = 1f
                emblem.scaleY = 1f
                exitFrom = exitTransform()
                onReveal?.invoke()
            }
            val move = Ease.cubicInOut(window(t, EXIT, 450f))
            val f = exitFrom
            if (f != null) {
                emblem.scaleX = 1f + (f[2] - 1f) * move
                emblem.scaleY = emblem.scaleX
                emblem.translationX = f[0] * move
                emblem.translationY = f[1] * move
            }
        } else {
            // Springs up from 70 %, overshooting a touch before it settles.
            val scale = 0.7f + 0.3f * spring(window(t, 120f, 700f), 0.58f)
            emblem.scaleX = scale
            emblem.scaleY = scale
        }
        invalidate()
        if (t >= TOTAL) finish()
    }

    // ------------------------------------------------------------------ drawing

    override fun onDraw(canvas: Canvas) {
        if (width == 0) return
        val c = colors
        val w = width.toFloat()
        val h = height.toFloat()
        val out = 1f - window(t, EXIT, 200f)

        // Background, opening like an iris during the exit.
        val open = Ease.cubicIn(window(t, EXIT + 50f, 420f))
        bg.alpha = (255 * (1f - window(t, TOTAL - 110f, 110f))).toInt()
        if (open <= 0f) {
            canvas.drawRect(0f, 0f, w, h, bg)
        } else {
            iris.reset()
            iris.fillType = Path.FillType.EVEN_ODD
            iris.addRect(0f, 0f, w, h, Path.Direction.CW)
            iris.addCircle(cx, cy, open * irisMax, Path.Direction.CW)
            canvas.drawPath(iris, bg)
            ring.color = Ui.withAlpha(c.gold, 0.55f * (1f - open))
            ring.strokeWidth = dpf(2.5f)
            canvas.drawCircle(cx, cy, open * irisMax, ring)
        }
        if (out <= 0f) return

        // Spotlight and halo; the halo flares on impact.
        spot.alpha = (255 * Ease.cubicOut(window(t, 0f, 600f)) * out).toInt()
        canvas.drawRect(0f, 0f, w, h, spot)
        val impact = window(t, 300f, 700f)
        val flare = if (t >= 300f) 0.8f * exp(-impact * 5f) else 0f
        halo.alpha = (255 * (Ease.cubicOut(window(t, 150f, 500f)) * out * (1f + flare)).coerceAtMost(1f)).toInt()
        canvas.save()
        // On exit everything around the emblem bursts gently outward as it fades.
        val burst = 1f + 0.14f * Ease.cubicOut(window(t, EXIT, 360f))
        canvas.scale(burst, burst, cx, cy)
        canvas.drawCircle(cx, cy, r * 1.9f, halo)

        // Light rays, turning slowly.
        rays.alpha = (255 * Ease.cubicOut(window(t, 180f, 720f)) * out).toInt()
        if (rays.alpha > 0) {
            canvas.save()
            canvas.rotate(t * 0.012f, cx, cy)
            canvas.drawPath(rayPath, rays)
            canvas.restore()
        }

        // Rings, traced from the top in opposite directions.
        val greenSweep = 360f * Ease.cubicInOut(window(t, 0f, 850f))
        val goldSweep = 360f * Ease.cubicInOut(window(t, 100f, 800f))
        ring.strokeWidth = dpf(2f)
        ring.color = Ui.withAlpha(c.greenText, out)
        oval.set(cx - greenR, cy - greenR, cx + greenR, cy + greenR)
        if (greenSweep > 0f) canvas.drawArc(oval, -90f, greenSweep, false, ring)
        ring.strokeWidth = dpf(1.3f)
        ring.color = Ui.withAlpha(c.gold, out)
        oval.set(cx - goldR, cy - goldR, cx + goldR, cy + goldR)
        if (goldSweep > 0f) canvas.drawArc(oval, -90f, -goldSweep, false, ring)

        // Bezel ticks light up as the green comet passes them, popping out to length.
        for (k in 0 until 60) {
            val lit = window(greenSweep, k * 6f, 10f)
            if (lit <= 0f) continue
            val major = k % 5 == 0
            val a = (-90f + k * 6f) * DEG
            val len = (if (major) dpf(8) else dpf(4)) * spring(lit, 0.45f)
            tick.strokeWidth = if (major) dpf(1.6f) else dpf(1f)
            tick.color = Ui.withAlpha(if (major) c.gold else c.greenText, lit * out * if (major) 1f else 0.55f)
            val ca = cos(a)
            val sa = sin(a)
            canvas.drawLine(cx + ca * tickIn, cy + sa * tickIn, cx + ca * (tickIn + len), cy + sa * (tickIn + len), tick)
        }

        // Comets at the leading ends while the rings are traced; they meet at the top in a flare.
        drawComet(canvas, greenR, -90f + greenSweep, greenComet, c.greenText, cometFade(0f, 850f) * out)
        drawComet(canvas, goldR, -90f - goldSweep, goldComet, c.gold, cometFade(100f, 800f) * out)
        val meet = window(t, 860f, 420f)
        if (meet > 0f && meet < 1f) {
            spark.color = Ui.withAlpha(c.gold, (1f - meet) * out)
            canvas.save()
            canvas.translate(cx, cy - goldR)
            val size = dpf(9) * spring(meet, 0.5f) * (1f - 0.5f * meet)
            canvas.rotate(45f * meet)
            canvas.scale(size, size)
            canvas.drawPath(star, spark)
            canvas.restore()
        }

        // Shockwave on impact.
        if (t >= 300f && impact < 1f) {
            val e = Ease.cubicOut(impact)
            ring.strokeWidth = dpf(3.5f) * (1f - e) + dpf(0.6f)
            ring.color = Ui.withAlpha(c.gold, 0.6f * (1f - impact) * out)
            canvas.drawCircle(cx, cy, r * (1.02f + 0.95f * e), ring)
        }

        // Sparks thrown off the rings.
        for (p in sparks) drawSpark(canvas, p, out)
        canvas.restore()
    }

    override fun dispatchDraw(canvas: Canvas) {
        super.dispatchDraw(canvas)
        if (width == 0) return
        val out = 1f - window(t, EXIT, 200f)
        // One bright highlight across the emblem, clipped to its circle.
        val h = window(t, 820f, 450f)
        if (h > 0f && h < 1f && out > 0f) {
            clip.reset()
            clip.addCircle(cx, cy, r * emblem.scaleX, Path.Direction.CW)
            canvas.save()
            canvas.clipPath(clip)
            val band = emblemSize * 0.24f
            val x = cx - r - band + (emblemSize + band * 2) * Ease.cubicInOut(h)
            shineMatrix.setTranslate(x, 0f)
            shineMatrix.postRotate(-18f, cx, cy)
            shineShader?.setLocalMatrix(shineMatrix)
            canvas.drawRect(cx - r, cy - r, cx + r, cy + r, shine)
            canvas.restore()
        }
        if (out <= 0f) return
        drawWord(canvas, title, titleTop, out)
        drawWord(canvas, place, placeTop, out)
        // A short gold rule, with a small diamond at its centre, grows out under the name.
        val g = Ease.quintOut(window(t, 1080f, 420f))
        if (g > 0f) {
            tick.strokeWidth = dpf(1.5f)
            tick.color = Ui.withAlpha(colors.gold, out)
            val half = dpf(26) * g
            canvas.drawLine(cx - half, ruleY, cx + half, ruleY, tick)
            core.color = Ui.withAlpha(colors.gold, out * g)
            canvas.save()
            canvas.translate(cx, ruleY)
            canvas.rotate(45f)
            val d = dpf(2.6f) * g
            canvas.drawRect(-d, -d, d, d, core)
            canvas.restore()
        }
    }

    private fun cometFade(start: Float, length: Float): Float {
        if (t < start) return 0f
        val p = (t - start) / length
        return if (p <= 1f) window(p, 0f, 0.08f) else 1f - window(t, start + length, 220f)
    }

    private fun drawComet(canvas: Canvas, radius: Float, angleDeg: Float, glow: Paint, color: Int, alpha: Float) {
        if (alpha <= 0f) return
        val a = angleDeg * DEG
        canvas.save()
        canvas.translate(cx + cos(a) * radius, cy + sin(a) * radius)
        glow.alpha = (255 * alpha).toInt()
        canvas.drawCircle(0f, 0f, cometR, glow)
        core.color = Ui.withAlpha(if (colors.dark) colors.onGreen else WHITE, alpha)
        canvas.drawCircle(0f, 0f, dpf(2f), core)
        core.color = Ui.withAlpha(color, alpha * 0.9f)
        canvas.drawCircle(0f, 0f, dpf(1.2f), core)
        canvas.restore()
    }

    private fun drawSpark(canvas: Canvas, p: Spark, out: Float) {
        val age = t - 300f - p.delay
        if (age <= 0f || age >= p.life) return
        val s = age / 1000f
        // Flies outward against air drag, curling slightly and floating upward.
        val k = 2.4f
        val dist = (if (p.fromGold) goldR else greenR) + p.speed * (1f - exp(-k * s)) / k
        val a = p.angle + p.drift * s
        val x = cx + cos(a) * dist
        val y = cy + sin(a) * dist - dpf(14) * s * s
        val life = age / p.life
        val alpha = window(age, 0f, 60f) * (1f - window(life, 0.55f, 0.45f)) * (0.65f + 0.35f * sin(p.twinkle + age * 0.02f)) * out
        if (alpha <= 0.01f) return
        spark.color = Ui.withAlpha(p.color, alpha)
        if (p.star) {
            canvas.save()
            canvas.translate(x, y)
            val size = p.size * 2.2f
            canvas.scale(size, size)
            canvas.drawPath(star, spark)
            canvas.restore()
        } else {
            canvas.drawCircle(x, y, p.size * (1f - 0.4f * life), spark)
        }
    }

    /** Letters gather in from wide tracking, the middle ones appearing first. */
    private fun drawWord(canvas: Canvas, word: Word, top: Float, out: Float) {
        if (t < word.start) return
        val p = Ease.quintOut(window(t, word.start, 560f))
        val spacing = lerp(word.spacingFrom, word.spacingTo, p) * word.size
        letter.textSize = word.size
        val n = word.text.length
        var total = spacing * (n - 1)
        for (i in 0 until n) total += word.widths[i]
        var x = cx - total / 2f
        val baseline = top - letter.ascent()
        val middle = (n - 1) / 2f
        for (i in 0 until n) {
            val d = if (middle > 0f) abs(i - middle) / middle else 0f
            val a = Ease.cubicOut(window(t, word.start + d * 110f, 260f)) * out
            if (a > 0f) {
                letter.color = Ui.withAlpha(word.color, a)
                canvas.drawText(word.text, i, i + 1, x, baseline + dpf(7) * (1f - a), letter)
            }
            x += word.widths[i] + spacing
        }
    }

    /** dx, dy and scale that land the emblem exactly on the header emblem, or a gentle fade-up. */
    private fun exitTransform(): FloatArray? {
        val header = target?.invoke()
        if (header == null || header.width == 0 || emblem.width == 0) return floatArrayOf(0f, -dpf(24), 0.9f)
        val a = IntArray(2)
        val b = IntArray(2)
        header.getLocationInWindow(a)
        // getLocationInWindow includes the current transform; the emblem is at scale 1 here.
        emblem.getLocationInWindow(b)
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

    private class Spark(
        val angle: Float,
        val speed: Float,
        val drift: Float,
        val size: Float,
        val life: Float,
        val delay: Float,
        val color: Int,
        val star: Boolean,
        val twinkle: Float,
        val fromGold: Boolean,
    )

    private class Word(
        val text: String,
        val size: Float,
        val color: Int,
        val spacingFrom: Float,
        val spacingTo: Float,
        val start: Float,
    ) {
        val widths = FloatArray(text.length)

        fun measure(paint: Paint) {
            paint.textSize = size
            for (i in text.indices) widths[i] = paint.measureText(text, i, i + 1)
        }
    }

    companion object {
        const val TOTAL = 2050f
        const val EXIT = 1550f
        private const val DEG = (Math.PI / 180.0).toFloat()
        private const val WHITE = -0x1 // 0xFFFFFFFF
    }
}

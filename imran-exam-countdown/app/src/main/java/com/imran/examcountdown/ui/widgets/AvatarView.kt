package com.imran.examcountdown.ui.widgets

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapShader
import android.graphics.Canvas
import android.graphics.ColorFilter
import android.graphics.LinearGradient
import android.graphics.Matrix
import android.graphics.Paint
import android.graphics.Path
import android.graphics.PixelFormat
import android.graphics.Rect
import android.graphics.Shader
import android.graphics.SweepGradient
import android.graphics.drawable.Drawable
import android.os.SystemClock
import android.view.View
import com.imran.examcountdown.core.AvatarFrame
import com.imran.examcountdown.ui.Ease
import com.imran.examcountdown.ui.Fonts
import com.imran.examcountdown.ui.Ui
import com.imran.examcountdown.ui.dpf
import com.imran.examcountdown.ui.lerp
import com.imran.examcountdown.ui.lerpColor
import com.imran.examcountdown.ui.window
import kotlin.math.PI
import kotlin.math.cos
import kotlin.math.max
import kotlin.math.min
import kotlin.math.pow
import kotlin.math.sin

/**
 * Imran's avatar: his photo (or his initials) in a circle, with the chosen [frame] round it.
 * Separate from the school emblem.
 *
 * The photo always fills the same inner circle whatever the frame, so switching frames never
 * resizes it, and frames are drawn only in the thin band between that circle and the edge of
 * the view, so they never cover the face or anything next to the avatar. Only the border moves.
 * An animated frame runs on the display's frame clock while the avatar is actually on screen and
 * stops by itself when it isn't (another tab, the app in the background, scrolled out of view).
 * With [animateFrame] off it holds a fixed pose.
 */
class AvatarView(context: Context) : View(context) {

    var initials: String = "IH"
        set(value) {
            field = value
            invalidate()
        }

    /** The border being shown. */
    var frame: AvatarFrame = AvatarFrame.DEFAULT
        private set

    /** Whether an animated frame moves (also needs the avatar on screen); off: a still pose. */
    var animateFrame = false
        set(value) {
            if (field == value) return
            field = value
            // Starting or stopping, cross-fade between the still pose and the moving one.
            if (frame.animated && isAttachedToWindow) startFade(frame, wasMoving = !value)
            invalidate()
        }

    private var photo: Bitmap? = null
    private val photoPaint = Paint(Paint.ANTI_ALIAS_FLAG or Paint.FILTER_BITMAP_FLAG)
    private val disc = Paint(Paint.ANTI_ALIAS_FLAG)
    private val letters = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        textAlign = Paint.Align.CENTER
        typeface = Fonts.serif
    }
    private val photoMatrix = Matrix()

    // Frame drawing.
    private val stroke = Paint(Paint.ANTI_ALIAS_FLAG).apply { style = Paint.Style.STROKE }
    private val fill = Paint(Paint.ANTI_ALIAS_FLAG)
    private val shaded = Paint(Paint.ANTI_ALIAS_FLAG)
    private val path = Path()
    private val shaderMatrix = Matrix()
    private val trails = HashMap<Int, SweepGradient>()
    private var metal: SweepGradient? = null
    private var glint: LinearGradient? = null
    private val visible = Rect()
    private var cx = 0f
    private var cy = 0f

    // Cross-fade from the previous frame (or pose) to the current one.
    private var previous: AvatarFrame? = null
    private var previousMoving = false
    private var fadeStart = 0L
    private var nextDraw = 0L

    val hasPhoto: Boolean get() = photo != null

    /** True while the frame is moving on screen (it then redraws with every display frame). */
    val isFrameMoving: Boolean get() = moving() && isShown

    fun setPhoto(bitmap: Bitmap?) {
        photo = bitmap
        photoPaint.shader = bitmap?.let { BitmapShader(it, Shader.TileMode.CLAMP, Shader.TileMode.CLAMP) }
        updateMatrix()
        invalidate()
    }

    /** Shows [value]; with [animate] the old border cross-fades into the new one. */
    fun setFrame(value: AvatarFrame, animate: Boolean = false) {
        if (value == frame) return
        val old = frame
        frame = value
        if (animate && isAttachedToWindow) startFade(old, wasMoving = animateFrame && old.animated) else previous = null
        invalidate()
    }

    /** Makes [other] show exactly what this avatar shows. */
    fun copyTo(other: AvatarView) {
        other.initials = initials
        other.setPhoto(photo)
        other.setFrame(frame)
        other.animateFrame = animateFrame
    }

    private fun startFade(from: AvatarFrame, wasMoving: Boolean) {
        previous = from
        previousMoving = wasMoving
        fadeStart = SystemClock.uptimeMillis()
    }

    private fun moving(): Boolean = animateFrame && frame.animated

    /** Radius of the photo circle; the frame lives between it and the edge. */
    private fun photoRadius(): Float = min(width, height) / 2f * PHOTO

    override fun onSizeChanged(w: Int, h: Int, oldw: Int, oldh: Int) {
        cx = w / 2f
        cy = h / 2f
        trails.clear()
        metal = null
        glint = null
        updateMatrix()
    }

    /** Scales the square photo to cover the photo circle exactly, centred: never stretched. */
    private fun updateMatrix() {
        val b = photo ?: return
        val size = 2f * photoRadius()
        if (size <= 0f) return
        val scale = size / min(b.width, b.height)
        photoMatrix.setScale(scale, scale)
        photoMatrix.postTranslate((width - b.width * scale) / 2f, (height - b.height * scale) / 2f)
        photoPaint.shader?.setLocalMatrix(photoMatrix)
    }

    override fun onDraw(canvas: Canvas) {
        val outer = min(width, height) / 2f
        if (outer <= 0f) return
        val inner = outer * PHOTO
        val c = Ui.c
        if (photo != null) {
            canvas.drawCircle(cx, cy, inner, photoPaint)
        } else {
            disc.color = c.green
            canvas.drawCircle(cx, cy, inner, disc)
            letters.color = c.onGreen
            letters.textSize = inner * 0.8f
            val y = cy - (letters.descent() + letters.ascent()) / 2f
            canvas.drawText(initials, cx, y, letters)
        }
        val now = SystemClock.uptimeMillis()
        val live = moving()
        val old = previous
        val fade = if (old == null) 1f else window((now - fadeStart).toFloat(), 0f, FADE_MS)
        if (old != null && fade < 1f) {
            drawFrame(canvas, old, inner, outer, now, previousMoving, 1f - fade)
        } else {
            previous = null
        }
        drawFrame(canvas, frame, inner, outer, now, live, fade)
        if (live || previous != null) scheduleNext(now, previous != null)
    }

    /** Asks for the next frame, but only while this avatar can actually be seen. */
    private fun scheduleNext(now: Long, fading: Boolean) {
        if (!isShown || windowVisibility != VISIBLE || !getLocalVisibleRect(visible)) return
        if (fading || frame != AvatarFrame.GOLD_SHIMMER) {
            postInvalidateOnAnimation()
            return
        }
        // Gold Shimmer rests between its sweeps: sleep until the next one.
        val into = now % SHIMMER_CYCLE
        if (into < SHIMMER_SWEEP) {
            postInvalidateOnAnimation()
        } else if (nextDraw <= now) {
            nextDraw = now + (SHIMMER_CYCLE - into)
            postInvalidateDelayed(SHIMMER_CYCLE - into)
        }
    }

    // ------------------------------------------------------------------ frames

    private fun drawFrame(canvas: Canvas, f: AvatarFrame, inner: Float, outer: Float, now: Long, live: Boolean, alpha: Float) {
        if (alpha <= 0f) return
        when (f) {
            AvatarFrame.DEFAULT -> drawDefault(canvas, inner, alpha)
            AvatarFrame.GOLD_ORBIT -> drawOrbit(canvas, inner, outer, now, live, alpha)
            AvatarFrame.EMERALD_WAVE -> drawWaves(canvas, inner, outer, now, live, alpha)
            AvatarFrame.TWIN_COMETS -> drawComets(canvas, inner, outer, now, live, alpha)
            AvatarFrame.GOLD_SHIMMER -> drawShimmer(canvas, inner, outer, now, live, alpha)
            AvatarFrame.NONE -> Unit
        }
    }

    /** The original border: one static gold ring, hugging the photo. */
    private fun drawDefault(canvas: Canvas, inner: Float, alpha: Float) {
        val w = max(dpf(1.5f), inner * 0.055f)
        stroke.strokeWidth = w
        stroke.color = Ui.withAlpha(Ui.c.gold, 0.9f * alpha)
        canvas.drawCircle(cx, cy, inner + w / 2f - 0.5f, stroke)
    }

    /** A fine gold border with one bright point and its short fading trail going round clockwise. */
    private fun drawOrbit(canvas: Canvas, inner: Float, outer: Float, now: Long, live: Boolean, alpha: Float) {
        val band = outer - inner
        val mid = inner + band * 0.5f
        val gold = Ui.c.gold
        stroke.strokeWidth = max(dpf(1f), inner * 0.03f)
        stroke.color = Ui.withAlpha(gold, 0.5f * alpha)
        canvas.drawCircle(cx, cy, mid, stroke)
        val angle = if (live) -90f + 360f * fraction(now, ORBIT_MS) else -45f
        comet(canvas, mid, angle, 62f, band * 0.5f, band * 0.08f, gold, 0.95f * alpha)
        // The point: a small soft glow (kept inside the band) round a bright core.
        val a = angle * DEG
        val px = cx + cos(a) * mid
        val py = cy + sin(a) * mid
        fill.color = Ui.withAlpha(gold, 0.35f * alpha)
        canvas.drawCircle(px, py, band * 0.5f, fill)
        fill.color = Ui.withAlpha(lerpColor(gold, WHITE, 0.55f), alpha)
        canvas.drawCircle(px, py, max(dpf(1.2f), band * 0.26f), fill)
    }

    /** Two soft green waves travelling round the circumference, crossing like a woven cord. */
    private fun drawWaves(canvas: Canvas, inner: Float, outer: Float, now: Long, live: Boolean, alpha: Float) {
        val band = outer - inner
        val mid = inner + band * 0.5f
        val w = max(dpf(1.1f), band * 0.2f)
        val halo = w * 1.8f
        val amp = min(band * 0.24f, band * 0.5f - halo / 2f - dpf(0.2f)).coerceAtLeast(0f)
        val phase = if (live) 2f * PI.toFloat() * fraction(now, WAVE_MS) else 0f
        val dark = Ui.c.dark
        val emerald = if (dark) 0xFF4FC48C.toInt() else 0xFF1E8A57.toInt()
        val mint = if (dark) 0xFFA8E5C6.toInt() else 0xFF6FC69A.toInt()
        stroke.strokeCap = Paint.Cap.ROUND
        for (k in 0..1) {
            // The second wave runs half a wavelength behind the first, and a little slower.
            val shift = if (k == 0) phase else phase * 0.8f + PI.toFloat()
            wave(mid, amp, WAVE_CRESTS, shift)
            val color = if (k == 0) emerald else mint
            stroke.strokeWidth = halo
            stroke.color = Ui.withAlpha(color, 0.18f * alpha)
            canvas.drawPath(path, stroke)
            stroke.strokeWidth = w
            stroke.color = Ui.withAlpha(color, (if (k == 0) 0.95f else 0.8f) * alpha)
            canvas.drawPath(path, stroke)
        }
        stroke.strokeCap = Paint.Cap.BUTT
    }

    private fun wave(mid: Float, amp: Float, crests: Int, shift: Float) {
        path.reset()
        val steps = 144
        for (i in 0..steps) {
            val theta = 2f * PI.toFloat() * i / steps
            val radius = mid + amp * sin(crests * theta - shift)
            val x = cx + cos(theta) * radius
            val y = cy + sin(theta) * radius
            if (i == 0) path.moveTo(x, y) else path.lineTo(x, y)
        }
        path.close()
    }

    /** A green and a gold comet orbiting opposite one another, clockwise, over a faint ring. */
    private fun drawComets(canvas: Canvas, inner: Float, outer: Float, now: Long, live: Boolean, alpha: Float) {
        val band = outer - inner
        val mid = inner + band * 0.5f
        val gold = Ui.c.gold
        val green = if (Ui.c.dark) 0xFF5CCB95.toInt() else 0xFF2B9A63.toInt()
        stroke.strokeWidth = max(dpf(0.8f), inner * 0.02f)
        stroke.color = Ui.withAlpha(gold, 0.16f * alpha)
        canvas.drawCircle(cx, cy, mid, stroke)
        // At rest: green at top left, gold at bottom right.
        val angle = if (live) -135f + 360f * fraction(now, COMETS_MS) else -135f
        for (k in 0..1) {
            val head = angle + 180f * k
            val color = if (k == 0) green else gold
            comet(canvas, mid, head, 110f, band * 0.52f, band * 0.06f, color, 0.85f * alpha)
            val a = head * DEG
            fill.color = Ui.withAlpha(lerpColor(color, WHITE, 0.35f), alpha)
            canvas.drawCircle(cx + cos(a) * mid, cy + sin(a) * mid, max(dpf(1.1f), band * 0.24f), fill)
        }
    }

    /** A metallic gold border; now and then a light sweeps across it. */
    private fun drawShimmer(canvas: Canvas, inner: Float, outer: Float, now: Long, live: Boolean, alpha: Float) {
        val band = outer - inner
        val w = max(dpf(2f), band * 0.62f).coerceAtMost(band)
        val radius = inner + w / 2f - 0.5f
        val gold = Ui.c.gold
        val shader = metal ?: SweepGradient(
            cx, cy,
            intArrayOf(
                lerpColor(gold, BLACK, 0.28f), gold, lerpColor(gold, WHITE, 0.55f), gold,
                lerpColor(gold, BLACK, 0.3f), gold, lerpColor(gold, WHITE, 0.4f), gold,
                lerpColor(gold, BLACK, 0.28f),
            ),
            null,
        ).also {
            it.setLocalMatrix(Matrix().apply { setRotate(-30f, cx, cy) })
            metal = it
        }
        shaded.style = Paint.Style.STROKE
        shaded.strokeWidth = w
        shaded.shader = shader
        shaded.alpha = (255 * alpha).toInt()
        canvas.drawCircle(cx, cy, radius, shaded)
        // A thin darker line on the outside edge gives the band a bevel.
        stroke.strokeWidth = max(dpf(0.6f), w * 0.12f)
        stroke.color = Ui.withAlpha(lerpColor(gold, BLACK, 0.35f), 0.55f * alpha)
        canvas.drawCircle(cx, cy, radius + w / 2f - stroke.strokeWidth / 2f, stroke)
        if (!live) return
        val sweep = window((now % SHIMMER_CYCLE).toFloat(), 0f, SHIMMER_SWEEP.toFloat())
        if (sweep <= 0f || sweep >= 1f) return
        // The light crosses from top left to bottom right, lighting only the band.
        val light = glint ?: LinearGradient(
            -outer * 0.35f, 0f, outer * 0.35f, 0f,
            intArrayOf(0x00FFFFFF, 0xE6FFFFFF.toInt(), 0x00FFFFFF), null, Shader.TileMode.CLAMP,
        ).also { glint = it }
        val travel = -outer * 1.4f + outer * 2.8f * Ease.cubicInOut(sweep)
        shaderMatrix.setTranslate(cx + travel, cy)
        shaderMatrix.postRotate(45f, cx, cy)
        light.setLocalMatrix(shaderMatrix)
        shaded.shader = light
        shaded.alpha = (255 * alpha * (if (Ui.c.dark) 0.75f else 0.9f)).toInt()
        canvas.drawCircle(cx, cy, radius, shaded)
    }

    /**
     * A tapered trail along the circle of [radius], ending in its head at [headDeg] (moving
     * clockwise, so the trail lies behind it anticlockwise) and fading out over [spanDeg].
     */
    private fun comet(canvas: Canvas, radius: Float, headDeg: Float, spanDeg: Float, headW: Float, tailW: Float, color: Int, alpha: Float) {
        path.reset()
        val steps = 28
        for (i in 0..steps) {
            val f = i / steps.toFloat()
            val a = (headDeg - spanDeg * (1f - f)) * DEG
            val half = lerp(tailW, headW, f.pow(1.4f)) / 2f
            val x = cx + cos(a) * (radius + half)
            val y = cy + sin(a) * (radius + half)
            if (i == 0) path.moveTo(x, y) else path.lineTo(x, y)
        }
        for (i in steps downTo 0) {
            val f = i / steps.toFloat()
            val a = (headDeg - spanDeg * (1f - f)) * DEG
            val half = lerp(tailW, headW, f.pow(1.4f)) / 2f
            path.lineTo(cx + cos(a) * (radius - half), cy + sin(a) * (radius - half))
        }
        path.close()
        val gradient = trails.getOrPut(color * 31 + spanDeg.toInt()) {
            SweepGradient(
                cx, cy,
                intArrayOf(Ui.withAlpha(color, 0f), Ui.withAlpha(color, 1f), Ui.withAlpha(color, 1f)),
                floatArrayOf(0f, spanDeg / 360f, 1f),
            )
        }
        shaderMatrix.setRotate(headDeg - spanDeg, cx, cy)
        gradient.setLocalMatrix(shaderMatrix)
        shaded.style = Paint.Style.FILL
        shaded.shader = gradient
        shaded.alpha = (255 * alpha).toInt()
        canvas.drawPath(path, shaded)
    }

    private fun fraction(now: Long, period: Long): Float = (now % period) / period.toFloat()

    companion object {
        /** The photo's share of the avatar's radius; the frame lives in the rest. */
        const val PHOTO = 0.86f

        private const val FADE_MS = 180f
        private const val ORBIT_MS = 3600L
        /** One wavelength passes a point in this time; the pattern goes round in 6 × this. */
        private const val WAVE_MS = 1500L
        private const val WAVE_CRESTS = 6
        private const val COMETS_MS = 4800L
        private const val SHIMMER_CYCLE = 4800L
        private const val SHIMMER_SWEEP = 1100L
        private const val DEG = (PI / 180.0).toFloat()
        private const val WHITE = -0x1 // 0xFFFFFFFF
        private const val BLACK = -0x1000000 // 0xFF000000
    }
}

/**
 * A thin gold ring that spreads out from an avatar's border and fades, drawn in an overlay so
 * nothing clips it. Set [progress] from 0 to 1.
 */
class GoldRipple(
    private val cx: Float,
    private val cy: Float,
    private val from: Float,
    private val reach: Float,
    private val color: Int,
    private val strokePx: Float,
) : Drawable() {

    var progress = 0f
        set(value) {
            field = value
            invalidateSelf()
        }

    private val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply { style = Paint.Style.STROKE }

    init {
        val edge = from + reach + strokePx
        setBounds((cx - edge).toInt(), (cy - edge).toInt(), (cx + edge).toInt() + 1, (cy + edge).toInt() + 1)
    }

    override fun draw(canvas: Canvas) {
        if (progress <= 0f || progress >= 1f) return
        paint.strokeWidth = strokePx * (1f - 0.5f * progress)
        paint.color = Ui.withAlpha(color, 0.9f * (1f - progress).pow(1.3f))
        canvas.drawCircle(cx, cy, from + reach * Ease.cubicOut(progress), paint)
    }

    override fun setAlpha(alpha: Int) = Unit
    override fun setColorFilter(colorFilter: ColorFilter?) = Unit

    @Deprecated("Deprecated in Java")
    override fun getOpacity(): Int = PixelFormat.TRANSLUCENT
}

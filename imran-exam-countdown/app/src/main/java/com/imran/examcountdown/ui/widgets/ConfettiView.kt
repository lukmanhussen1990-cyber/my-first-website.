package com.imran.examcountdown.ui.widgets

import android.content.Context
import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.Path
import android.graphics.RadialGradient
import android.graphics.RectF
import android.graphics.Shader
import android.os.SystemClock
import android.view.View
import com.imran.examcountdown.ui.Ease
import com.imran.examcountdown.ui.Ui
import com.imran.examcountdown.ui.dpf
import com.imran.examcountdown.ui.lerpColor
import com.imran.examcountdown.ui.window
import kotlin.math.abs
import kotlin.math.cos
import kotlin.math.exp
import kotlin.math.max
import kotlin.math.sin
import kotlin.math.sqrt
import kotlin.random.Random

/**
 * Celebrations, drawn over the whole app in school colours only (gold, green and ivory).
 *
 * [burst] is the big show when the exam season is over: confetti cannons fire from both bottom
 * corners, three fireworks rise and explode into trails of sparks, and gold glitter drifts down;
 * everything tumbles in 3D (the back of each piece is shaded) and fades away after a few seconds.
 * [burstAt] is a small pop from one point, for ticking something off.
 */
class ConfettiView(context: Context) : View(context) {

    private class Piece(
        var x: Float,
        var y: Float,
        var vx: Float,
        var vy: Float,
        var rotation: Float,
        val spin: Float,
        var flip: Float,
        val flipSpeed: Float,
        val w: Float,
        val h: Float,
        val color: Int,
        val back: Int,
        val shape: Int,
        val wobble: Float,
        val born: Long,
        val life: Long,
    )

    private class Spark(
        var x: Float,
        var y: Float,
        var vx: Float,
        var vy: Float,
        var px: Float,
        var py: Float,
        val color: Int,
        val size: Float,
        val born: Long,
        val life: Long,
        val drag: Float,
        val twinkle: Float,
    )

    /** A firework on its way up; it becomes sparks at [explodeAt]. */
    private class Shell(
        val x0: Float,
        val y0: Float,
        val x1: Float,
        val y1: Float,
        val launch: Long,
        val explodeAt: Long,
        val count: Int,
        val ring: Boolean,
        var exploded: Boolean = false,
    )

    private class Flash(val x: Float, val y: Float, val born: Long, val radius: Float)

    private val pieces = ArrayList<Piece>()
    private val sparks = ArrayList<Spark>()
    private val shells = ArrayList<Shell>()
    private val flashes = ArrayList<Flash>()
    private val paint = Paint(Paint.ANTI_ALIAS_FLAG)
    private val line = Paint(Paint.ANTI_ALIAS_FLAG).apply { strokeCap = Paint.Cap.ROUND }
    private val glow = Paint(Paint.ANTI_ALIAS_FLAG)
    private val rect = RectF()
    private val star = Path()
    private val random = Random(SystemClock.uptimeMillis())
    private var last = 0L
    private var until = 0L
    private var fadeFrom = 0L

    init {
        importantForAccessibility = IMPORTANT_FOR_ACCESSIBILITY_NO
        isClickable = false
        star.moveTo(0f, -1f)
        star.quadTo(0.14f, -0.14f, 1f, 0f)
        star.quadTo(0.14f, 0.14f, 0f, 1f)
        star.quadTo(-0.14f, 0.14f, -1f, 0f)
        star.quadTo(-0.14f, -0.14f, 0f, -1f)
        star.close()
    }

    /** True while a celebration is on screen. */
    val isRunning: Boolean get() = SystemClock.uptimeMillis() < until && (pieces.isNotEmpty() || sparks.isNotEmpty() || shells.isNotEmpty())

    /** The full show: cannons, fireworks and glitter (about 4.5 s). */
    fun burst() {
        if (width == 0 || height == 0) {
            post { burst() }
            return
        }
        clear()
        val now = SystemClock.uptimeMillis()
        val w = width.toFloat()
        val h = height.toFloat()
        // Cannons from both bottom corners.
        repeat(150) { i ->
            val fromLeft = i % 2 == 0
            val angle = Math.toRadians(if (fromLeft) -62.0 + random.nextDouble(-17.0, 17.0) else -118.0 + random.nextDouble(-17.0, 17.0))
            val speed = dpf(900 + random.nextFloat() * 750)
            addPiece(
                x = if (fromLeft) -dpf(8) else w + dpf(8),
                y = h * (0.8f + random.nextFloat() * 0.12f),
                vx = (cos(angle) * speed).toFloat(),
                vy = (sin(angle) * speed).toFloat(),
                born = now + random.nextLong(0, 140),
                life = 4200L,
            )
        }
        // Three fireworks, the last one the biggest.
        shells += Shell(w * 0.28f, h, w * 0.3f, h * 0.27f, now + 180, now + 820, 54, ring = false)
        shells += Shell(w * 0.74f, h, w * 0.7f, h * 0.2f, now + 520, now + 1180, 54, ring = false)
        shells += Shell(w * 0.5f, h, w * 0.5f, h * 0.34f, now + 880, now + 1560, 72, ring = true)
        // Glitter drifting down from the top.
        repeat(46) {
            sparks += Spark(
                x = random.nextFloat() * w,
                y = -dpf(10) - random.nextFloat() * h * 0.3f,
                vx = dpf((random.nextFloat() - 0.5f) * 30),
                vy = dpf(60 + random.nextFloat() * 90),
                px = 0f,
                py = 0f,
                color = pick(glitter = true),
                size = dpf(1.1f + random.nextFloat() * 1.6f),
                born = now + random.nextLong(250, 1700),
                life = 2600L,
                drag = 0f,
                twinkle = random.nextFloat() * 6.28f,
            )
        }
        until = now + 4600L
        fadeFrom = now + 3500L
        last = now
        postInvalidateOnAnimation()
    }

    /**
     * A small pop at ([x], [y]) in this view's coordinates: a cone of confetti and sparks
     * (about 1.5 s). [power] scales how many pieces and how high they go.
     */
    fun burstAt(x: Float, y: Float, power: Float = 1f) {
        if (width == 0 || height == 0) return
        val now = SystemClock.uptimeMillis()
        if (!isRunning) clear()
        repeat((26 * power).toInt()) {
            val angle = Math.toRadians(-90.0 + random.nextDouble(-55.0, 55.0))
            val speed = dpf((380 + random.nextFloat() * 520) * sqrt(power))
            addPiece(x, y, (cos(angle) * speed).toFloat(), (sin(angle) * speed).toFloat(), now, 1500L, small = true)
        }
        repeat((18 * power).toInt()) {
            val a = random.nextFloat() * 6.283f
            val speed = dpf((140 + random.nextFloat() * 260) * sqrt(power))
            sparks += Spark(x, y, cos(a) * speed, sin(a) * speed - dpf(80), x, y, pick(glitter = true), dpf(1.3f + random.nextFloat() * 1.4f), now, 700L + random.nextLong(0, 400), 3.2f, random.nextFloat() * 6.28f)
        }
        flashes += Flash(x, y, now, dpf(46) * power)
        until = max(until, now + 1700L)
        fadeFrom = max(fadeFrom, now + 1100L)
        last = if (last == 0L) now else last
        postInvalidateOnAnimation()
    }

    fun stop() {
        clear()
        until = 0L
        invalidate()
    }

    private fun clear() {
        pieces.clear()
        sparks.clear()
        shells.clear()
        flashes.clear()
    }

    private fun pick(glitter: Boolean = false): Int {
        val c = Ui.c
        val palette = when {
            !glitter -> intArrayOf(c.gold, c.gold, c.goldSoft, c.green, c.greenText, c.onGreen, c.surfaceAlt)
            // Sparks must stand out from the background: deep tones on ivory, light ones at night.
            c.dark -> intArrayOf(c.gold, c.gold, c.goldSoft, c.onGreen, c.goldText)
            else -> intArrayOf(c.gold, c.gold, c.goldText, c.green, c.greenText)
        }
        return palette[random.nextInt(palette.size)]
    }

    private fun addPiece(x: Float, y: Float, vx: Float, vy: Float, born: Long, life: Long, small: Boolean = false) {
        val color = pick()
        val shape = when (random.nextInt(10)) {
            0, 1 -> SHAPE_ROUND
            2, 3 -> SHAPE_RIBBON
            4 -> SHAPE_STAR
            else -> SHAPE_RECT
        }
        val scale = if (small) 0.8f else 1f
        val (w, h) = when (shape) {
            SHAPE_RIBBON -> dpf(3.2f) to dpf(14 + random.nextFloat() * 8)
            SHAPE_STAR -> dpf(6 + random.nextFloat() * 3) to 0f
            else -> dpf(6 + random.nextFloat() * 6) to dpf(9 + random.nextFloat() * 8)
        }
        pieces += Piece(
            x = x, y = y, vx = vx, vy = vy,
            rotation = random.nextFloat() * 360f,
            spin = (random.nextFloat() - 0.5f) * 720f,
            flip = random.nextFloat() * 6.28f,
            flipSpeed = 4f + random.nextFloat() * 8f,
            w = w * scale,
            h = h * scale,
            color = if (shape == SHAPE_STAR) Ui.c.gold else color,
            back = lerpColor(color, 0xFF000000.toInt(), 0.28f),
            shape = shape,
            wobble = random.nextFloat() * 6.28f,
            born = born,
            life = life,
        )
    }

    private fun explode(s: Shell, now: Long) {
        s.exploded = true
        val c = Ui.c
        val palette = if (c.dark) intArrayOf(c.gold, c.goldSoft, c.onGreen, c.gold, c.greenText) else intArrayOf(c.gold, c.goldText, c.green, c.gold, c.greenText)
        for (i in 0 until s.count) {
            val a = (i.toFloat() / s.count) * 6.283f + random.nextFloat() * 0.12f
            // A ring shell throws its sparks at an even speed (a clean circle); others vary.
            val speed = dpf(if (s.ring) 330f + random.nextFloat() * 40f else 120f + random.nextFloat() * 260f)
            sparks += Spark(
                s.x1, s.y1, cos(a) * speed, sin(a) * speed, s.x1, s.y1,
                palette[random.nextInt(palette.size)], dpf(1.6f + random.nextFloat() * 1.4f),
                now, 950L + random.nextLong(0, 550), 1.9f, random.nextFloat() * 6.28f,
            )
        }
        if (s.ring) {
            // A few golden stars fall from the heart of the big one.
            repeat(10) { addPiece(s.x1, s.y1, dpf((random.nextFloat() - 0.5f) * 300), dpf(-random.nextFloat() * 260), now, 2600L) }
        }
        flashes += Flash(s.x1, s.y1, now, dpf(if (s.ring) 150 else 110))
    }

    override fun onDraw(canvas: Canvas) {
        val now = SystemClock.uptimeMillis()
        if (now >= until) {
            if (pieces.isNotEmpty() || sparks.isNotEmpty() || shells.isNotEmpty()) clear()
            return
        }
        val dt = ((now - last).coerceIn(0, 50)) / 1000f
        last = now
        val fade = 1f - window((now - fadeFrom).toFloat(), 0f, (until - fadeFrom).toFloat())
        val gravity = dpf(1150)

        // Flashes: a soft bloom where something bursts.
        val fi = flashes.iterator()
        while (fi.hasNext()) {
            val f = fi.next()
            val age = (now - f.born) / 380f
            if (age >= 1f) {
                fi.remove()
                continue
            }
            glow.shader = RadialGradient(f.x, f.y, f.radius * (0.6f + 0.4f * Ease.cubicOut(age)), Ui.withAlpha(Ui.c.goldSoft, 0.5f * (1f - age) * fade), 0, Shader.TileMode.CLAMP)
            canvas.drawCircle(f.x, f.y, f.radius, glow)
        }

        // Rising fireworks with a glowing trail.
        for (s in shells) {
            if (s.exploded || now < s.launch) continue
            if (now >= s.explodeAt) {
                explode(s, now)
                continue
            }
            val p = Ease.cubicOut((now - s.launch).toFloat() / (s.explodeAt - s.launch))
            val x = s.x0 + (s.x1 - s.x0) * p
            val y = s.y0 + (s.y1 - s.y0) * p
            val tail = dpf(46) * (1f - p * 0.7f)
            line.strokeWidth = dpf(2.4f)
            line.color = Ui.withAlpha(Ui.c.gold, 0.45f * fade)
            canvas.drawLine(x, y, x - (s.x1 - s.x0) * 0.04f, y + tail, line)
            paint.color = Ui.withAlpha(Ui.c.goldSoft, fade)
            canvas.drawCircle(x, y, dpf(2.6f), paint)
        }
        shells.removeAll { it.exploded }

        // Sparks and glitter, with short streaks showing their motion.
        val si = sparks.iterator()
        while (si.hasNext()) {
            val s = si.next()
            if (now < s.born) continue
            val age = (now - s.born).toFloat() / s.life
            if (age >= 1f) {
                si.remove()
                continue
            }
            s.px = s.x
            s.py = s.y
            val drag = exp(-s.drag * dt)
            s.vx *= drag
            s.vy = s.vy * drag + (if (s.drag > 0f) gravity * 0.34f else 0f) * dt
            s.x += s.vx * dt
            s.y += s.vy * dt
            if (s.drag == 0f) s.x += sin(age * 9f + s.twinkle) * dpf(0.6f)
            val twinkle = if (age > 0.55f) 0.55f + 0.45f * sin(s.twinkle + age * 40f) else 1f
            val a = (1f - Ease.cubicIn(age)) * twinkle * fade
            if (a <= 0.02f) continue
            if (s.drag > 0f) {
                line.strokeWidth = s.size
                line.color = Ui.withAlpha(s.color, a * 0.55f)
                canvas.drawLine(s.px - (s.x - s.px) * 2.5f, s.py - (s.y - s.py) * 2.5f, s.x, s.y, line)
            }
            paint.color = Ui.withAlpha(s.color, a)
            canvas.drawCircle(s.x, s.y, s.size * (1f - 0.35f * age), paint)
        }

        // Confetti, tumbling in 3D.
        val drag = exp(-1.25f * dt)
        val pi = pieces.iterator()
        while (pi.hasNext()) {
            val p = pi.next()
            if (now < p.born) continue
            val age = now - p.born
            if (age >= p.life || p.y > height + dpf(40)) {
                pi.remove()
                continue
            }
            p.vy += gravity * dt
            p.vx *= drag
            p.vy *= drag
            // Flat pieces flutter sideways as they fall; they never drop faster than paper would.
            val flutter = if (p.vy > 0f) sin(age / 1000f * 5f + p.wobble) * dpf(38) else 0f
            p.vy = p.vy.coerceAtMost(dpf(if (p.shape == SHAPE_RIBBON) 260 else 330))
            p.x += (p.vx + flutter) * dt
            p.y += p.vy * dt
            p.rotation += p.spin * dt
            p.flip += p.flipSpeed * dt
            val lifeFade = 1f - window(age.toFloat(), p.life - 700f, 700f)
            val side = cos(p.flip)
            paint.color = if (side >= 0f || p.shape == SHAPE_STAR) p.color else p.back
            paint.alpha = (255 * fade * lifeFade).toInt()
            canvas.save()
            canvas.translate(p.x, p.y)
            canvas.rotate(p.rotation)
            when (p.shape) {
                SHAPE_STAR -> {
                    val s = p.w * (0.75f + 0.25f * abs(side))
                    canvas.scale(s, s)
                    canvas.drawPath(star, paint)
                }
                SHAPE_ROUND -> {
                    canvas.scale(1f, max(abs(side), 0.08f))
                    rect.set(-p.w / 2, -p.w / 2, p.w / 2, p.w / 2)
                    canvas.drawOval(rect, paint)
                }
                else -> {
                    canvas.scale(max(abs(side), 0.08f), 1f)
                    rect.set(-p.w / 2, -p.h / 2, p.w / 2, p.h / 2)
                    val corner = if (p.shape == SHAPE_RIBBON) p.w / 2 else dpf(1.5f)
                    canvas.drawRoundRect(rect, corner, corner, paint)
                }
            }
            canvas.restore()
        }
        paint.alpha = 255
        postInvalidateOnAnimation()
    }

    companion object {
        private const val SHAPE_RECT = 0
        private const val SHAPE_ROUND = 1
        private const val SHAPE_RIBBON = 2
        private const val SHAPE_STAR = 3
    }
}

package com.imran.examcountdown.ui.widgets

import android.annotation.SuppressLint
import android.content.Context
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Matrix
import android.graphics.Paint
import android.graphics.Path
import android.view.MotionEvent
import android.view.ScaleGestureDetector
import android.view.View
import com.imran.examcountdown.ui.dpf
import kotlin.math.max
import kotlin.math.min

/**
 * Crop a photo to a circle: pinch to zoom, drag to reposition, or use [setZoom] from a slider.
 * The image always covers the whole circle, so the result never has empty corners.
 */
class CropView(context: Context) : View(context) {

    private var bitmap: Bitmap? = null
    private var scale = 1f
    private var minScale = 1f
    private var tx = 0f
    private var ty = 0f
    private var cx = 0f
    private var cy = 0f
    private var radius = 0f

    /** Reports zoom as 0..1 so a slider can follow pinch gestures. */
    var onZoomChanged: ((Float) -> Unit)? = null

    private val drawMatrix = Matrix()
    private val imagePaint = Paint(Paint.FILTER_BITMAP_FLAG or Paint.ANTI_ALIAS_FLAG)
    private val shade = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = 0x99000000.toInt() }
    private val outline = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        style = Paint.Style.STROKE
        strokeWidth = dpf(2)
        color = 0xE6FFFFFF.toInt()
    }
    private val hole = Path()
    private var lastX = 0f
    private var lastY = 0f
    private var dragging = false

    private val scaler = ScaleGestureDetector(context, object : ScaleGestureDetector.SimpleOnScaleGestureListener() {
        override fun onScale(detector: ScaleGestureDetector): Boolean {
            zoomAround(scale * detector.scaleFactor, detector.focusX, detector.focusY)
            return true
        }
    })

    init {
        contentDescription = "Photo crop area. Pinch to zoom and drag to move the photo."
    }

    fun setBitmap(b: Bitmap) {
        bitmap = b
        reset()
    }

    /** Fits the photo to cover the circle, centred. */
    fun reset() {
        val b = bitmap ?: return
        if (radius <= 0f) return
        minScale = max(2 * radius / b.width, 2 * radius / b.height)
        scale = minScale
        tx = cx - b.width * scale / 2f
        ty = cy - b.height * scale / 2f
        onZoomChanged?.invoke(0f)
        invalidate()
    }

    /** [fraction] 0..1 maps to 1x..5x of the covering scale, zooming about the circle centre. */
    fun setZoom(fraction: Float) {
        zoomAround(minScale * (1f + 4f * fraction.coerceIn(0f, 1f)), cx, cy, notify = false)
    }

    private fun zoomAround(target: Float, fx: Float, fy: Float, notify: Boolean = true) {
        val s = target.coerceIn(minScale, minScale * 5f)
        tx = fx - (fx - tx) * (s / scale)
        ty = fy - (fy - ty) * (s / scale)
        scale = s
        clamp()
        if (notify) onZoomChanged?.invoke(((scale / minScale) - 1f) / 4f)
        invalidate()
    }

    /** Keeps the circle fully covered by the photo. */
    private fun clamp() {
        val b = bitmap ?: return
        val w = b.width * scale
        val h = b.height * scale
        tx = tx.coerceIn(cx + radius - w, cx - radius)
        ty = ty.coerceIn(cy + radius - h, cy - radius)
    }

    override fun onSizeChanged(w: Int, h: Int, oldw: Int, oldh: Int) {
        cx = w / 2f
        cy = h / 2f
        radius = min(w, h) / 2f - dpf(16)
        hole.reset()
        hole.fillType = Path.FillType.EVEN_ODD
        hole.addRect(0f, 0f, w.toFloat(), h.toFloat(), Path.Direction.CW)
        hole.addCircle(cx, cy, radius, Path.Direction.CW)
        reset()
    }

    @SuppressLint("ClickableViewAccessibility")
    override fun onTouchEvent(event: MotionEvent): Boolean {
        if (bitmap == null) return false
        scaler.onTouchEvent(event)
        when (event.actionMasked) {
            MotionEvent.ACTION_DOWN -> {
                lastX = event.x
                lastY = event.y
                dragging = true
                parent?.requestDisallowInterceptTouchEvent(true)
            }
            MotionEvent.ACTION_POINTER_DOWN -> dragging = false
            MotionEvent.ACTION_MOVE -> if (dragging && !scaler.isInProgress && event.pointerCount == 1) {
                tx += event.x - lastX
                ty += event.y - lastY
                lastX = event.x
                lastY = event.y
                clamp()
                invalidate()
            }
            MotionEvent.ACTION_POINTER_UP -> {
                // Continue dragging with the finger that remains.
                val remaining = if (event.actionIndex == 0) 1 else 0
                lastX = event.getX(remaining)
                lastY = event.getY(remaining)
                dragging = true
            }
            MotionEvent.ACTION_UP, MotionEvent.ACTION_CANCEL -> {
                dragging = false
                parent?.requestDisallowInterceptTouchEvent(false)
            }
        }
        return true
    }

    override fun onDraw(canvas: Canvas) {
        val b = bitmap ?: return
        drawMatrix.setScale(scale, scale)
        drawMatrix.postTranslate(tx, ty)
        canvas.drawBitmap(b, drawMatrix, imagePaint)
        canvas.drawPath(hole, shade)
        canvas.drawCircle(cx, cy, radius, outline)
    }

    /** The photo inside the circle as a [size]×[size] square (shown in a circle by the avatar). */
    fun result(size: Int = 512): Bitmap? {
        val b = bitmap ?: return null
        val out = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888)
        val c = Canvas(out)
        val left = (cx - radius - tx) / scale
        val top = (cy - radius - ty) / scale
        val side = 2 * radius / scale
        val m = Matrix()
        m.setTranslate(-left, -top)
        m.postScale(size / side, size / side)
        c.drawColor(0xFFFFFFFF.toInt())
        c.drawBitmap(b, m, Paint(Paint.FILTER_BITMAP_FLAG or Paint.ANTI_ALIAS_FLAG))
        return out
    }
}

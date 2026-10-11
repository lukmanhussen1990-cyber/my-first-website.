package com.weplay.guesserai.domain

import kotlin.math.max
import kotlin.math.min

/**
 * Where the drawing canvas and the word hint sit on screen, as [left, top, right, bottom]
 * fractions of the screen. Close-ups of these two areas are what the model sees.
 */
data class ScreenLayout(val canvas: List<Float>, val hint: List<Float>) {

    /** Middle of the hint bar: where the hint text is, without the timer and buttons. */
    val hintCenter: List<Float> get() = listOf(0.3f, hint[1], 0.7f, hint[3])

    companion object {
        // Measured on WePlay "Guess My Drawing" (portrait), in screen widths from the top:
        // the green top bar runs from 0.098 to 0.223, the white canvas below it is 0.864 tall.
        private const val BAR_TOP_W = 0.098f
        private const val BAR_BOTTOM_W = 0.223f
        private const val CANVAS_HEIGHT_W = 0.864f

        /** Hint text spans the middle of the bar; this leaves out the timer (left) and buttons (right). */
        private const val HINT_LEFT = 0.235f
        private const val HINT_RIGHT = 0.80f

        /** Layout of WePlay on a portrait screen with the given height / width ratio, or null for landscape. */
        fun weplayDefault(aspect: Float): ScreenLayout? {
            if (aspect < 1.3f) return null
            val barTop = BAR_TOP_W / aspect
            val barBottom = BAR_BOTTOM_W / aspect
            val canvasBottom = min(1f, (BAR_BOTTOM_W + CANVAS_HEIGHT_W) / aspect)
            return ScreenLayout(
                canvas = listOf(0f, barBottom, 1f, canvasBottom),
                hint = listOf(HINT_LEFT, barTop, HINT_RIGHT, barBottom),
            )
        }

        /**
         * Layout from the model's boxes, or null if they do not look like the game's canvas
         * (e.g. the model outlined the round-over popup).
         */
        fun fromModel(canvasBox: List<Float>?, hintBox: List<Float>?, aspect: Float): ScreenLayout? {
            if (canvasBox == null || canvasBox.size != 4) return null
            val (l, t, r, b) = canvasBox
            val plausible = r - l >= 0.85f && t in 0.03f..0.3f && (b - t) in 0.18f..0.65f
            if (!plausible) return null
            val barHeight = (BAR_BOTTOM_W - BAR_TOP_W) / max(aspect, 1f)
            val hintOk = hintBox != null && hintBox.size == 4 && hintBox[3] <= t + 0.03f && hintBox[3] - hintBox[1] in 0.01f..0.12f
            val hint = if (hintOk) {
                listOf(HINT_LEFT, (hintBox!![1] - 0.01f).coerceAtLeast(0f), HINT_RIGHT, min(t, hintBox[3] + 0.01f))
            } else {
                listOf(HINT_LEFT, (t - barHeight).coerceAtLeast(0f), HINT_RIGHT, t)
            }
            return ScreenLayout(canvas = canvasBox, hint = hint)
        }

        /** Intersection over union of two boxes. */
        fun iou(a: List<Float>, b: List<Float>): Float {
            val iw = (min(a[2], b[2]) - max(a[0], b[0])).coerceAtLeast(0f)
            val ih = (min(a[3], b[3]) - max(a[1], b[1])).coerceAtLeast(0f)
            val inter = iw * ih
            val union = (a[2] - a[0]) * (a[3] - a[1]) + (b[2] - b[0]) * (b[3] - b[1]) - inter
            return if (union <= 0f) 0f else inter / union
        }
    }
}

/**
 * Keeps the current layout. Starts from the measured WePlay layout and only switches to what the
 * model reports when that is plausible, clearly different, and seen on two whole-screen looks in
 * a row — a single odd frame (popup, menu) cannot move the crops any more.
 */
class LayoutLearner(private var aspect: Float) {
    var layout: ScreenLayout? = ScreenLayout.weplayDefault(aspect)
        private set
    private var candidate: ScreenLayout? = null

    /** Screen rotated or resized. */
    fun reset(newAspect: Float) {
        aspect = newAspect
        layout = ScreenLayout.weplayDefault(newAspect)
        candidate = null
    }

    /** Called with the boxes from a whole-screen look at a guessing frame. Returns true if the layout changed. */
    fun onFullLook(canvasBox: List<Float>?, hintBox: List<Float>?): Boolean {
        val seen = ScreenLayout.fromModel(canvasBox, hintBox, aspect) ?: return false
        val current = layout
        if (current != null && ScreenLayout.iou(current.canvas, seen.canvas) >= SAME_LAYOUT_IOU) {
            candidate = null
            return false
        }
        val prev = candidate
        if (prev != null && ScreenLayout.iou(prev.canvas, seen.canvas) >= SAME_LAYOUT_IOU) {
            layout = seen
            candidate = null
            return true
        }
        candidate = seen
        return false
    }

    private companion object {
        const val SAME_LAYOUT_IOU = 0.6f
    }
}

package com.weplay.guesserai.domain

import kotlin.math.max
import kotlin.math.min

/** Keeps the floating window off the drawing, so the AI can see every stroke. Screen pixels. */
object OverlayPlacement {

    /**
     * New top edge for a window at [y] with height [h], moved out of the band [avoidTop]..[avoidBottom]
     * (the canvas) when it covers a meaningful part of it. Prefers just below the canvas, then above;
     * returns [y] unchanged if the window does not overlap much or cannot fit anywhere else.
     */
    fun yOutside(y: Int, h: Int, avoidTop: Int, avoidBottom: Int, screenH: Int, margin: Int): Int {
        val overlap = min(y + h, avoidBottom) - max(y, avoidTop)
        if (overlap <= h * MAX_OVERLAP) return y
        val below = avoidBottom + margin
        if (below + h <= screenH - margin) return below
        val above = avoidTop - h - margin
        if (above >= margin) return above
        return y
    }

    /** Share of the window that may sit over the canvas edge before it is moved. */
    private const val MAX_OVERLAP = 0.15f
}

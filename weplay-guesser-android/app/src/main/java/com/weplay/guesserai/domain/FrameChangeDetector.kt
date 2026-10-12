package com.weplay.guesserai.domain

import kotlin.math.abs

/**
 * Decides whether the drawing changed enough since the last analysed frame to be worth another
 * API call. Works on a grayscale grid of the canvas (and the hint): a new stroke darkens a few
 * cells a lot, which a whole-image average would miss, so any [minCells] cells changing by more
 * than [cellThreshold] counts as a change.
 */
class FrameChangeDetector(
    private val cellThreshold: Int = 12,
    private val minCells: Int = 2,
    private val meanThreshold: Double = 1.5,
) {
    private var last: IntArray? = null

    /** @param fingerprint grayscale samples 0..255 */
    fun hasChanged(fingerprint: IntArray): Boolean {
        val prev = last ?: return true
        if (prev.size != fingerprint.size) return true
        var sum = 0L
        var cells = 0
        for (i in prev.indices) {
            val d = abs(prev[i] - fingerprint[i])
            sum += d
            if (d > cellThreshold) cells++
        }
        return cells >= minCells || sum.toDouble() / prev.size >= meanThreshold
    }

    /** True once a fingerprint was accepted, i.e. there is something to compare with. */
    fun hasSeen(): Boolean = last != null

    fun accept(fingerprint: IntArray) {
        last = fingerprint
    }

    fun reset() {
        last = null
    }
}

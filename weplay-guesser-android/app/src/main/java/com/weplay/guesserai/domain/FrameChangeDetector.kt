package com.weplay.guesserai.domain

import kotlin.math.abs

/**
 * Decides whether the canvas changed enough since the last analysed frame to be worth
 * another (paid, battery-hungry) API call. Works on a tiny grayscale fingerprint.
 */
class FrameChangeDetector(private val threshold: Double = 1.6) {
    private var last: IntArray? = null

    /** @param fingerprint grayscale samples 0..255, same length every call */
    fun hasChanged(fingerprint: IntArray): Boolean {
        val prev = last ?: return true
        if (prev.size != fingerprint.size) return true
        var sum = 0L
        for (i in prev.indices) sum += abs(prev[i] - fingerprint[i])
        return sum.toDouble() / prev.size >= threshold
    }

    fun accept(fingerprint: IntArray) {
        last = fingerprint
    }

    fun reset() {
        last = null
    }
}

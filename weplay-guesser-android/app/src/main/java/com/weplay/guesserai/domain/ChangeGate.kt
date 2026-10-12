package com.weplay.guesserai.domain

/**
 * Decides whether a capture is worth a request: the canvas changed, or the hint did.
 *
 * A long hint ("2 words 9 letters|Organ") scrolls through the bar like a marquee, and name badges
 * under it can sparkle. That motion changes the hint area on every capture without anything new to
 * read, and used to send a request on every beat. A real hint change (a new word, the answer
 * shown) is one step that then stays still. So a hint that changed on two captures in a row is
 * treated as animating, and only the canvas counts until it settles; a hint that changed once
 * still triggers straight away. Motion is judged on a finer threshold than change, so a slowly
 * scrolling hint is still recognised as moving.
 */
class ChangeGate {
    private val canvas = FrameChangeDetector()
    private val hint = FrameChangeDetector()
    private val hintMotion = FrameChangeDetector(cellThreshold = 6, meanThreshold = 0.75)
    private var hintMovingFor = 0

    /** True while the hint area keeps changing from one capture to the next. */
    val hintAnimating: Boolean get() = hintMovingFor >= 2

    /** Looks at one capture (call it once per capture); true when the canvas or the hint changed since the last [accept]. */
    fun observe(canvasFp: IntArray, hintFp: IntArray): Boolean {
        val moved = hintMotion.hasSeen() && hintMotion.hasChanged(hintFp)
        hintMotion.accept(hintFp)
        hintMovingFor = if (moved) hintMovingFor + 1 else 0
        return canvas.hasChanged(canvasFp) || (!hintAnimating && hint.hasChanged(hintFp))
    }

    /** The capture was sent: later ones are compared with it. */
    fun accept(canvasFp: IntArray, hintFp: IntArray) {
        canvas.accept(canvasFp)
        hint.accept(hintFp)
    }
}

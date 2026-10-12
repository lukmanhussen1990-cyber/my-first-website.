package com.weplay.guesserai.service

import android.annotation.SuppressLint
import android.graphics.Bitmap
import android.graphics.PixelFormat
import android.hardware.display.DisplayManager
import android.hardware.display.VirtualDisplay
import android.media.Image
import android.media.ImageReader
import android.media.projection.MediaProjection
import android.os.Handler
import android.os.HandlerThread
import kotlin.math.max
import kotlin.math.roundToInt

/**
 * Mirrors the screen into an [ImageReader] at reduced resolution and hands out the latest frame
 * on demand. Frames are only pulled when the analysis loop asks, so nothing is decoded between
 * captures. Android 14+ allows one virtual display per projection token, so rotation is handled
 * by resizing it rather than recreating it.
 *
 * [capture] runs on a background thread while [resize] and [release] come from the main thread,
 * so all three hold this object's lock: the reader is never closed under a capture in progress.
 */
class ScreenCapturer(
    private val projection: MediaProjection,
    private val onStopped: () -> Unit,
) {
    private val thread = HandlerThread("screen-capture").apply { start() }
    private val handler = Handler(thread.looper)
    private var reader: ImageReader? = null
    private var display: VirtualDisplay? = null
    private var lastFrame: Bitmap? = null
    /** Set by [release]; afterwards nothing touches the reader or the frames again. */
    private var released = false

    /** Capture size divided by real screen size; used to map overlay coordinates. */
    @Volatile var scale: Float = 1f
        private set

    private val callback = object : MediaProjection.Callback() {
        override fun onStop() = onStopped()
    }

    @SuppressLint("WrongConstant")
    fun start(screenW: Int, screenH: Int, densityDpi: Int) {
        // The callback must be registered before creating the display on Android 14+.
        projection.registerCallback(callback, handler)
        val (w, h) = captureSize(screenW, screenH)
        reader = ImageReader.newInstance(w, h, PixelFormat.RGBA_8888, 2)
        display = projection.createVirtualDisplay(
            "weplay-ai", w, h, densityDpi, DisplayManager.VIRTUAL_DISPLAY_FLAG_AUTO_MIRROR,
            reader!!.surface, null, handler,
        )
    }

    @SuppressLint("WrongConstant")
    @Synchronized
    fun resize(screenW: Int, screenH: Int, densityDpi: Int) {
        if (released) return
        val d = display ?: return
        val (w, h) = captureSize(screenW, screenH)
        val old = reader
        reader = ImageReader.newInstance(w, h, PixelFormat.RGBA_8888, 2)
        d.resize(w, h, densityDpi)
        d.surface = reader!!.surface
        old?.close()
        lastFrame?.recycle()
        lastFrame = null
    }

    private fun captureSize(screenW: Int, screenH: Int): Pair<Int, Int> {
        // ~1600px on the long side keeps the hint sharp for the model and keeps memory and battery low.
        scale = (MAX_SIDE.toFloat() / max(screenW, screenH)).coerceAtMost(1f)
        return (screenW * scale).roundToInt() to (screenH * scale).roundToInt()
    }

    /**
     * Latest screen contents, or the previous frame if nothing on screen changed since. Always a
     * copy the caller owns (and recycles); null before the first frame and after [release].
     */
    @Synchronized
    fun capture(): Bitmap? {
        if (released) return null
        val image = runCatching { reader?.acquireLatestImage() }.getOrNull()
        if (image != null) {
            runCatching { image.use { toBitmap(it) } }.getOrNull()?.let { frame ->
                lastFrame?.recycle()
                lastFrame = frame
            }
        }
        val last = lastFrame?.takeUnless { it.isRecycled } ?: return null
        return runCatching { last.copy(Bitmap.Config.ARGB_8888, true) }.getOrNull()
    }

    private fun toBitmap(img: Image): Bitmap {
        val plane = img.planes[0]
        val pixelStride = plane.pixelStride
        val rowPadding = plane.rowStride - pixelStride * img.width
        val padded = Bitmap.createBitmap(img.width + rowPadding / pixelStride, img.height, Bitmap.Config.ARGB_8888)
        padded.copyPixelsFromBuffer(plane.buffer)
        if (rowPadding == 0) return padded
        return Bitmap.createBitmap(padded, 0, 0, img.width, img.height).also { padded.recycle() }
    }

    fun release() {
        synchronized(this) {
            if (released) return
            released = true
            runCatching { display?.release() }
            runCatching { reader?.close() }
            lastFrame?.recycle()
            lastFrame = null
        }
        runCatching { projection.unregisterCallback(callback) }
        runCatching { projection.stop() }
        thread.quitSafely()
    }

    private companion object {
        const val MAX_SIDE = 1600
    }
}

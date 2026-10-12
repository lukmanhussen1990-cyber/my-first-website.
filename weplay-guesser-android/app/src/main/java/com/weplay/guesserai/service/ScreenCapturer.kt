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
import java.nio.ByteBuffer
import java.util.concurrent.Semaphore
import java.util.concurrent.TimeUnit
import kotlin.math.max
import kotlin.math.roundToInt

/**
 * Mirrors the screen into an [ImageReader] at reduced resolution, one frame at a time.
 *
 * To keep the game smooth the mirror is only connected while [capture] waits for its frame
 * (about once a second) instead of re-rendering the screen on every refresh, and every frame is
 * copied into the same reused bitmap instead of new full-screen ones. If a device does not deliver
 * frames that way, capturing falls back to a permanently connected mirror.
 *
 * Android 14+ allows one virtual display per projection token, so rotation is handled by resizing
 * it rather than recreating it. [capture] runs on a background thread while [resize] and [release]
 * come from the main thread, so all three hold this object's lock.
 */
class ScreenCapturer(
    private val projection: MediaProjection,
    private val onStopped: () -> Unit,
) : FrameSource {
    private val thread = HandlerThread("screen-capture").apply { start() }
    private val handler = Handler(thread.looper)
    private var reader: ImageReader? = null
    private var display: VirtualDisplay? = null
    /** Released once per frame the mirror delivers. */
    private val frameReady = Semaphore(0)

    /** The one bitmap every frame is copied into; never recycled, as a frame may still be read when capture stops. */
    private var buffer: Bitmap? = null
    private var scratch: ByteBuffer? = null
    private var frame: Frame? = null
    /** Set by [release]; afterwards nothing touches the reader again. */
    private var released = false

    /** Connect the mirror only while a capture waits; false once that did not work on this device. */
    private var onDemand = true
    private var misses = 0

    /** Capture size divided by real screen size; used to map overlay coordinates. */
    @Volatile override var scale: Float = 1f
        private set

    private val callback = object : MediaProjection.Callback() {
        override fun onStop() = onStopped()
    }

    @SuppressLint("WrongConstant")
    fun start(screenW: Int, screenH: Int, densityDpi: Int) {
        // The callback must be registered before creating the display on Android 14+.
        projection.registerCallback(callback, handler)
        val (w, h) = captureSize(screenW, screenH)
        val r = newReader(w, h)
        reader = r
        display = projection.createVirtualDisplay(
            "weplay-ai", w, h, densityDpi, DisplayManager.VIRTUAL_DISPLAY_FLAG_AUTO_MIRROR,
            r.surface, null, handler,
        )
    }

    @SuppressLint("WrongConstant")
    private fun newReader(w: Int, h: Int): ImageReader =
        ImageReader.newInstance(w, h, PixelFormat.RGBA_8888, 2).apply {
            setOnImageAvailableListener({ frameReady.release() }, handler)
        }

    @Synchronized
    fun resize(screenW: Int, screenH: Int, densityDpi: Int) {
        if (released) return
        val d = display ?: return
        val (w, h) = captureSize(screenW, screenH)
        val old = reader
        val r = newReader(w, h)
        reader = r
        d.resize(w, h, densityDpi)
        d.surface = if (onDemand) null else r.surface
        old?.close()
        frame = null
    }

    private fun captureSize(screenW: Int, screenH: Int): Pair<Int, Int> {
        // ~1280px on the long side: the hint text and strokes stay sharp, the work per frame stays small.
        scale = (MAX_SIDE.toFloat() / max(screenW, screenH)).coerceAtMost(1f)
        return (screenW * scale).roundToInt() to (screenH * scale).roundToInt()
    }

    /**
     * The current screen, or the previous frame if no new one arrived in time. The returned frame
     * lives in a shared buffer that the next capture overwrites, so it must be fully used before
     * capturing again. Null before the first frame and after [release].
     */
    @Synchronized
    override fun capture(): Frame? {
        if (released) return null
        val r = reader ?: return null
        val d = display ?: return null
        val image = if (onDemand) {
            // Throw away anything left over, connect the mirror, wait for one fresh frame, disconnect.
            runCatching { r.acquireLatestImage()?.close() }
            frameReady.drainPermits()
            d.surface = r.surface
            frameReady.tryAcquire(FRAME_WAIT_MS, TimeUnit.MILLISECONDS)
            val img = runCatching { r.acquireLatestImage() }.getOrNull()
            d.surface = null
            if (img == null && ++misses >= MAX_MISSES) {
                // This device does not render on reconnect: keep the mirror connected from now on.
                onDemand = false
                d.surface = r.surface
            }
            img
        } else {
            runCatching { r.acquireLatestImage() }.getOrNull()
        }
        if (image != null) {
            misses = 0
            runCatching { image.use { copy(it) } }
        }
        return frame
    }

    /** Copies [img] into the shared buffer (no new bitmap unless the size changed). */
    private fun copy(img: Image) {
        val plane = img.planes[0]
        val bufferWidth = plane.rowStride / plane.pixelStride
        var b = buffer
        if (b == null || b.width != bufferWidth || b.height != img.height) {
            b = Bitmap.createBitmap(bufferWidth, img.height, Bitmap.Config.ARGB_8888)
            buffer = b
        }
        val src = plane.buffer.apply { rewind() }
        val needed = b.byteCount
        if (src.remaining() >= needed) {
            b.copyPixelsFromBuffer(src)
        } else {
            // Some devices leave out the last row's padding; pad it out in a reused buffer.
            val s = scratch?.takeIf { it.capacity() >= needed } ?: ByteBuffer.allocateDirect(needed).also { scratch = it }
            s.clear()
            s.put(src)
            s.rewind()
            b.copyPixelsFromBuffer(s)
        }
        frame = Frame(b, img.width, img.height)
    }

    fun release() {
        synchronized(this) {
            if (released) return
            released = true
            runCatching { display?.release() }
            runCatching { reader?.close() }
            // Not recycled: a frame being processed right now may still read it; the GC frees it.
            frame = null
            buffer = null
            scratch = null
        }
        runCatching { projection.unregisterCallback(callback) }
        runCatching { projection.stop() }
        thread.quitSafely()
    }

    private companion object {
        const val MAX_SIDE = 1280
        /** Longest wait for the mirror to deliver a frame after connecting it. */
        const val FRAME_WAIT_MS = 250L
        /** Captures in a row without a frame before switching to a permanently connected mirror. */
        const val MAX_MISSES = 3
    }
}

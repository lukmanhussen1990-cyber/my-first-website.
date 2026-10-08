package com.imran.bio

import java.io.InputStream

/**
 * The "Range" header a music/video player sends to ask for a piece of a file ("bytes=START-END", "bytes=START-" or
 * "bytes=-LAST_N"): the byte positions it wants, or null when the request can't be answered (416).
 * Several ranges at once (never sent by players) get the first one.
 */
internal fun parseByteRange(header: String, total: Long): LongRange? {
    val spec = header.trim()
    if (!spec.startsWith("bytes=", ignoreCase = true) || total <= 0) return null
    val first = spec.substring(6).substringBefore(',').trim()
    val dash = first.indexOf('-')
    if (dash < 0) return null
    val a = first.substring(0, dash).trim()
    val b = first.substring(dash + 1).trim()
    if (a.isEmpty()) { // the last N bytes
        val n = b.toLongOrNull() ?: return null
        return if (n <= 0) null else maxOf(0L, total - n)..(total - 1)
    }
    val start = a.toLongOrNull() ?: return null
    val end = if (b.isEmpty()) total - 1 else minOf(b.toLongOrNull() ?: return null, total - 1)
    return if (start < 0 || start >= total || end < start) null else start..end
}

/** Skips exactly [n] bytes (or up to the end). */
internal fun InputStream.skipFully(n: Long) {
    var left = n
    while (left > 0) {
        val skipped = skip(left)
        if (skipped > 0) {
            left -= skipped
        } else {
            if (read() < 0) return
            left--
        }
    }
}

/** Reads at most [left] bytes from [inner], then stops (the end of the asked-for piece). */
internal class LimitedStream(private val inner: InputStream, private var left: Long) : InputStream() {
    override fun read(): Int {
        if (left <= 0) return -1
        val b = inner.read()
        if (b >= 0) left--
        return b
    }

    override fun read(b: ByteArray, off: Int, len: Int): Int {
        if (len == 0) return 0
        if (left <= 0) return -1
        val n = inner.read(b, off, minOf(len.toLong(), left).toInt())
        if (n > 0) left -= n
        return n
    }

    override fun available(): Int = minOf(inner.available().toLong(), left).toInt()

    override fun close() = inner.close()
}

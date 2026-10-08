package com.imran.bio

import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test
import java.io.ByteArrayInputStream

class MediaRangeTest {

    @Test
    fun openEnded() {
        assertEquals(0L..999L, parseByteRange("bytes=0-", 1000))
        assertEquals(500L..999L, parseByteRange("bytes=500-", 1000))
    }

    @Test
    fun startAndEnd() {
        assertEquals(10L..19L, parseByteRange("bytes=10-19", 1000))
        assertEquals(0L..0L, parseByteRange("bytes=0-0", 1000))
        assertEquals(990L..999L, parseByteRange("bytes=990-5000", 1000)) // end past the file: up to the end
        assertEquals(10L..19L, parseByteRange(" Bytes=10-19 ", 1000))
    }

    @Test
    fun lastBytes() {
        assertEquals(900L..999L, parseByteRange("bytes=-100", 1000))
        assertEquals(0L..999L, parseByteRange("bytes=-5000", 1000))
        assertNull(parseByteRange("bytes=-0", 1000))
    }

    @Test
    fun severalRangesAnswerTheFirst() {
        assertEquals(0L..9L, parseByteRange("bytes=0-9, 20-29", 1000))
    }

    @Test
    fun cannotBeAnswered() {
        assertNull(parseByteRange("bytes=1000-", 1000)) // starts after the end
        assertNull(parseByteRange("bytes=20-10", 1000))
        assertNull(parseByteRange("bytes=abc-", 1000))
        assertNull(parseByteRange("items=0-10", 1000))
        assertNull(parseByteRange("bytes=0-", 0))
        assertNull(parseByteRange("bytes=5", 1000))
    }

    @Test
    fun streamsTheAskedPiece() {
        val data = ByteArray(1000) { (it % 251).toByte() }
        val r = parseByteRange("bytes=300-449", data.size.toLong())!!
        val input = ByteArrayInputStream(data).apply { skipFully(r.first) }
        val out = LimitedStream(input, r.last - r.first + 1).readBytes()
        assertArrayEquals(data.copyOfRange(300, 450), out)
    }

    @Test
    fun skipPastTheEndStops() {
        val input = ByteArrayInputStream(ByteArray(10))
        input.skipFully(50)
        assertEquals(-1, input.read())
    }
}

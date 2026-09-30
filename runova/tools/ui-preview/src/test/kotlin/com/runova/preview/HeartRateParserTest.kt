package com.runova.preview

import com.runova.app.state.HeartRateParser
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull

class HeartRateParserTest {
    private fun bytes(vararg b: Int) = ByteArray(b.size) { b[it].toByte() }

    @Test
    fun eightBitValue() {
        assertEquals(72, HeartRateParser.parse(bytes(0x00, 72)))
        // sensor-contact and energy-expended flags don't change the layout of the first value
        assertEquals(128, HeartRateParser.parse(bytes(0x16, 128, 0x10, 0x00)))
        assertEquals(200, HeartRateParser.parse(bytes(0x00, 200)))
    }

    @Test
    fun sixteenBitValue() {
        assertEquals(151, HeartRateParser.parse(bytes(0x01, 151, 0)))
        assertEquals(230, HeartRateParser.parse(bytes(0x01, 0xE6, 0x00)))
    }

    @Test
    fun malformedOrImplausiblePacketsAreIgnored() {
        assertNull(HeartRateParser.parse(null))
        assertNull(HeartRateParser.parse(bytes()))
        assertNull(HeartRateParser.parse(bytes(0x00)))
        assertNull(HeartRateParser.parse(bytes(0x01, 80)))
        assertNull(HeartRateParser.parse(bytes(0x00, 0)))
        assertNull(HeartRateParser.parse(bytes(0x01, 0x2C, 0x01))) // 300 bpm
    }
}

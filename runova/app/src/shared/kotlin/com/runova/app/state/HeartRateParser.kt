package com.runova.app.state

/** Parses the Bluetooth "Heart Rate Measurement" characteristic (0x2A37). */
object HeartRateParser {
    /** Beats per minute, or null for a malformed or implausible packet. */
    fun parse(value: ByteArray?): Int? {
        if (value == null || value.isEmpty()) return null
        val flags = value[0].toInt() and 0xFF
        val sixteenBit = flags and 0x01 != 0
        val bpm = if (sixteenBit) {
            if (value.size < 3) return null
            (value[1].toInt() and 0xFF) or ((value[2].toInt() and 0xFF) shl 8)
        } else {
            if (value.size < 2) return null
            value[1].toInt() and 0xFF
        }
        return bpm.takeIf { it in 25..250 }
    }
}

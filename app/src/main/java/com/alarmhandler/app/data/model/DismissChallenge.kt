package com.alarmhandler.app.data.model

/**
 * How the user has to prove they are awake before an alarm stops.
 *
 * [strength] means something slightly different per challenge, which is why it
 * lives on the alarm rather than here: taps for [TAP_MASCOT], shakes for
 * [SHAKE], pattern length for [MEMORY], and it is ignored by the rest.
 */
enum class DismissChallenge(val id: String) {
    /** One tap on the dismiss button. */
    TAP("tap"),

    /** Press and hold dismiss for three seconds. */
    HOLD("hold"),

    /** Answer a two-operand arithmetic question. */
    MATH("math"),

    /** Tap the mascot while it hops around the screen. */
    TAP_MASCOT("mascot"),

    /** Repeat a short flashing pattern. */
    MEMORY("memory"),

    /** Shake the phone a chosen number of times. */
    SHAKE("shake"),
    ;

    /** True when [strength] is meaningful for this challenge. */
    val usesStrength: Boolean
        get() = this == TAP_MASCOT || this == SHAKE || this == MEMORY

    companion object {
        fun fromId(id: String?): DismissChallenge =
            entries.firstOrNull { it.id == id } ?: TAP
    }
}

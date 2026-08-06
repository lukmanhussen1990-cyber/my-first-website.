package com.alarmhandler.app.data.model

import android.content.Context
import android.net.Uri
import androidx.core.net.toUri
import com.alarmhandler.app.R

/**
 * An alarm sound reference.
 *
 * Sounds are stored as a short string id so the database never holds a raw
 * resource number (which changes between builds) and so a device ringtone can
 * be represented by the same field.
 *
 *  - `builtin:<raw name>` -- one of the tones shipped inside the APK
 *  - `device:<content uri>` -- a ringtone or audio file chosen by the user
 *  - `silent` -- vibration only
 */
sealed interface AlarmSound {

    val id: String

    data class BuiltIn(
        val rawResId: Int,
        val displayName: String,
        val rawName: String,
    ) : AlarmSound {
        override val id: String get() = "$BUILT_IN_PREFIX$rawName"
    }

    data class Device(val uri: Uri, val displayName: String) : AlarmSound {
        override val id: String get() = "$DEVICE_PREFIX$uri"
    }

    data object Silent : AlarmSound {
        override val id: String get() = SILENT_ID
    }

    companion object {
        const val BUILT_IN_PREFIX = "builtin:"
        const val DEVICE_PREFIX = "device:"
        const val SILENT_ID = "silent"

        /** The tone a brand new alarm starts with. */
        const val DEFAULT_ID = "${BUILT_IN_PREFIX}tone_pixel_chime"

        val builtIns: List<BuiltIn> = listOf(
            BuiltIn(R.raw.tone_pixel_chime, "Pixel Chime", "tone_pixel_chime"),
            BuiltIn(R.raw.tone_retro_alarm, "Retro Alarm", "tone_retro_alarm"),
            BuiltIn(R.raw.tone_handler_beep, "Handler Beep", "tone_handler_beep"),
            BuiltIn(R.raw.tone_sunrise, "Sunrise", "tone_sunrise"),
            BuiltIn(R.raw.tone_city_siren, "City Siren", "tone_city_siren"),
        )

        fun isBuiltIn(id: String) = id.startsWith(BUILT_IN_PREFIX)

        fun builtInOrNull(id: String): BuiltIn? =
            builtIns.firstOrNull { it.id == id }

        /**
         * Resolves [id] to a playable uri. Returns null for [Silent] and for a
         * device sound whose id is malformed.
         */
        fun toUri(context: Context, id: String): Uri? = when {
            id == SILENT_ID -> null
            id.startsWith(DEVICE_PREFIX) ->
                runCatching { id.removePrefix(DEVICE_PREFIX).toUri() }.getOrNull()
            else -> {
                val tone = builtInOrNull(id) ?: builtIns.first()
                "android.resource://${context.packageName}/${tone.rawResId}".toUri()
            }
        }

        /**
         * A human readable name for [id]. Device sounds fall back to the last
         * path segment when their title cannot be read (for example after the
         * user revoked storage access).
         */
        fun displayName(context: Context, id: String): String = when {
            id == SILENT_ID -> "Silent (vibration only)"
            id.startsWith(DEVICE_PREFIX) -> deviceSoundTitle(context, id)
            else -> builtInOrNull(id)?.displayName ?: builtIns.first().displayName
        }

        private fun deviceSoundTitle(context: Context, id: String): String {
            val uri = runCatching { id.removePrefix(DEVICE_PREFIX).toUri() }.getOrNull()
                ?: return "Device sound"
            val fromRingtone = runCatching {
                android.media.RingtoneManager.getRingtone(context, uri)?.getTitle(context)
            }.getOrNull()
            return fromRingtone?.takeIf { it.isNotBlank() }
                ?: uri.lastPathSegment
                ?: "Device sound"
        }
    }
}

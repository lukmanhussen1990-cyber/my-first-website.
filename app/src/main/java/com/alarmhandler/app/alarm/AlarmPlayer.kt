package com.alarmhandler.app.alarm

import android.content.Context
import android.media.AudioAttributes
import android.media.AudioManager
import android.media.MediaPlayer
import android.os.Build
import android.os.CombinedVibration
import android.os.SystemClock
import android.os.VibrationAttributes
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import android.util.Log
import com.alarmhandler.app.data.model.Alarm
import com.alarmhandler.app.data.model.AlarmSound
import kotlin.math.pow

/**
 * Plays the alarm tone and drives the vibrator.
 *
 * The device's own alarm stream volume is never modified -- the user's system
 * setting is theirs. Per-alarm volume and the gradual ramp are applied inside
 * the player instead, which also means nothing has to be restored if the
 * process is killed mid-ring.
 */
class AlarmPlayer(private val context: Context) {

    private var player: MediaPlayer? = null
    private var vibrator: Vibrator? = null
    private var rampStartedAt = 0L
    private var config: Alarm? = null

    val isPlaying: Boolean get() = player != null

    fun start(alarm: Alarm) {
        stop()
        config = alarm
        rampStartedAt = SystemClock.elapsedRealtime()
        startAudio(alarm)
        if (alarm.vibrate) startVibration()
    }

    /**
     * Advances the volume ramp. Called on a timer by [AlarmService] rather than
     * from an internal thread so the service owns every wake-up.
     */
    fun tick() {
        val alarm = config ?: return
        val mp = player ?: return
        val target = alarm.volumePercent / 100f
        val level = if (!alarm.gradualVolume) {
            target
        } else {
            val elapsed = (SystemClock.elapsedRealtime() - rampStartedAt) / 1000f
            val progress = (elapsed / alarm.gradualVolumeSeconds.coerceAtLeast(1)).coerceIn(0f, 1f)
            // Perceived loudness is roughly the square of the linear scalar, so
            // ramp on a curve; a linear ramp sounds like it jumps at the end.
            val floor = 0.05f
            floor + (target - floor).coerceAtLeast(0f) * progress.toDouble().pow(2.0).toFloat()
        }
        runCatching { mp.setVolume(level, level) }
    }

    fun stop() {
        player?.let { mp ->
            runCatching { if (mp.isPlaying) mp.stop() }
            runCatching { mp.reset() }
            runCatching { mp.release() }
        }
        player = null
        vibrator?.let { runCatching { it.cancel() } }
        vibrator = null
        config = null
    }

    private fun startAudio(alarm: Alarm) {
        if (alarm.soundId == AlarmSound.SILENT_ID) return

        val attributes = AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_ALARM)
            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
            .build()

        // If the user's chosen sound has become unreadable (a deleted file, a
        // revoked permission) fall back to a built-in tone rather than leaving
        // the alarm silent.
        val candidates = listOfNotNull(
            AlarmSound.toUri(context, alarm.soundId),
            AlarmSound.toUri(context, AlarmSound.DEFAULT_ID),
        ).distinct()

        for (uri in candidates) {
            val mp = MediaPlayer()
            val started = runCatching {
                mp.setAudioAttributes(attributes)
                mp.setDataSource(context, uri)
                mp.isLooping = true
                mp.prepare()
                val initial = if (alarm.gradualVolume) 0.05f else alarm.volumePercent / 100f
                mp.setVolume(initial, initial)
                mp.start()
            }.isSuccess
            if (started) {
                player = mp
                return
            }
            runCatching { mp.release() }
            Log.w(TAG, "Could not play $uri, trying the next source")
        }
        Log.e(TAG, "No alarm tone could be played; falling back to vibration only")
    }

    private fun startVibration() {
        val vib = obtainVibrator() ?: return
        if (!vib.hasVibrator()) return
        vibrator = vib

        // Half a second on, one second off, repeating -- long enough to feel
        // through a mattress, short enough not to sound like a rattle.
        val timings = longArrayOf(0, 500, 1000)
        val amplitudes = intArrayOf(0, 255, 0)
        val effect = VibrationEffect.createWaveform(timings, amplitudes, 1)

        runCatching {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                vib.vibrate(
                    effect,
                    VibrationAttributes.Builder()
                        .setUsage(VibrationAttributes.USAGE_ALARM)
                        .build(),
                )
            } else {
                @Suppress("DEPRECATION")
                vib.vibrate(
                    effect,
                    AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_ALARM)
                        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                        .build(),
                )
            }
        }.onFailure { Log.w(TAG, "Vibration was refused by the system", it) }
    }

    private fun obtainVibrator(): Vibrator? = runCatching {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            val manager = context.getSystemService(Context.VIBRATOR_MANAGER_SERVICE)
                as? VibratorManager
            manager?.defaultVibrator
        } else {
            @Suppress("DEPRECATION")
            context.getSystemService(Context.VIBRATOR_SERVICE) as? Vibrator
        }
    }.getOrNull()

    /** One short buzz, used to confirm a challenge step on the ringing screen. */
    fun previewTick() {
        val vib = obtainVibrator() ?: return
        runCatching {
            vib.vibrate(VibrationEffect.createOneShot(40, VibrationEffect.DEFAULT_AMPLITUDE))
        }
    }

    companion object {
        private const val TAG = "AlarmPlayer"

        /** Used by the sound picker to audition a tone at a safe volume. */
        fun preview(context: Context, soundId: String): MediaPlayer? {
            val uri = AlarmSound.toUri(context, soundId) ?: return null
            val mp = MediaPlayer()
            return runCatching {
                mp.setAudioAttributes(
                    AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_ALARM)
                        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                        .build()
                )
                mp.setDataSource(context, uri)
                mp.isLooping = false
                mp.prepare()
                mp.setVolume(0.6f, 0.6f)
                mp.start()
                mp
            }.getOrElse {
                runCatching { mp.release() }
                null
            }
        }

        @Suppress("unused")
        fun alarmStreamIsMuted(context: Context): Boolean {
            val am = context.getSystemService(Context.AUDIO_SERVICE) as? AudioManager
            return (am?.getStreamVolume(AudioManager.STREAM_ALARM) ?: 1) == 0
        }
    }
}

package com.imran.jarvis.voice

import android.content.Context
import android.media.AudioAttributes
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.speech.tts.TextToSpeech
import android.speech.tts.UtteranceProgressListener
import android.speech.tts.Voice
import com.imran.jarvis.data.AppLanguage
import com.imran.jarvis.data.VoiceGender
import java.util.Locale
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.atomic.AtomicInteger

/**
 * Speaks text out loud with Android's TextToSpeech, in Hindi or English, using a male or female voice
 * when the phone has one. Must be created and used from the main thread.
 */
class TtsManager(context: Context) {

    private val appContext = context.applicationContext
    private val main = Handler(Looper.getMainLooper())

    private var engine: TextToSpeech? = null
    private var ready = false
    private var failed = false

    private class Pending(val text: String, val language: AppLanguage, val gender: VoiceGender, val onFinished: () -> Unit)

    private var pending: Pending? = null
    private val completions = ConcurrentHashMap<String, () -> Unit>()
    private val counter = AtomicInteger()
    private val reportedMissing = mutableSetOf<AppLanguage>()

    /** Called (at most once per language) when the phone has no voice for the chosen language. */
    var onVoiceMissing: ((AppLanguage) -> Unit)? = null

    init {
        engine = TextToSpeech(appContext) { status -> main.post { onEngineReady(status) } }
    }

    private fun onEngineReady(status: Int) {
        val tts = engine
        if (status != TextToSpeech.SUCCESS || tts == null) {
            failed = true
            pending?.let { it.onFinished() }
            pending = null
            return
        }
        tts.setAudioAttributes(
            AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_ASSISTANT)
                .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                .build(),
        )
        tts.setOnUtteranceProgressListener(object : UtteranceProgressListener() {
            override fun onStart(utteranceId: String?) {}

            override fun onDone(utteranceId: String?) = finish(utteranceId)

            @Deprecated("Replaced by onError(String, Int)")
            override fun onError(utteranceId: String?) = finish(utteranceId)

            override fun onError(utteranceId: String?, errorCode: Int) = finish(utteranceId)

            // Interrupted by stop() or by a newer sentence: the "finished" action must NOT run.
            override fun onStop(utteranceId: String?, interrupted: Boolean) {
                completions.remove(utteranceId)
            }
        })
        ready = true
        pending?.let { speak(it.text, it.language, it.gender, it.onFinished) }
        pending = null
    }

    private fun finish(utteranceId: String?) {
        val action = completions.remove(utteranceId) ?: return
        main.post(action)
    }

    /**
     * Speaks [text]. [onFinished] runs when the sentence has been spoken completely (or could not
     * be spoken at all), but NOT if it is interrupted by [stop] or another [speak].
     */
    fun speak(text: String, language: AppLanguage, gender: VoiceGender, onFinished: () -> Unit) {
        val clean = SpeechText.sanitize(text)
        if (clean.isEmpty() || failed) {
            onFinished()
            return
        }
        val tts = engine
        if (!ready || tts == null) {
            pending = Pending(clean, language, gender, onFinished)
            return
        }

        applyVoice(tts, language, gender)
        val id = "jarvis-${counter.incrementAndGet()}"
        completions[id] = onFinished
        if (tts.speak(clean, TextToSpeech.QUEUE_FLUSH, Bundle(), id) == TextToSpeech.ERROR) {
            completions.remove(id)
            onFinished()
        }
    }

    fun stop() {
        pending = null
        completions.clear()
        try {
            engine?.stop()
        } catch (_: RuntimeException) {
        }
    }

    fun shutdown() {
        stop()
        try {
            engine?.shutdown()
        } catch (_: RuntimeException) {
        }
        engine = null
    }

    // ---------- Voice selection ----------

    private fun applyVoice(tts: TextToSpeech, language: AppLanguage, gender: VoiceGender) {
        val locale = Locale.forLanguageTag(language.speechTag)
        val result = tts.setLanguage(locale)
        if (result == TextToSpeech.LANG_MISSING_DATA || result == TextToSpeech.LANG_NOT_SUPPORTED) {
            if (reportedMissing.add(language)) onVoiceMissing?.invoke(language)
            if (tts.setLanguage(Locale.forLanguageTag("en-IN")) < TextToSpeech.LANG_AVAILABLE) {
                tts.setLanguage(Locale.ENGLISH)
            }
            tts.setPitch(if (gender == VoiceGender.MALE) MALE_PITCH else FEMALE_PITCH)
            return
        }

        val voices = try {
            tts.voices?.toList().orEmpty()
        } catch (_: RuntimeException) {
            emptyList()
        }
        val usable = voices.filter {
            it.locale.language == locale.language &&
                TextToSpeech.Engine.KEY_FEATURE_NOT_INSTALLED !in it.features.orEmpty()
        }
        val sameCountry = usable.filter { it.locale.country.equals(locale.country, ignoreCase = true) }
            .ifEmpty { usable }

        val match = sameCountry
            .filter { VoiceGenderGuess.of(it) == gender }
            .sortedWith(
                compareBy<Voice> { it.isNetworkConnectionRequired } // phone-only voices are more reliable
                    .thenByDescending { it.quality }
                    .thenBy { it.latency },
            )
            .firstOrNull()

        if (match != null) {
            tts.voice = match
            tts.setPitch(1.0f)
        } else {
            // This phone has no voice we can tell is male/female: change the pitch of the default one instead.
            tts.setPitch(if (gender == VoiceGender.MALE) MALE_PITCH else FEMALE_PITCH)
        }
    }

    private companion object {
        const val MALE_PITCH = 0.82f
        const val FEMALE_PITCH = 1.12f
    }
}

/**
 * Android does not tell us whether a voice is male or female, so this makes an educated guess from the
 * voice's name. It is only a hint: when it cannot tell, [TtsManager] changes the pitch instead.
 */
internal object VoiceGenderGuess {

    private val FEMALE_WORD = Regex("(^|[^a-z])female([^a-z]|$)")
    private val MALE_WORD = Regex("(^|[^a-z])male([^a-z]|$)")
    private val SAMSUNG = Regex("smt([fm])\\d")
    private val GOOGLE_INDIA = Regex("^(?:hi|en)-in-x-(?:hi|en)([a-d])")

    fun of(voice: Voice): VoiceGender? = guess(voice.name, voice.features.orEmpty())

    fun guess(name: String, features: Set<String> = emptySet()): VoiceGender? {
        val text = (listOf(name) + features).joinToString(" ").lowercase(Locale.ROOT)

        if (FEMALE_WORD.containsMatchIn(text)) return VoiceGender.FEMALE
        if (MALE_WORD.containsMatchIn(text)) return VoiceGender.MALE

        // Samsung voices end in "SMTf00" (female) or "SMTm00" (male).
        SAMSUNG.find(text)?.let { return if (it.groupValues[1] == "f") VoiceGender.FEMALE else VoiceGender.MALE }

        // Google's Hindi / Indian-English voices are called "hi-in-x-hia-local", "en-in-x-enb-network", ...
        // Speakers a and d are female, b and c are male.
        GOOGLE_INDIA.find(name.lowercase(Locale.ROOT))?.let {
            return if (it.groupValues[1] == "a" || it.groupValues[1] == "d") VoiceGender.FEMALE else VoiceGender.MALE
        }
        return null
    }
}

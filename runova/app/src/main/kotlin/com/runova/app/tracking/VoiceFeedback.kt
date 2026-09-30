package com.runova.app.tracking

import android.content.Context
import android.media.AudioAttributes
import android.media.AudioFocusRequest
import android.media.AudioManager
import android.speech.tts.TextToSpeech
import android.speech.tts.UtteranceProgressListener
import java.util.Locale
import java.util.concurrent.atomic.AtomicInteger

/** Spoken run updates. Other audio (music, podcasts) is ducked while RUNOVA speaks. */
class VoiceFeedback(context: Context) : TextToSpeech.OnInitListener {
    private val app = context.applicationContext
    private val audio = app.getSystemService(AudioManager::class.java)
    private var tts: TextToSpeech? = null
    private var ready = false
    private val pending = ArrayList<Pair<String, Boolean>>()
    private val ids = AtomicInteger()
    private val speaking = AtomicInteger()

    private val focus = AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK)
        .setAudioAttributes(ATTRIBUTES)
        .build()

    @Synchronized
    fun prepare() {
        if (tts == null) tts = TextToSpeech(app, this)
    }

    @Synchronized
    override fun onInit(status: Int) {
        val engine = tts ?: return
        if (status != TextToSpeech.SUCCESS) {
            engine.shutdown()
            tts = null
            pending.clear()
            return
        }
        val locale = Locale.getDefault()
        engine.language = if (engine.isLanguageAvailable(locale) >= TextToSpeech.LANG_AVAILABLE) locale else Locale.US
        engine.setAudioAttributes(ATTRIBUTES)
        engine.setOnUtteranceProgressListener(object : UtteranceProgressListener() {
            override fun onStart(utteranceId: String?) = Unit
            override fun onDone(utteranceId: String?) = finished()

            // Utterances dropped by QUEUE_FLUSH end here instead of onDone.
            override fun onStop(utteranceId: String?, interrupted: Boolean) = finished()

            @Deprecated("Deprecated in Java")
            override fun onError(utteranceId: String?) = finished()
        })
        ready = true
        pending.forEach { (text, flush) -> say(engine, text, flush) }
        pending.clear()
    }

    /** Speaks [text]; [flush] interrupts whatever is being said. */
    @Synchronized
    fun speak(text: String, flush: Boolean = false) {
        prepare()
        val engine = tts
        if (!ready || engine == null) {
            if (flush) pending.clear()
            pending += text to flush
            return
        }
        say(engine, text, flush)
    }

    private fun say(engine: TextToSpeech, text: String, flush: Boolean) {
        if (speaking.getAndIncrement() == 0) audio?.requestAudioFocus(focus)
        engine.speak(text, if (flush) TextToSpeech.QUEUE_FLUSH else TextToSpeech.QUEUE_ADD, null, "runova-${ids.incrementAndGet()}")
    }

    private fun finished() {
        if (speaking.decrementAndGet() <= 0) {
            speaking.set(0)
            audio?.abandonAudioFocusRequest(focus)
        }
    }

    @Synchronized
    fun shutdown() {
        tts?.shutdown()
        tts = null
        ready = false
        speaking.set(0)
        audio?.abandonAudioFocusRequest(focus)
    }

    private companion object {
        val ATTRIBUTES: AudioAttributes = AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_ASSISTANCE_NAVIGATION_GUIDANCE)
            .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
            .build()
    }
}

package com.imran.jarvis.voice

import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import com.imran.jarvis.data.AppLanguage

/** Why listening failed, in categories the UI can explain to the user. */
enum class SpeechError { NO_SPEECH, NO_MATCH, NETWORK, PERMISSION, BUSY, AUDIO, SERVER, UNAVAILABLE, LANGUAGE_UNSUPPORTED, OTHER }

interface SpeechListener {
    /** The microphone is open: the user can speak now. */
    fun onReady()

    /** Voice loudness from 0.0 (silence) to 1.0 (loud). Drives the orb and the sound wave. */
    fun onLevel(level: Float)

    /** Words recognised so far while the user is still talking. */
    fun onPartialText(text: String)

    fun onFinalText(text: String)
    fun onError(error: SpeechError)
}

/**
 * Wraps Android's SpeechRecognizer. Every listening session uses a brand-new recognizer, which is
 * the most reliable approach across phone brands (reusing one often ends in "recognizer busy").
 * Must be used from the main thread.
 */
class SpeechRecognizerManager(context: Context, private val listener: SpeechListener) {

    private val appContext = context.applicationContext
    private val main = Handler(Looper.getMainLooper())
    private var recognizer: SpeechRecognizer? = null

    /** Callbacks from an older session are ignored: a session is only "current" while its id matches. */
    private var session = 0

    fun isAvailable(): Boolean = SpeechRecognizer.isRecognitionAvailable(appContext)

    fun start(language: AppLanguage) {
        release()
        val id = ++session

        val created = try {
            SpeechRecognizer.createSpeechRecognizer(appContext)
        } catch (_: RuntimeException) {
            null
        }
        if (created == null) {
            listener.onError(SpeechError.UNAVAILABLE)
            return
        }
        recognizer = created
        created.setRecognitionListener(SessionListener(id))

        val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
            putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
            putExtra(RecognizerIntent.EXTRA_LANGUAGE, language.speechTag)
            putExtra(RecognizerIntent.EXTRA_LANGUAGE_PREFERENCE, language.speechTag)
            putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true)
            putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1)
            putExtra(RecognizerIntent.EXTRA_CALLING_PACKAGE, appContext.packageName)
        }
        try {
            created.startListening(intent)
        } catch (_: SecurityException) {
            release()
            listener.onError(SpeechError.PERMISSION)
        } catch (_: RuntimeException) {
            release()
            listener.onError(SpeechError.UNAVAILABLE)
        }
    }

    /** Stop listening now and process what was heard so far (the user tapped the mic again). */
    fun stop() {
        try {
            recognizer?.stopListening()
        } catch (_: RuntimeException) {
        }
    }

    /** Abandon the current session without reporting anything. */
    fun cancel() {
        session++ // invalidates any callback still on its way
        release()
    }

    fun destroy() = cancel()

    private fun release() {
        val old = recognizer ?: return
        recognizer = null
        try {
            old.cancel()
        } catch (_: RuntimeException) {
        }
        // Destroy a moment later: destroying inside a callback of the same recognizer can crash some phones.
        main.post {
            try {
                old.destroy()
            } catch (_: RuntimeException) {
            }
        }
    }

    private inner class SessionListener(private val id: Int) : RecognitionListener {
        private val current get() = id == session

        override fun onReadyForSpeech(params: Bundle?) {
            if (current) listener.onReady()
        }

        override fun onRmsChanged(rmsdB: Float) {
            // The recognizer reports roughly -2 (silence) to 10 (loud) decibels.
            if (current) listener.onLevel(((rmsdB + 2f) / 12f).coerceIn(0f, 1f))
        }

        override fun onPartialResults(partialResults: Bundle?) {
            if (!current) return
            val text = partialResults?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)?.firstOrNull().orEmpty()
            if (text.isNotBlank()) listener.onPartialText(text)
        }

        override fun onResults(results: Bundle?) {
            if (!current) return
            val text = results?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)?.firstOrNull().orEmpty().trim()
            release()
            if (text.isEmpty()) listener.onError(SpeechError.NO_MATCH) else listener.onFinalText(text)
        }

        override fun onError(error: Int) {
            if (!current) return
            release()
            listener.onError(map(error))
        }

        override fun onBeginningOfSpeech() {}
        override fun onBufferReceived(buffer: ByteArray?) {}
        override fun onEndOfSpeech() {}
        override fun onEvent(eventType: Int, params: Bundle?) {}
    }

    private fun map(code: Int): SpeechError = when (code) {
        SpeechRecognizer.ERROR_NETWORK, SpeechRecognizer.ERROR_NETWORK_TIMEOUT -> SpeechError.NETWORK
        SpeechRecognizer.ERROR_AUDIO -> SpeechError.AUDIO
        SpeechRecognizer.ERROR_SERVER, SpeechRecognizer.ERROR_SERVER_DISCONNECTED -> SpeechError.SERVER
        SpeechRecognizer.ERROR_SPEECH_TIMEOUT -> SpeechError.NO_SPEECH
        SpeechRecognizer.ERROR_NO_MATCH -> SpeechError.NO_MATCH
        SpeechRecognizer.ERROR_RECOGNIZER_BUSY, SpeechRecognizer.ERROR_TOO_MANY_REQUESTS -> SpeechError.BUSY
        SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS -> SpeechError.PERMISSION
        SpeechRecognizer.ERROR_LANGUAGE_NOT_SUPPORTED, SpeechRecognizer.ERROR_LANGUAGE_UNAVAILABLE ->
            SpeechError.LANGUAGE_UNSUPPORTED
        else -> SpeechError.OTHER
    }
}

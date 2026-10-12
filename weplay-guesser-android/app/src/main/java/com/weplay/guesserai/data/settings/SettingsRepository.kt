package com.weplay.guesserai.data.settings

import android.content.Context
import com.weplay.guesserai.domain.AiModel
import com.weplay.guesserai.domain.AppSettings
import com.weplay.guesserai.domain.CaptureSpeed
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

class SettingsRepository(context: Context) {
    private val prefs = context.getSharedPreferences("settings", Context.MODE_PRIVATE)
    private val _settings = MutableStateFlow(load())
    val settings: StateFlow<AppSettings> = _settings.asStateFlow()

    val current: AppSettings get() = _settings.value

    fun update(transform: (AppSettings) -> AppSettings) {
        val next = transform(_settings.value)
        save(next)
        _settings.value = next
    }

    private fun load(): AppSettings {
        val d = AppSettings()
        val loaded = AppSettings(
            apiKey = prefs.getString(K_KEY, null)?.let(KeyCipher::decrypt).orEmpty(),
            baseUrl = prefs.getString(K_URL, d.baseUrl) ?: d.baseUrl,
            model = enumOr(prefs.getString(K_MODEL, null), d.model),
            customModelId = prefs.getString(K_CUSTOM, "").orEmpty(),
            captureSpeed = enumOr(prefs.getString(K_SPEED, null), d.captureSpeed),
            gamePackage = prefs.getString(K_PKG, "").orEmpty(),
            autoPauseWhenGameClosed = prefs.getBoolean(K_AUTOPAUSE, d.autoPauseWhenGameClosed),
            saveScreenshots = prefs.getBoolean(K_SHOTS, d.saveScreenshots),
            fastMode = prefs.getBoolean(K_FAST, d.fastMode),
            customWords = prefs.getString(K_WORDS, "").orEmpty(),
            overlaySize = enumOr(prefs.getString(K_SIZE, null), d.overlaySize),
            accuracyBoost = prefs.getBoolean(K_BOOST, d.accuracyBoost),
            keepOffDrawing = prefs.getBoolean(K_KEEP_OFF, d.keepOffDrawing),
        )
        // v1 defaulted to Opus with 2 s captures; v2 switches existing installs to the fast setup.
        if (prefs.getInt(K_VERSION, 1) < 2) {
            val migrated = loaded.copy(
                model = if (loaded.model == AiModel.OPUS) AiModel.HAIKU else loaded.model,
                captureSpeed = if (loaded.captureSpeed == CaptureSpeed.NORMAL) CaptureSpeed.FAST else loaded.captureSpeed,
            )
            save(migrated)
            return migrated
        }
        return loaded
    }

    private fun save(s: AppSettings) {
        prefs.edit()
            .putString(K_KEY, if (s.apiKey.isBlank()) null else KeyCipher.encrypt(s.apiKey.trim()))
            .putString(K_URL, s.baseUrl.trim().ifEmpty { AppSettings.DEFAULT_BASE_URL })
            .putString(K_MODEL, s.model.name)
            .putString(K_CUSTOM, s.customModelId)
            .putString(K_SPEED, s.captureSpeed.name)
            .putString(K_PKG, s.gamePackage)
            .putBoolean(K_AUTOPAUSE, s.autoPauseWhenGameClosed)
            .putBoolean(K_SHOTS, s.saveScreenshots)
            .putBoolean(K_FAST, s.fastMode)
            .putString(K_WORDS, s.customWords)
            .putString(K_SIZE, s.overlaySize.name)
            .putBoolean(K_BOOST, s.accuracyBoost)
            .putBoolean(K_KEEP_OFF, s.keepOffDrawing)
            .putInt(K_VERSION, VERSION)
            .apply()
    }

    private inline fun <reified E : Enum<E>> enumOr(name: String?, fallback: E): E =
        runCatching { enumValueOf<E>(name!!) }.getOrDefault(fallback)

    private companion object {
        const val K_KEY = "api_key_enc"
        const val K_URL = "base_url"
        const val K_MODEL = "model"
        const val K_CUSTOM = "custom_model"
        const val K_SPEED = "capture_speed"
        const val K_PKG = "game_package"
        const val K_AUTOPAUSE = "auto_pause"
        const val K_SHOTS = "save_screenshots"
        const val K_FAST = "fast_mode"
        const val K_WORDS = "custom_words"
        const val K_SIZE = "overlay_size"
        const val K_BOOST = "accuracy_boost"
        const val K_KEEP_OFF = "keep_off_drawing"
        const val K_VERSION = "settings_version"
        const val VERSION = 2
    }
}

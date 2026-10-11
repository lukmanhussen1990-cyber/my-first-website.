package com.imran.jarvis.data

import android.content.Context
import android.content.SharedPreferences
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

/**
 * Stores the non-secret settings (language, voice, provider, switches, model names).
 * API keys are NOT stored here - see [ApiKeyStore], which encrypts them.
 */
class SettingsRepository(context: Context) {

    private val prefs: SharedPreferences =
        context.applicationContext.getSharedPreferences(FILE, Context.MODE_PRIVATE)

    private val _settings = MutableStateFlow(load())
    val settings: StateFlow<AppSettings> = _settings.asStateFlow()

    private fun load(): AppSettings = AppSettings(
        provider = enumOrDefault(prefs.getString(KEY_PROVIDER, null), AiProvider.GEMINI),
        language = enumOrDefault(prefs.getString(KEY_LANGUAGE, null), AppLanguage.HINDI),
        voice = enumOrDefault(prefs.getString(KEY_VOICE, null), VoiceGender.MALE),
        customModels = AiProvider.entries
            .mapNotNull { p -> prefs.getString(modelKey(p), null)?.takeIf { it.isNotBlank() }?.let { p to it } }
            .toMap(),
        callsEnabled = prefs.getBoolean(KEY_CALLS, true),
        notificationsEnabled = prefs.getBoolean(KEY_NOTIFICATIONS, true),
        openAppsEnabled = prefs.getBoolean(KEY_OPEN_APPS, true),
        alwaysOn = prefs.getBoolean(KEY_ALWAYS_ON, false),
    )

    fun setProvider(value: AiProvider) = update({ putString(KEY_PROVIDER, value.name) }) { copy(provider = value) }
    fun setLanguage(value: AppLanguage) = update({ putString(KEY_LANGUAGE, value.name) }) { copy(language = value) }
    fun setVoice(value: VoiceGender) = update({ putString(KEY_VOICE, value.name) }) { copy(voice = value) }
    fun setCallsEnabled(value: Boolean) = update({ putBoolean(KEY_CALLS, value) }) { copy(callsEnabled = value) }
    fun setNotificationsEnabled(value: Boolean) =
        update({ putBoolean(KEY_NOTIFICATIONS, value) }) { copy(notificationsEnabled = value) }
    fun setOpenAppsEnabled(value: Boolean) = update({ putBoolean(KEY_OPEN_APPS, value) }) { copy(openAppsEnabled = value) }
    fun setAlwaysOn(value: Boolean) = update({ putBoolean(KEY_ALWAYS_ON, value) }) { copy(alwaysOn = value) }

    /** Saves the model name for [provider]. A blank value goes back to the built-in default. */
    fun setModel(provider: AiProvider, model: String) {
        val clean = model.trim()
        update({ if (clean.isEmpty()) remove(modelKey(provider)) else putString(modelKey(provider), clean) }) {
            copy(customModels = if (clean.isEmpty()) customModels - provider else customModels + (provider to clean))
        }
    }

    private inline fun update(
        write: SharedPreferences.Editor.() -> Unit,
        change: AppSettings.() -> AppSettings,
    ) {
        prefs.edit().apply(write).apply()
        _settings.value = _settings.value.change()
    }

    private fun modelKey(provider: AiProvider) = "model_${provider.name.lowercase()}"

    private inline fun <reified T : Enum<T>> enumOrDefault(name: String?, default: T): T =
        enumValues<T>().firstOrNull { it.name == name } ?: default

    private companion object {
        const val FILE = "jarvis_settings"
        const val KEY_PROVIDER = "provider"
        const val KEY_LANGUAGE = "language"
        const val KEY_VOICE = "voice"
        const val KEY_CALLS = "calls_enabled"
        const val KEY_NOTIFICATIONS = "notifications_enabled"
        const val KEY_OPEN_APPS = "open_apps_enabled"
        const val KEY_ALWAYS_ON = "always_on"
    }
}

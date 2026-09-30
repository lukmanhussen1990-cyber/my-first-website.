package com.runova.app.data

import android.content.Context
import android.content.SharedPreferences
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import com.runova.app.state.AppSettings
import com.runova.app.state.UserProfile
import com.runova.app.ui.model.MapStyle
import com.runova.app.ui.model.ThemeMode
import com.runova.core.model.GoalTargets
import com.runova.core.model.Goals
import com.runova.core.model.Sex
import com.runova.core.model.UnitSystem
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

/** User settings in SharedPreferences, exposed as a [StateFlow]. */
class SettingsStore(context: Context) {
    private val prefs: SharedPreferences = context.getSharedPreferences("runova_settings", Context.MODE_PRIVATE)
    private val state = MutableStateFlow(read())
    val flow: StateFlow<AppSettings> = state.asStateFlow()

    fun load(): AppSettings = state.value

    @Synchronized
    fun update(transform: (AppSettings) -> AppSettings): AppSettings {
        val next = transform(state.value)
        if (next != state.value) {
            write(next)
            state.value = next
        }
        return next
    }

    @Synchronized
    fun reset() {
        prefs.edit().clear().apply()
        state.value = AppSettings()
    }

    private inline fun <reified T : Enum<T>> SharedPreferences.enumValue(key: String, default: T): T =
        getString(key, null)?.let { v -> enumValues<T>().firstOrNull { it.name == v } } ?: default

    private fun SharedPreferences.targets(prefix: String, d: GoalTargets) = GoalTargets(
        calories = getInt("${prefix}_kcal", d.calories),
        distanceKm = getFloat("${prefix}_km", d.distanceKm.toFloat()).toDouble(),
        steps = getInt("${prefix}_steps", d.steps),
        activeMinutes = getInt("${prefix}_min", d.activeMinutes),
    )

    private fun SharedPreferences.Editor.targets(prefix: String, t: GoalTargets) {
        putInt("${prefix}_kcal", t.calories)
        putFloat("${prefix}_km", t.distanceKm.toFloat())
        putInt("${prefix}_steps", t.steps)
        putInt("${prefix}_min", t.activeMinutes)
    }

    private fun read(): AppSettings {
        val d = AppSettings()
        val p = prefs
        return AppSettings(
            onboarded = p.getBoolean("onboarded", d.onboarded),
            profile = UserProfile(
                name = p.getString("name", d.profile.name).orEmpty(),
                sex = p.getString("sex", null)?.let { v -> Sex.entries.firstOrNull { it.name == v } },
                age = p.getInt("age", d.profile.age),
                heightCm = p.getFloat("height_cm", d.profile.heightCm.toFloat()).toDouble(),
                weightKg = p.getFloat("weight_kg", d.profile.weightKg.toFloat()).toDouble(),
            ),
            units = p.enumValue("units", d.units),
            goals = Goals(
                daily = p.targets("daily", d.goals.daily),
                weekly = p.targets("weekly", d.goals.weekly),
                monthly = p.targets("monthly", d.goals.monthly),
            ),
            voice = p.getBoolean("voice", d.voice),
            autoPause = p.getBoolean("auto_pause", d.autoPause),
            keepScreenOn = p.getBoolean("keep_screen_on", d.keepScreenOn),
            countdown = p.getBoolean("countdown", d.countdown),
            theme = p.enumValue("theme", d.theme),
            mapStyle = p.enumValue("map_style", d.mapStyle),
            reminderEnabled = p.getBoolean("reminder", d.reminderEnabled),
            reminderHour = p.getInt("reminder_h", d.reminderHour),
            reminderMinute = p.getInt("reminder_m", d.reminderMinute),
            claudeModel = p.getString("claude_model", d.claudeModel) ?: d.claudeModel,
            heartRateAddress = p.getString("hr_address", null),
            heartRateName = p.getString("hr_name", null),
        )
    }

    private fun write(s: AppSettings) {
        prefs.edit().apply {
            putBoolean("onboarded", s.onboarded)
            putString("name", s.profile.name)
            putString("sex", s.profile.sex?.name)
            putInt("age", s.profile.age)
            putFloat("height_cm", s.profile.heightCm.toFloat())
            putFloat("weight_kg", s.profile.weightKg.toFloat())
            putString("units", s.units.name)
            targets("daily", s.goals.daily)
            targets("weekly", s.goals.weekly)
            targets("monthly", s.goals.monthly)
            putBoolean("voice", s.voice)
            putBoolean("auto_pause", s.autoPause)
            putBoolean("keep_screen_on", s.keepScreenOn)
            putBoolean("countdown", s.countdown)
            putString("theme", s.theme.name)
            putString("map_style", s.mapStyle.name)
            putBoolean("reminder", s.reminderEnabled)
            putInt("reminder_h", s.reminderHour)
            putInt("reminder_m", s.reminderMinute)
            putString("claude_model", s.claudeModel)
            putString("hr_address", s.heartRateAddress)
            putString("hr_name", s.heartRateName)
        }.apply()
    }

    // Small pieces of app state that are not user settings.
    private val statePrefs: SharedPreferences = context.getSharedPreferences("runova_state", Context.MODE_PRIVATE)

    var avatarVersion: Long
        get() = statePrefs.getLong("avatar_version", 0)
        set(v) = statePrefs.edit().putLong("avatar_version", v).apply()

    fun resetInternal() = statePrefs.edit().clear().apply()

    /** Step-counter baseline used to turn the since-boot counter into daily steps. */
    data class StepBaseline(val counter: Long, val bootCount: Int)

    var stepBaseline: StepBaseline?
        get() = if (statePrefs.contains("step_counter")) StepBaseline(statePrefs.getLong("step_counter", 0), statePrefs.getInt("step_boot", -1)) else null
        set(v) {
            val e = statePrefs.edit()
            if (v == null) e.remove("step_counter").remove("step_boot") else e.putLong("step_counter", v.counter).putInt("step_boot", v.bootCount)
            e.apply()
        }
}

/**
 * The Anthropic API key, encrypted with an AES-GCM key that lives in the Android Keystore and
 * never leaves the device.
 */
class SecretStore(context: Context) {
    private val prefs = context.getSharedPreferences("runova_secrets", Context.MODE_PRIVATE)
    private val present = MutableStateFlow(prefs.contains(KEY))
    val hasApiKey: StateFlow<Boolean> = present.asStateFlow()

    @Synchronized
    fun apiKey(): String? {
        val stored = prefs.getString(KEY, null) ?: return null
        return try {
            val (iv, data) = stored.split(':').let { Base64.decode(it[0], Base64.NO_WRAP) to Base64.decode(it[1], Base64.NO_WRAP) }
            val cipher = Cipher.getInstance(TRANSFORMATION)
            cipher.init(Cipher.DECRYPT_MODE, secretKey(), GCMParameterSpec(128, iv))
            String(cipher.doFinal(data), Charsets.UTF_8)
        } catch (e: Exception) {
            // The Keystore key is gone (e.g. restored backup or cleared credentials): forget the key.
            clearApiKey()
            null
        }
    }

    @Synchronized
    fun setApiKey(key: String) {
        val cipher = Cipher.getInstance(TRANSFORMATION)
        cipher.init(Cipher.ENCRYPT_MODE, secretKey())
        val data = cipher.doFinal(key.trim().toByteArray(Charsets.UTF_8))
        val encoded = Base64.encodeToString(cipher.iv, Base64.NO_WRAP) + ":" + Base64.encodeToString(data, Base64.NO_WRAP)
        prefs.edit().putString(KEY, encoded).apply()
        present.value = true
    }

    @Synchronized
    fun clearApiKey() {
        prefs.edit().remove(KEY).apply()
        present.value = false
    }

    private fun secretKey(): SecretKey {
        val ks = KeyStore.getInstance(KEYSTORE).apply { load(null) }
        (ks.getEntry(ALIAS, null) as? KeyStore.SecretKeyEntry)?.let { return it.secretKey }
        val generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, KEYSTORE)
        generator.init(
            KeyGenParameterSpec.Builder(ALIAS, KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT)
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .setKeySize(256)
                .build(),
        )
        return generator.generateKey()
    }

    private companion object {
        const val KEY = "anthropic_api_key"
        const val ALIAS = "runova_api_key"
        const val KEYSTORE = "AndroidKeyStore"
        const val TRANSFORMATION = "AES/GCM/NoPadding"
    }
}

package com.loe.chat.data

import android.content.Context
import android.content.SharedPreferences
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import org.json.JSONArray
import org.json.JSONObject
import java.time.LocalDate

enum class ThemeMode { LIGHT, DARK, SYSTEM }

data class Profile(
    val name: String = "",
    val handle: String = "",
    val bio: String = "",
    val avatarPath: String? = null,
)

data class AppSettings(
    val onboarded: Boolean = false,
    val profile: Profile = Profile(),
    val emails: List<String> = emptyList(),
    val phone: String? = null,
    val defaultBotId: String = BotCatalog.ASSISTANT_ID,
    val theme: ThemeMode = ThemeMode.SYSTEM,
    val apiKeys: Map<Provider, String> = emptyMap(),
    val dailyPoints: Int = SettingsStore.DEFAULT_DAILY_POINTS,
    val perMessageBudget: Int = SettingsStore.DEFAULT_MESSAGE_BUDGET,
    val pointsUsed: Int = 0,
    val pointsDay: String = "",
    val followedBots: Set<String> = emptySet(),
    val notifyReplies: Boolean = false,
    /** Per-bot model ID overrides, keyed by "botId|providerId". */
    val modelOverrides: Map<String, String> = emptyMap(),
) {
    fun remainingPoints(today: String = LocalDate.now().toString()): Int =
        if (pointsDay != today) dailyPoints else (dailyPoints - pointsUsed).coerceAtLeast(0)

    fun hasAnyKey(): Boolean = apiKeys.values.any { it.isNotBlank() }

    fun key(provider: Provider): String? = apiKeys[provider]?.takeIf { it.isNotBlank() }

    fun modelOverride(botId: String, provider: Provider): String? = modelOverrides["$botId|${provider.id}"]
}

/** Small settings store on top of private SharedPreferences, exposed as a StateFlow. */
class SettingsStore(context: Context) {
    private val prefs: SharedPreferences = context.getSharedPreferences("loe_settings", Context.MODE_PRIVATE)
    private val _state = MutableStateFlow(read())
    val state: StateFlow<AppSettings> = _state.asStateFlow()
    val current: AppSettings get() = _state.value

    private fun read(): AppSettings = AppSettings(
        onboarded = prefs.getBoolean("onboarded", false),
        profile = Profile(
            name = prefs.getString("profile_name", "").orEmpty(),
            handle = prefs.getString("profile_handle", "").orEmpty(),
            bio = prefs.getString("profile_bio", "").orEmpty(),
            avatarPath = prefs.getString("profile_avatar", null),
        ),
        emails = prefs.getString("emails", null)?.let { json ->
            runCatching { JSONArray(json).let { a -> (0 until a.length()).map { a.getString(it) } } }.getOrNull()
        } ?: emptyList(),
        phone = prefs.getString("phone", null),
        defaultBotId = prefs.getString("default_bot", BotCatalog.ASSISTANT_ID) ?: BotCatalog.ASSISTANT_ID,
        theme = runCatching { ThemeMode.valueOf(prefs.getString("theme", "SYSTEM")!!) }.getOrDefault(ThemeMode.SYSTEM),
        apiKeys = Provider.entries.mapNotNull { p ->
            prefs.getString("key_${p.id}", null)?.takeIf { it.isNotBlank() }?.let { p to it }
        }.toMap(),
        dailyPoints = prefs.getInt("daily_points", DEFAULT_DAILY_POINTS),
        perMessageBudget = prefs.getInt("message_budget", DEFAULT_MESSAGE_BUDGET),
        pointsUsed = prefs.getInt("points_used", 0),
        pointsDay = prefs.getString("points_day", "").orEmpty(),
        followedBots = prefs.getStringSet("followed_bots", emptySet())?.toSet() ?: emptySet(),
        notifyReplies = prefs.getBoolean("notify_replies", false),
        modelOverrides = prefs.getString("model_overrides", null)?.let { json ->
            runCatching {
                val o = JSONObject(json)
                o.keys().asSequence().associateWith { o.getString(it) }
            }.getOrNull()
        } ?: emptyMap(),
    )

    private fun edit(block: SharedPreferences.Editor.() -> Unit) {
        prefs.edit().apply(block).apply()
        _state.value = read()
    }

    fun completeOnboarding(name: String, email: String?) = edit {
        putBoolean("onboarded", true)
        putString("profile_name", name.trim())
        putString("profile_handle", handleFrom(name))
        if (!email.isNullOrBlank()) putString("emails", JSONArray(listOf(email.trim())).toString())
    }

    fun updateProfile(profile: Profile) = edit {
        putString("profile_name", profile.name.trim())
        putString("profile_handle", profile.handle.trim().removePrefix("@").ifBlank { handleFrom(profile.name) })
        putString("profile_bio", profile.bio.trim())
        putString("profile_avatar", profile.avatarPath)
    }

    fun addEmail(email: String) = edit {
        val list = (current.emails + email.trim()).distinct()
        putString("emails", JSONArray(list).toString())
    }

    fun removeEmail(email: String) = edit {
        putString("emails", JSONArray(current.emails - email).toString())
    }

    fun setPhone(phone: String?) = edit { putString("phone", phone?.trim()?.takeIf { it.isNotEmpty() }) }

    fun setDefaultBot(botId: String) = edit { putString("default_bot", botId) }

    fun setTheme(mode: ThemeMode) = edit { putString("theme", mode.name) }

    fun setApiKey(provider: Provider, key: String?) = edit {
        val clean = key?.trim().orEmpty()
        if (clean.isEmpty()) remove("key_${provider.id}") else putString("key_${provider.id}", clean)
    }

    fun clearApiKeys() = edit { Provider.entries.forEach { remove("key_${it.id}") } }

    fun setDailyPoints(points: Int) = edit { putInt("daily_points", points.coerceIn(0, MAX_POINTS)) }

    fun setMessageBudget(points: Int) = edit { putInt("message_budget", points.coerceIn(0, MAX_POINTS)) }

    /** Records points spent on a message, resetting the counter on a new day. */
    fun spendPoints(points: Int, today: String = LocalDate.now().toString()) = edit {
        val used = if (current.pointsDay == today) current.pointsUsed else 0
        putString("points_day", today)
        putInt("points_used", (used + points).coerceAtMost(MAX_POINTS))
    }

    fun setFollowed(botId: String, followed: Boolean) = edit {
        val set = current.followedBots.toMutableSet().apply { if (followed) add(botId) else remove(botId) }
        putStringSet("followed_bots", set)
    }

    fun setNotifyReplies(enabled: Boolean) = edit { putBoolean("notify_replies", enabled) }

    fun setModelOverride(botId: String, provider: Provider, model: String?) = edit {
        val map = current.modelOverrides.toMutableMap()
        val key = "$botId|${provider.id}"
        if (model.isNullOrBlank()) map.remove(key) else map[key] = model.trim()
        putString("model_overrides", JSONObject(map as Map<*, *>).toString())
    }

    /** "Log out": back to the welcome screen, keeping chats. */
    fun logOut(removeKeys: Boolean) = edit {
        putBoolean("onboarded", false)
        if (removeKeys) Provider.entries.forEach { remove("key_${it.id}") }
    }

    fun clearAll() = edit { clear() }

    companion object {
        const val DEFAULT_DAILY_POINTS = 10_000
        const val DEFAULT_MESSAGE_BUDGET = 1_000
        const val MAX_POINTS = 10_000_000

        fun handleFrom(name: String): String =
            name.lowercase().filter { it.isLetterOrDigit() }.ifBlank { "loeuser" }
    }
}

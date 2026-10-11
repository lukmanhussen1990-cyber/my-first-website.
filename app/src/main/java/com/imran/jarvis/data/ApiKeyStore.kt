package com.imran.jarvis.data

import android.content.Context
import android.content.SharedPreferences
import android.util.Log
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import java.security.KeyStore
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

/**
 * Keeps the user's API keys encrypted on the phone (EncryptedSharedPreferences, AES-256,
 * master key protected by the Android Keystore). One key is stored per AI provider.
 *
 * Creating encrypted preferences is slow-ish, so everything here runs on a background thread.
 */
class ApiKeyStore(context: Context) {

    private val appContext = context.applicationContext

    private val prefs: SharedPreferences by lazy { openOrRecover() }

    suspend fun get(provider: AiProvider): String = withContext(Dispatchers.IO) {
        try {
            prefs.getString(keyName(provider), "").orEmpty()
        } catch (e: Exception) {
            // The Keystore key can disappear (for example after a phone restore). Start fresh.
            Log.w(TAG, "Could not read API key, resetting secure storage", e)
            resetStorage()
            ""
        }
    }

    suspend fun set(provider: AiProvider, value: String) = withContext(Dispatchers.IO) {
        val clean = value.trim()
        try {
            prefs.edit().apply {
                if (clean.isEmpty()) remove(keyName(provider)) else putString(keyName(provider), clean)
            }.apply()
        } catch (e: Exception) {
            Log.w(TAG, "Could not save API key, resetting secure storage", e)
            resetStorage()
            if (clean.isNotEmpty()) prefs.edit().putString(keyName(provider), clean).apply()
        }
    }

    private fun keyName(provider: AiProvider) = "api_key_${provider.name.lowercase()}"

    private fun openOrRecover(): SharedPreferences =
        try {
            create()
        } catch (e: Exception) {
            Log.w(TAG, "Secure storage was unreadable, recreating it", e)
            resetStorage()
            create()
        }

    // Google has marked the security-crypto library "deprecated", but it still works on every Android
    // version this app supports and is exactly what was asked for: EncryptedSharedPreferences.
    @Suppress("DEPRECATION")
    private fun create(): SharedPreferences {
        val masterKey = MasterKey.Builder(appContext)
            .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
            .build()
        return EncryptedSharedPreferences.create(
            appContext,
            FILE,
            masterKey,
            EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
            EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM,
        )
    }

    /** Deletes the encrypted file and its Keystore master key so a clean pair can be created. */
    @Suppress("DEPRECATION")
    private fun resetStorage() {
        try {
            appContext.deleteSharedPreferences(FILE)
            KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
                .deleteEntry(MasterKey.DEFAULT_MASTER_KEY_ALIAS)
        } catch (e: Exception) {
            Log.w(TAG, "Resetting secure storage failed", e)
        }
    }

    private companion object {
        const val TAG = "ApiKeyStore"
        const val FILE = "jarvis_secure_prefs"
    }
}

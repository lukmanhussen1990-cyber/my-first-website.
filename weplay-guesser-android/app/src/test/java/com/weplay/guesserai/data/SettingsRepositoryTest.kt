package com.weplay.guesserai.data

import android.content.Context
import androidx.test.core.app.ApplicationProvider
import com.weplay.guesserai.data.settings.SecretCipher
import com.weplay.guesserai.data.settings.SettingsRepository
import com.weplay.guesserai.domain.CaptureSpeed
import com.weplay.guesserai.domain.OverlaySize
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [34])
class SettingsRepositoryTest {
    private val ctx: Context = ApplicationProvider.getApplicationContext()
    private val prefs get() = ctx.getSharedPreferences("settings", Context.MODE_PRIVATE)

    /** Reversible stand-in for the Android Keystore that counts how often it is used. */
    private class CountingCipher : SecretCipher {
        var encrypts = 0
        override fun encrypt(plain: String): String { encrypts++; return "enc:" + plain.reversed() }
        override fun decrypt(encoded: String): String? = encoded.removePrefix("enc:").reversed()
    }

    /** A phone whose Keystore is broken. */
    private object BrokenCipher : SecretCipher {
        override fun encrypt(plain: String): String? = null
        override fun decrypt(encoded: String): String? = null
    }

    /** What a user does in one visit to Settings: toggles, chips and typing custom words. */
    private fun settingsVisit(repo: SettingsRepository) {
        repo.update { it.copy(fastMode = !it.fastMode) }
        repo.update { it.copy(accuracyBoost = !it.accuracyBoost) }
        repo.update { it.copy(overlaySize = OverlaySize.LARGE) }
        repo.update { it.copy(captureSpeed = CaptureSpeed.NORMAL) }
        "free fire, heart beat".forEach { ch -> repo.update { it.copy(customWords = it.customWords + ch) } }
    }

    @Test fun `settings changes do not re-encrypt an unchanged key`() {
        val cipher = CountingCipher()
        val repo = SettingsRepository(ctx, cipher)
        repo.update { it.copy(apiKey = "sk-ant-abc") }
        assertEquals(1, cipher.encrypts)
        settingsVisit(repo)
        println("KEYSTORE_ENCRYPTS_PER_VISIT=${cipher.encrypts - 1} for 25 updates")
        assertEquals(1, cipher.encrypts)
        assertEquals("sk-ant-abc", SettingsRepository(ctx, cipher).current.apiKey)
        assertEquals("free fire, heart beat", SettingsRepository(ctx, cipher).current.customWords)
    }

    @Test fun `changing or clearing the key is saved`() {
        val cipher = CountingCipher()
        val repo = SettingsRepository(ctx, cipher)
        repo.update { it.copy(apiKey = "sk-ant-one") }
        repo.update { it.copy(apiKey = "sk-ant-two") }
        assertEquals("sk-ant-two", SettingsRepository(ctx, cipher).current.apiKey)
        repo.update { it.copy(apiKey = "") }
        assertEquals("", SettingsRepository(ctx, cipher).current.apiKey)
        assertFalse(prefs.contains("api_key_enc"))
    }

    @Test fun `broken keystore keeps the key in memory and never writes it in plain text`() {
        val repo = SettingsRepository(ctx, BrokenCipher)
        repo.update { it.copy(apiKey = "sk-ant-secret") }
        assertEquals("sk-ant-secret", repo.current.apiKey)
        assertFalse(repo.keySaved.value)
        assertFalse(prefs.all.values.any { it.toString().contains("sk-ant-secret") })
        settingsVisit(repo)
        assertEquals("sk-ant-secret", repo.current.apiKey)
    }

    @Test fun `unreadable stored key is dropped instead of kept forever`() {
        prefs.edit().putString("api_key_enc", "garbage").commit()
        val repo = SettingsRepository(ctx, BrokenCipher)
        assertEquals("", repo.current.apiKey)
        assertTrue(repo.keySaved.value)
        repo.update { it.copy(fastMode = !it.fastMode) }
        assertFalse(prefs.contains("api_key_enc"))
    }
}

package com.weplay.guesserai.data.settings

import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import android.util.Log
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

/** Encrypts the API key at rest. Both calls return null instead of throwing. */
interface SecretCipher {
    fun encrypt(plain: String): String?
    fun decrypt(encoded: String): String?
}

/** Encrypts the API key with an AES key that never leaves the Android Keystore. */
internal object KeyCipher : SecretCipher {
    private const val ALIAS = "weplay_ai_api_key"
    private const val TRANSFORM = "AES/GCM/NoPadding"
    private const val TAG = "KeyCipher"

    private fun keyStore() = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }

    private fun key(): SecretKey {
        (keyStore().getEntry(ALIAS, null) as? KeyStore.SecretKeyEntry)?.let { return it.secretKey }
        val gen = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore")
        gen.init(
            KeyGenParameterSpec.Builder(ALIAS, KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT)
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .build()
        )
        return gen.generateKey()
    }

    private fun encryptWith(key: SecretKey, plain: String): String {
        val cipher = Cipher.getInstance(TRANSFORM).apply { init(Cipher.ENCRYPT_MODE, key) }
        val out = cipher.iv + cipher.doFinal(plain.toByteArray())
        return Base64.encodeToString(out, Base64.NO_WRAP)
    }

    // A damaged key entry (restored backup, keystore reset) is replaced once; the old
    // ciphertext is being overwritten anyway. If the keystore stays broken, the caller
    // keeps the key in memory rather than crashing or writing it in plain text.
    override fun encrypt(plain: String): String? =
        runCatching { encryptWith(key(), plain) }
            .recoverCatching { keyStore().deleteEntry(ALIAS); encryptWith(key(), plain) }
            .onFailure { Log.w(TAG, "API key could not be encrypted", it) }
            .getOrNull()

    override fun decrypt(encoded: String): String? = runCatching {
        val bytes = Base64.decode(encoded, Base64.NO_WRAP)
        val cipher = Cipher.getInstance(TRANSFORM)
        cipher.init(Cipher.DECRYPT_MODE, key(), GCMParameterSpec(128, bytes, 0, 12))
        String(cipher.doFinal(bytes, 12, bytes.size - 12))
    }.getOrNull()
}

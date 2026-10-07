package com.myapps.blockblast

import java.security.KeyFactory
import java.security.PublicKey
import java.security.Signature
import java.security.spec.X509EncodedKeySpec
import java.util.Base64

/**
 * Verifies Google Play purchase signatures on the device.
 *
 * Google Play signs every purchase (the purchase's original JSON) with the
 * app's RSA key; the matching public key is shown in Play Console under
 * Monetize > Monetization setup > Licensing. A purchase is only trusted when
 * its SHA1withRSA signature verifies against that key.
 */
object PurchaseSecurity {

    fun verify(base64PublicKey: String, signedData: String, base64Signature: String): Boolean {
        if (base64PublicKey.isBlank() || signedData.isEmpty() || base64Signature.isBlank()) return false
        return try {
            val publicKey = publicKey(base64PublicKey)
            val signatureBytes = Base64.getMimeDecoder().decode(base64Signature)
            val verifier = Signature.getInstance("SHA1withRSA")
            verifier.initVerify(publicKey)
            verifier.update(signedData.toByteArray(Charsets.UTF_8))
            verifier.verify(signatureBytes)
        } catch (e: Exception) {
            false
        }
    }

    private fun publicKey(base64PublicKey: String): PublicKey {
        val keyBytes = Base64.getMimeDecoder().decode(base64PublicKey.trim())
        return KeyFactory.getInstance("RSA").generatePublic(X509EncodedKeySpec(keyBytes))
    }
}

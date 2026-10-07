package com.myapps.blockblast

import java.security.KeyPairGenerator
import java.security.Signature
import java.util.Base64
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class PurchaseSecurityTest {

    private val keyPair = KeyPairGenerator.getInstance("RSA").apply { initialize(2048) }.generateKeyPair()
    private val otherKeyPair = KeyPairGenerator.getInstance("RSA").apply { initialize(2048) }.generateKeyPair()
    private val publicKey = Base64.getEncoder().encodeToString(keyPair.public.encoded)
    private val json = """{"orderId":"GPA.1234","packageName":"com.myapps.blockblast","productId":"premium_yearly","purchaseState":0,"purchaseToken":"tok","autoRenewing":true,"acknowledged":false}"""

    private fun sign(data: String, privateKey: java.security.PrivateKey): String {
        val s = Signature.getInstance("SHA1withRSA")
        s.initSign(privateKey)
        s.update(data.toByteArray(Charsets.UTF_8))
        return Base64.getEncoder().encodeToString(s.sign())
    }

    @Test
    fun validSignatureVerifies() {
        assertTrue(PurchaseSecurity.verify(publicKey, json, sign(json, keyPair.private)))
    }

    @Test
    fun tamperedDataIsRejected() {
        val signature = sign(json, keyPair.private)
        assertFalse(PurchaseSecurity.verify(publicKey, json.replace("premium_yearly", "premium_weekly"), signature))
    }

    @Test
    fun signatureFromAnotherKeyIsRejected() {
        assertFalse(PurchaseSecurity.verify(publicKey, json, sign(json, otherKeyPair.private)))
    }

    @Test
    fun missingKeyOrSignatureIsRejected() {
        val signature = sign(json, keyPair.private)
        assertFalse(PurchaseSecurity.verify("", json, signature))
        assertFalse(PurchaseSecurity.verify(publicKey, json, ""))
        assertFalse(PurchaseSecurity.verify("not-a-key", json, signature))
        assertFalse(PurchaseSecurity.verify(publicKey, json, "%%%"))
    }
}

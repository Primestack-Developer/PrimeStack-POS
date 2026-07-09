package com.primestack.taptopay

import javax.crypto.Mac
import javax.crypto.spec.SecretKeySpec
import android.util.Base64

object HmacUtil {

    fun sign(json: String, secret: String): String {
        val mac = Mac.getInstance("HmacSHA256")
        val keySpec = SecretKeySpec(secret.toByteArray(), "HmacSHA256")
        mac.init(keySpec)
        val raw = mac.doFinal(json.toByteArray())
        return Base64.encodeToString(raw, Base64.NO_WRAP)
    }
}

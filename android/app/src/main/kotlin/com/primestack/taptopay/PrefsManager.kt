package com.primestack.taptopay

import android.content.Context
import android.content.SharedPreferences

class PrefsManager(context: Context) {

    private val prefs: SharedPreferences =
        context.getSharedPreferences("primestack_prefs", Context.MODE_PRIVATE)

    companion object {
        private const val KEY_TERMINAL_ID     = "terminal_id"
        private const val KEY_TERMINAL_SECRET = "terminal_secret"
        private const val KEY_MERCHANT_ID     = "merchant_id"
        private const val KEY_MERCHANT_NAME   = "merchant_name"
        private const val KEY_SERVER_URL      = "server_url"

        // Default is empty so production builds must configure a secure backend URL.
        const val DEFAULT_SERVER_URL = ""
    }

    fun saveTerminalCredentials(
        terminalId: String,
        terminalSecret: String,
        merchantId: String,
        merchantName: String
    ) {
        prefs.edit().apply {
            putString(KEY_TERMINAL_ID,     terminalId)
            putString(KEY_TERMINAL_SECRET, terminalSecret)
            putString(KEY_MERCHANT_ID,     merchantId)
            putString(KEY_MERCHANT_NAME,   merchantName)
            apply()
        }
    }

    fun saveServerUrl(url: String) {
        prefs.edit().putString(KEY_SERVER_URL, url.trimEnd('/')).apply()
    }

    fun isRegistered(): Boolean =
        prefs.contains(KEY_TERMINAL_ID) && prefs.contains(KEY_TERMINAL_SECRET)

    fun getTerminalId(): String?     = prefs.getString(KEY_TERMINAL_ID,     null)
    fun getTerminalSecret(): String? = prefs.getString(KEY_TERMINAL_SECRET, null)
    fun getMerchantId(): String?     = prefs.getString(KEY_MERCHANT_ID,     null)
    fun getMerchantName(): String?   = prefs.getString(KEY_MERCHANT_NAME,   null)

    /** Returns saved server URL or the default. Never null. */
    fun getServerUrl(): String =
        prefs.getString(KEY_SERVER_URL, DEFAULT_SERVER_URL) ?: DEFAULT_SERVER_URL

    fun logout() {
        // Preserve server URL across logouts so operator doesn't have to re-enter it
        val url = getServerUrl()
        prefs.edit().clear().apply()
        saveServerUrl(url)
    }
}

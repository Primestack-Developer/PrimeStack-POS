package com.primestack.taptopay

import android.content.Intent
import android.os.Bundle
import android.widget.Button
import android.widget.EditText
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

class SettingsActivity : AppCompatActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_settings)

        val prefs = PrefsManager(this)

        // ── Populate real values from SharedPreferences ────────────────
        val tvTerminalId = findViewById<TextView>(R.id.tvTerminalId)
        val tvMerchantId = findViewById<TextView>(R.id.tvMerchantId)
        val tvDeviceInfo = findViewById<TextView>(R.id.tvDeviceInfo)
        val etServerUrl  = findViewById<EditText>(R.id.etServerUrl)

        tvTerminalId.text = "Terminal: ${prefs.getTerminalId() ?: "Not registered"}"
        tvMerchantId.text = "Merchant: ${prefs.getMerchantId() ?: "Not registered"}"
        tvDeviceInfo.text = "Merchant name: ${prefs.getMerchantName() ?: "—"}"

        etServerUrl.setText(prefs.getServerUrl())

        // ── Save URL ───────────────────────────────────────────────────
        val btnSaveUrl = findViewById<Button>(R.id.btnSaveUrl)
        btnSaveUrl.setOnClickListener {
            val url = etServerUrl.text.toString().trim()
            if (url.isEmpty()) {
                Toast.makeText(this, "URL cannot be empty", Toast.LENGTH_SHORT).show()
                return@setOnClickListener
            }
            prefs.saveServerUrl(url)
            Toast.makeText(this, "Server URL saved", Toast.LENGTH_SHORT).show()
        }

        // ── Real offline sync ──────────────────────────────────────────
        val btnSyncOffline = findViewById<Button>(R.id.btnSyncOffline)
        btnSyncOffline.setOnClickListener {
            btnSyncOffline.isEnabled = false
            btnSyncOffline.text = "Syncing…"

            CoroutineScope(Dispatchers.Main).launch {
                val result = withContext(Dispatchers.IO) {
                    OfflineSyncManager.sync(
                        context   = this@SettingsActivity,
                        serverUrl = prefs.getServerUrl()
                    )
                }

                btnSyncOffline.isEnabled = true
                btnSyncOffline.text = "Sync Offline Transactions"

                val msg = when {
                    result.synced == 0 && result.failed == 0 ->
                        "No pending transactions to sync"
                    result.remaining > 0 ->
                        "Synced ${result.synced} • ${result.remaining} still pending (no connection)"
                    else ->
                        "Synced ${result.synced} • Failed ${result.failed}"
                }
                Toast.makeText(this@SettingsActivity, msg, Toast.LENGTH_LONG).show()
            }
        }

        // ── Logout ─────────────────────────────────────────────────────
        val btnLogout = findViewById<Button>(R.id.btnLogout)
        btnLogout.setOnClickListener {
            prefs.logout()
            val intent = Intent(this, SplashActivity::class.java)
            intent.flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
            startActivity(intent)
            finish()
        }
    }
}

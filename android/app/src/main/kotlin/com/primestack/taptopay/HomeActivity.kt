package com.primestack.taptopay

import android.content.Intent
import android.os.Bundle
import android.widget.Button
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

class HomeActivity : AppCompatActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_home)

        val prefs = PrefsManager(this)

        val tvTerminal = findViewById<TextView>(R.id.tvTerminal)
        val tvMerchant = findViewById<TextView>(R.id.tvMerchant)
        tvTerminal.text = "Terminal: ${prefs.getTerminalId() ?: "Not registered"}"
        tvMerchant.text = "Merchant: ${prefs.getMerchantId() ?: "Not registered"}"

        val btnSale        = findViewById<Button>(R.id.btnSale)
        val btnMoto        = findViewById<Button>(R.id.btnMoto)
        val btnTapToPay    = findViewById<Button>(R.id.btnTapToPay)
        val btnHistory     = findViewById<Button>(R.id.btnHistory)
        val btnSettings    = findViewById<Button>(R.id.btnSettings)
        val btnSyncOffline = findViewById<Button>(R.id.btnSyncOffline)
        val btnCashOut     = findViewById<Button>(R.id.btnCashOut)
        val btnWallet      = findViewById<Button>(R.id.btnWallet)

        btnSale.setOnClickListener {
            startActivity(Intent(this, AmountActivity::class.java))
        }

        btnMoto.setOnClickListener {
            val i = Intent(this, AmountActivity::class.java)
            i.putExtra("MODE", "MOTO")
            startActivity(i)
        }

        btnTapToPay.setOnClickListener {
            val i = Intent(this, AmountActivity::class.java)
            i.putExtra("MODE", "TAP")
            startActivity(i)
        }

        btnHistory.setOnClickListener {
            startActivity(Intent(this, TransactionHistoryActivity::class.java))
        }

        btnSettings.setOnClickListener {
            startActivity(Intent(this, SettingsActivity::class.java))
        }

        btnCashOut.setOnClickListener {
            val i = Intent(this, AmountActivity::class.java)
            i.putExtra("MODE", "CASH_OUT")
            startActivity(i)
        }

        btnWallet.setOnClickListener {
            startActivity(Intent(this, WalletActivity::class.java))
        }

        // ── Real offline sync ──────────────────────────────────────────
        btnSyncOffline.setOnClickListener {
            btnSyncOffline.isEnabled = false
            btnSyncOffline.text = "Syncing…"

            CoroutineScope(Dispatchers.Main).launch {
                val result = withContext(Dispatchers.IO) {
                    OfflineSyncManager.sync(
                        context   = this@HomeActivity,
                        serverUrl = prefs.getServerUrl()
                    )
                }

                btnSyncOffline.isEnabled = true
                btnSyncOffline.text = "SYNC OFFLINE"

                val msg = when {
                    result.synced == 0 && result.failed == 0 ->
                        "No pending transactions"
                    result.remaining > 0 ->
                        "Synced ${result.synced} • ${result.remaining} still pending"
                    else ->
                        "Done — synced ${result.synced}, failed ${result.failed}"
                }
                Toast.makeText(this@HomeActivity, msg, Toast.LENGTH_LONG).show()
            }
        }
    }
}

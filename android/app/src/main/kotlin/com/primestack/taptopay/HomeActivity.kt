package com.primestack.taptopay

import android.content.Intent
import android.os.Bundle
import android.widget.Button
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import com.primestack.taptopay.data.db.AppDatabase
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

        // Load pending offline count and show on sync button
        CoroutineScope(Dispatchers.IO).launch {
            val db      = AppDatabase.getInstance(this@HomeActivity)
            val pending = db.offlineDao().getPending()
            withContext(Dispatchers.Main) {
                if (pending.isEmpty()) {
                    btnSyncOffline.text = "🔄 SYNC OFFLINE TRANSACTIONS"
                    btnSyncOffline.alpha = 0.5f
                } else {
                    btnSyncOffline.text = "🔄 SYNC OFFLINE (${pending.size} PENDING)"
                    btnSyncOffline.alpha = 1.0f
                    btnSyncOffline.setBackgroundColor(getColor(R.color.primestack_danger))
                }
            }
        }

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

                val msg = when {
                    result.synced == 0 && result.failed == 0 ->
                        "No pending transactions"
                    result.remaining > 0 ->
                        "Synced ${result.synced} • ${result.remaining} still pending"
                    else ->
                        "Done — synced ${result.synced}, failed ${result.failed}"
                }
                Toast.makeText(this@HomeActivity, msg, Toast.LENGTH_LONG).show()

                // Refresh pending count on button
                val db      = AppDatabase.getInstance(this@HomeActivity)
                val pending = withContext(Dispatchers.IO) { db.offlineDao().getPending() }
                if (pending.isEmpty()) {
                    btnSyncOffline.text = "🔄 SYNC OFFLINE TRANSACTIONS"
                    btnSyncOffline.alpha = 0.5f
                    btnSyncOffline.setBackgroundColor(getColor(R.color.primestack_secondary))
                } else {
                    btnSyncOffline.text = "🔄 SYNC OFFLINE (${pending.size} PENDING)"
                    btnSyncOffline.alpha = 1.0f
                    btnSyncOffline.setBackgroundColor(getColor(R.color.primestack_danger))
                }
            }
        }
    }
}

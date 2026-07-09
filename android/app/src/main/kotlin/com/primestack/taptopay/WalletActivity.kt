package com.primestack.taptopay

import android.os.Bundle
import android.view.View
import android.widget.Button
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.ProgressBar
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject
import java.text.DecimalFormat

/**
 * WalletActivity
 *
 * Shows the merchant's internal PrimeStack wallet balance.
 * Every MOTO SALE that gets APPROVED credits this wallet automatically.
 * The merchant can request a payout (withdrawal) to their bank from here.
 */
class WalletActivity : AppCompatActivity() {

    private val client = OkHttpClient()
    private lateinit var prefs: PrefsManager
    private val df = DecimalFormat("0.00")

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_wallet)

        prefs = PrefsManager(this)
        loadWallet()

        findViewById<Button>(R.id.btnRefreshWallet).setOnClickListener { loadWallet() }

        // Payout form toggle
        val btnRequestPayout = findViewById<Button>(R.id.btnRequestPayout)
        val payoutForm       = findViewById<LinearLayout>(R.id.payoutForm)
        btnRequestPayout.setOnClickListener {
            payoutForm.visibility =
                if (payoutForm.visibility == View.GONE) View.VISIBLE else View.GONE
        }

        // Submit payout
        val btnSubmitPayout = findViewById<Button>(R.id.btnSubmitPayout)
        btnSubmitPayout.setOnClickListener { submitPayout() }
    }

    private fun loadWallet() {
        val merchantId = prefs.getMerchantId() ?: return

        val tvBalance     = findViewById<TextView>(R.id.tvWalletBalance)
        val tvCredited    = findViewById<TextView>(R.id.tvTotalCredited)
        val tvDebited     = findViewById<TextView>(R.id.tvTotalDebited)
        val tvStatus      = findViewById<TextView>(R.id.tvWalletStatus)
        val progress      = findViewById<ProgressBar>(R.id.walletProgress)
        val contentLayout = findViewById<LinearLayout>(R.id.walletContent)

        progress.visibility      = View.VISIBLE
        contentLayout.visibility = View.GONE

        CoroutineScope(Dispatchers.IO).launch {
            try {
                val url     = "${prefs.getServerUrl()}/wallet/$merchantId"
                val request = Request.Builder().url(url).get().build()
                val response = client.newCall(request).execute()
                val body     = response.body?.string()

                withContext(Dispatchers.Main) {
                    progress.visibility      = View.GONE
                    contentLayout.visibility = View.VISIBLE

                    if (response.isSuccessful && body != null) {
                        val json     = JSONObject(body)
                        val balance  = json.optDouble("balance", 0.0)
                        val credited = json.optDouble("total_credited", 0.0)
                        val debited  = json.optDouble("total_debited", 0.0)
                        val currency = json.optString("currency", "AED")
                        val status   = json.optString("status", "ACTIVE")

                        tvBalance.text  = "$currency ${df.format(balance)}"
                        tvCredited.text = "Total received: $currency ${df.format(credited)}"
                        tvDebited.text  = "Total paid out: $currency ${df.format(debited)}"
                        tvStatus.text   = "Wallet: $status"
                        tvStatus.setTextColor(
                            if (status == "ACTIVE")
                                getColor(R.color.primestack_success)
                            else
                                getColor(R.color.primestack_danger)
                        )
                    } else {
                        tvBalance.text = "Unable to load balance"
                    }
                }
            } catch (e: Exception) {
                withContext(Dispatchers.Main) {
                    progress.visibility      = View.GONE
                    contentLayout.visibility = View.VISIBLE
                    findViewById<TextView>(R.id.tvWalletBalance).text = "No connection"
                    Toast.makeText(
                        this@WalletActivity,
                        "Check your server connection",
                        Toast.LENGTH_SHORT
                    ).show()
                }
            }
        }
    }

    private fun submitPayout() {
        val merchantId  = prefs.getMerchantId() ?: return
        val amountStr   = findViewById<EditText>(R.id.etPayoutAmount).text.toString().trim()
        val accountName = findViewById<EditText>(R.id.etAccountName).text.toString().trim()
        val accountNum  = findViewById<EditText>(R.id.etAccountNumber).text.toString().trim()
        val bankName    = findViewById<EditText>(R.id.etBankName).text.toString().trim()
        val iban        = findViewById<EditText>(R.id.etIban).text.toString().trim()
        val note        = findViewById<EditText>(R.id.etPayoutNote).text.toString().trim()

        val amount = amountStr.toDoubleOrNull()
        if (amount == null || amount <= 0) {
            Toast.makeText(this, "Enter a valid amount", Toast.LENGTH_SHORT).show()
            return
        }
        if (accountName.isEmpty() || accountNum.isEmpty() || bankName.isEmpty()) {
            Toast.makeText(this, "Account name, number and bank name are required", Toast.LENGTH_SHORT).show()
            return
        }

        val btnSubmit = findViewById<Button>(R.id.btnSubmitPayout)
        btnSubmit.isEnabled = false
        btnSubmit.text = "Submitting…"

        val payload = JSONObject().apply {
            put("amount",   amount)
            put("currency", "AED")
            put("bank_account", JSONObject().apply {
                put("account_name",   accountName)
                put("account_number", accountNum)
                put("bank_name",      bankName)
                if (iban.isNotEmpty()) put("iban", iban)
            })
            if (note.isNotEmpty()) put("note", note)
        }

        CoroutineScope(Dispatchers.IO).launch {
            try {
                val url     = "${prefs.getServerUrl()}/wallet/$merchantId/payout"
                val body    = payload.toString()
                    .toRequestBody("application/json; charset=utf-8".toMediaTypeOrNull())
                val request = Request.Builder().url(url).post(body).build()
                val response = client.newCall(request).execute()
                val resBody  = response.body?.string()

                withContext(Dispatchers.Main) {
                    btnSubmit.isEnabled = true
                    btnSubmit.text = "Submit Payout Request"

                    if (response.isSuccessful && resBody != null) {
                        val json = JSONObject(resBody)
                        Toast.makeText(
                            this@WalletActivity,
                            "Request submitted — ID: ${json.optString("payout_id")}",
                            Toast.LENGTH_LONG
                        ).show()
                        // Clear form and hide it
                        listOf(R.id.etPayoutAmount, R.id.etAccountName, R.id.etAccountNumber,
                               R.id.etBankName, R.id.etIban, R.id.etPayoutNote).forEach {
                            findViewById<EditText>(it).setText("")
                        }
                        findViewById<LinearLayout>(R.id.payoutForm).visibility = View.GONE
                        loadWallet()
                    } else {
                        val err = try { JSONObject(resBody ?: "").optString("error", "Request failed") }
                                  catch (_: Exception) { "Request failed" }
                        Toast.makeText(this@WalletActivity, err, Toast.LENGTH_LONG).show()
                    }
                }
            } catch (e: Exception) {
                withContext(Dispatchers.Main) {
                    btnSubmit.isEnabled = true
                    btnSubmit.text = "Submit Payout Request"
                    Toast.makeText(this@WalletActivity, "Network error: ${e.message}", Toast.LENGTH_LONG).show()
                }
            }
        }
    }
}

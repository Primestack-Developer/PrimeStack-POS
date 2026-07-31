package com.primestack.taptopay

import android.content.Intent
import android.os.Bundle
import android.widget.Button
import android.widget.EditText
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import okhttp3.*
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject
import java.io.IOException
import java.text.DecimalFormat


class CashOutActivity : AppCompatActivity() {

    private val client = OkHttpClient()
    private var amount: Double = 0.0
    private lateinit var prefs: PrefsManager

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_cashout)

        prefs  = PrefsManager(this)
        amount = intent.getDoubleExtra("AMOUNT", 0.0)

        val df         = DecimalFormat("0.00")
        val btnCashOut = findViewById<Button>(R.id.btnCashOut)
        btnCashOut.text = "Withdraw AED ${df.format(amount)}"

        val serverIdInput = findViewById<EditText>(R.id.serverIdInput)
        val userIdInput   = findViewById<EditText>(R.id.userIdInput)

        btnCashOut.setOnClickListener {
            val serverId = serverIdInput.text.toString().trim()
            val userId   = userIdInput.text.toString().trim()

            if (serverId.isEmpty() || userId.isEmpty()) {
                Toast.makeText(this, "Please fill in Server ID and User ID", Toast.LENGTH_SHORT).show()
                return@setOnClickListener
            }

            btnCashOut.isEnabled = false
            btnCashOut.text = "Processing..."
            sendCashOutRequest(serverId, userId)
        }
    }

    private fun buildCashOutPayload(serverId: String, userId: String): String {
        val secret = prefs.getTerminalSecret() ?: ""

        val payload = mutableMapOf<String, Any>(
            "protocol"       to "101.6",
            "message_type"   to "CASH_OUT",
            "transaction_id" to "TXN-${System.currentTimeMillis()}",
            "timestamp"      to java.util.Date().let { java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'", java.util.Locale.US).also { sdf -> sdf.timeZone = java.util.TimeZone.getTimeZone("UTC") }.format(it) },
            "merchant" to mapOf(
                "merchant_id" to (prefs.getMerchantId() ?: ""),
                "store_id"    to "STR-01",
                "terminal_id" to (prefs.getTerminalId() ?: ""),
                "country"     to "AE",
                "currency"    to "AED"
            ),
            "amount" to mapOf(
                "value"    to amount,
                "currency" to "AED"
            ),
            "external_issuer" to mapOf(
                "server_id" to serverId,
                "user_id"   to userId
            ),
            "transaction_flags" to mapOf(
                "offline"         to false,
                "external_issuer" to true
            )
        )

        val jsonWithoutSecurity = JSONObject(payload as Map<*, *>).toString()
        val signature = HmacUtil.sign(jsonWithoutSecurity, secret)

        payload["security"] = mapOf(
            "nonce"     to "N-${System.currentTimeMillis()}",
            "signature" to signature,
            "algorithm" to "HMAC_SHA256"
        )

        return JSONObject(payload).toString()
    }

    private fun sendCashOutRequest(serverId: String, userId: String) {
        val json    = buildCashOutPayload(serverId, userId)
        val body    = json.toRequestBody("application/json; charset=utf-8".toMediaTypeOrNull())
        val url     = "${prefs.getServerUrl()}/1016/cashout"
        val request = Request.Builder().url(url).post(body).build()

        client.newCall(request).enqueue(object : Callback {
            override fun onFailure(call: Call, e: IOException) {
                runOnUiThread {
                    Toast.makeText(this@CashOutActivity, "Cash-out could not be processed: check your internet connection and retry.", Toast.LENGTH_LONG).show()
                }
                return
                // Cash-outs are also saved offline and synced later
                CoroutineScope(Dispatchers.IO).launch {
                    OfflineSyncManager.saveOffline(this@CashOutActivity, json)
                }
                runOnUiThread {
                    Toast.makeText(
                        this@CashOutActivity,
                        "No connection — cash-out stored offline and will sync automatically",
                        Toast.LENGTH_LONG
                    ).show()
                    finish()
                }
            }

            override fun onResponse(call: Call, response: Response) {
                val result = response.body?.string()
                runOnUiThread {
                    val intent = Intent(this@CashOutActivity, ResultActivity::class.java)
                    intent.putExtra("RESULT", result)
                    startActivity(intent)
                    finish()
                }
            }
        })
    }
}

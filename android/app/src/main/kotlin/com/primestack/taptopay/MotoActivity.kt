package com.primestack.taptopay

import android.content.Intent
import android.os.Bundle
import android.text.Editable
import android.text.TextWatcher
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
import java.time.Instant

class MotoActivity : AppCompatActivity() {

    private val client = OkHttpClient()
    private var amount: Double = 0.0
    private lateinit var prefs: PrefsManager

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_moto)

        prefs  = PrefsManager(this)
        amount = intent.getDoubleExtra("AMOUNT", 0.0)
        val txType = intent.getStringExtra("TX_TYPE") ?: "SALE"

        val df         = DecimalFormat("0.00")
        val btnMotoPay = findViewById<Button>(R.id.btnMotoPay)
        btnMotoPay.text = "${txType} AED ${df.format(amount)}"

        val panInput  = findViewById<EditText>(R.id.panInput)
        val expInput  = findViewById<EditText>(R.id.expInput)
        val cvvInput  = findViewById<EditText>(R.id.cvvInput)
        val nameInput = findViewById<EditText>(R.id.nameInput)

        // Auto-format card number — chunks of 4 digits
        // Uses a flag to prevent the TextWatcher from triggering itself
        var isFormatting = false
        panInput.addTextChangedListener(object : TextWatcher {
            override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) {}
            override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) {}
            override fun afterTextChanged(s: Editable?) {
                if (isFormatting) return
                isFormatting = true
                val digits = s.toString().filter { it.isDigit() }
                if (digits.length <= 16) {
                    val formatted = digits.chunked(4).joinToString(" ")
                    if (formatted != s.toString()) {
                        s?.replace(0, s.length, formatted)
                    }
                } else {
                    // Remove extra digits
                    val trimmed = digits.take(16).chunked(4).joinToString(" ")
                    s?.replace(0, s.length, trimmed)
                }
                isFormatting = false
            }
        })

        // Auto-format expiry → MM / YY
        var isFormattingExp = false
        expInput.addTextChangedListener(object : TextWatcher {
            override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) {}
            override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) {}
            override fun afterTextChanged(s: Editable?) {
                if (isFormattingExp) return
                isFormattingExp = true
                val digits = s.toString().filter { it.isDigit() }.take(4)
                val formatted = when (digits.length) {
                    0, 1 -> digits
                    2    -> "$digits / "
                    else -> "${digits.substring(0, 2)} / ${digits.substring(2)}"
                }
                if (formatted != s.toString()) {
                    s?.replace(0, s.length, formatted)
                }
                isFormattingExp = false
            }
        })

        btnMotoPay.setOnClickListener {
            val pan      = panInput.text.toString().filter { it.isDigit() }
            val expText  = expInput.text.toString()
            val expParts = expText.split("/").map { it.trim() }
            val expMonth = if (expParts.size > 0) expParts[0] else ""
            val expYear  = if (expParts.size > 1) expParts[1] else ""
            val cvv      = cvvInput.text.toString().trim()

            if (pan.length < 13) {
                Toast.makeText(this, "Please enter a valid card number", Toast.LENGTH_SHORT).show()
                return@setOnClickListener
            }
            if (expMonth.isEmpty() || expYear.isEmpty()) {
                Toast.makeText(this, "Please enter expiry date", Toast.LENGTH_SHORT).show()
                return@setOnClickListener
            }

            btnMotoPay.isEnabled = false
            btnMotoPay.text = "Processing..."
            sendMotoTransaction(pan, expMonth, expYear, cvv.isNotEmpty(), txType)
        }
    }

    /** Builds a fully signed 101.6 MOTO SALE payload. */
    fun buildMotoPayload(
        pan: String,
        expMonth: String,
        expYear: String,
        cvvPresent: Boolean,
        txType: String = "SALE"
    ): String {
        val secret = prefs.getTerminalSecret() ?: ""

        val sale = mutableMapOf<String, Any>(
            "protocol"       to "101.6",
            "message_type"   to txType,
            "transaction_id" to "TXN-${System.currentTimeMillis()}",
            "timestamp"      to Instant.now().toString(),
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
            "card" to mapOf(
                "entry_mode"   to "MOTO",
                "pan"          to pan,
                "expiry_month" to expMonth,
                "expiry_year"  to expYear,
                "cvv_present"  to cvvPresent
            ),
            "transaction_flags" to mapOf(
                "offline"   to false,
                "moto"      to true,
                "recurring" to false
            )
        )

        val jsonWithoutSecurity = JSONObject(sale as Map<*, *>).toString()
        val signature = HmacUtil.sign(jsonWithoutSecurity, secret)

        sale["security"] = mapOf(
            "nonce"     to "N-${System.currentTimeMillis()}",
            "signature" to signature,
            "algorithm" to "HMAC_SHA256"
        )

        return JSONObject(sale).toString()
    }

    private fun sendMotoTransaction(
        pan: String,
        expMonth: String,
        expYear: String,
        cvvPresent: Boolean,
        txType: String = "SALE"
    ) {
        val json    = buildMotoPayload(pan, expMonth, expYear, cvvPresent, txType)
        val body    = json.toRequestBody("application/json; charset=utf-8".toMediaTypeOrNull())
        val url     = "${prefs.getServerUrl()}/1016/transaction"
        val request = Request.Builder().url(url).post(body).build()

        client.newCall(request).enqueue(object : Callback {
            override fun onFailure(call: Call, e: IOException) {
                // ── Real offline storage ──────────────────────────────────
                CoroutineScope(Dispatchers.IO).launch {
                    OfflineSyncManager.saveOffline(this@MotoActivity, json)
                }
                runOnUiThread {
                    // Show OFFLINE result so the operator knows the tx is queued
                    val offlineResult = buildOfflineResultJson(json)
                    val intent = Intent(this@MotoActivity, ResultActivity::class.java)
                    intent.putExtra("RESULT", offlineResult)
                    startActivity(intent)
                    finish()
                }
            }

            override fun onResponse(call: Call, response: Response) {
                val result = response.body?.string()
                runOnUiThread {
                    val intent = Intent(this@MotoActivity, ResultActivity::class.java)
                    intent.putExtra("RESULT", result)
                    startActivity(intent)
                    finish()
                }
            }
        })
    }

    /**
     * Builds a synthetic "OFFLINE STORED" response so ResultActivity
     * can show the operator that the transaction was queued.
     */
    private fun buildOfflineResultJson(originalJson: String): String {
        return try {
            val orig = JSONObject(originalJson)
            JSONObject().apply {
                put("protocol",       "101.6")
                put("message_type",   "SALE_RESPONSE")
                put("transaction_id", orig.optString("transaction_id"))
                put("timestamp",      orig.optString("timestamp"))
                put("result", JSONObject().apply {
                    put("status",      "PENDING")
                    put("code",        "OF")
                    put("description", "Stored offline — will sync when connection is restored")
                    put("auth_code",   "OFFLINE")
                    put("rrn",         "")
                })
                put("amount", orig.optJSONObject("amount"))
            }.toString()
        } catch (e: Exception) {
            """{"result":{"status":"PENDING","code":"OF","description":"Stored offline"}}"""
        }
    }
}

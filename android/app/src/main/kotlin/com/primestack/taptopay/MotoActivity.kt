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
import okhttp3.FormBody
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject
import java.io.IOException
import java.text.DecimalFormat
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone

class MotoActivity : AppCompatActivity() {

    private val client = OkHttpClient()
    private var amount: Double     = 0.0
    private var txType: String     = "SALE"
    private var isOffline: Boolean = false
    private lateinit var prefs: PrefsManager
    private var stripePublishableKey: String = ""

    private fun nowUtc(): String {
        val sdf = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'", Locale.US)
        sdf.timeZone = TimeZone.getTimeZone("UTC")
        return sdf.format(Date())
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_moto)

        prefs     = PrefsManager(this)
        amount    = intent.getDoubleExtra("AMOUNT", 0.0)
        txType    = intent.getStringExtra("TX_TYPE") ?: "SALE"
        isOffline = intent.getBooleanExtra("OFFLINE", false)

        val df         = DecimalFormat("0.00")
        val btnMotoPay = findViewById<Button>(R.id.btnMotoPay)
        val modeLabel  = if (isOffline) "[OFFLINE]" else ""
        btnMotoPay.text = "$txType $modeLabel AED ${df.format(amount)}".trim()

        val panInput  = findViewById<EditText>(R.id.panInput)
        val expInput  = findViewById<EditText>(R.id.expInput)
        val cvvInput  = findViewById<EditText>(R.id.cvvInput)

        // Fetch Stripe publishable key in background
        fetchStripeKey()

        // Auto-format PAN
        var isFormatting = false
        panInput.addTextChangedListener(object : TextWatcher {
            override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) {}
            override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) {}
            override fun afterTextChanged(s: Editable?) {
                if (isFormatting) return
                isFormatting = true
                val digits = s.toString().filter { it.isDigit() }.take(16)
                val formatted = digits.chunked(4).joinToString(" ")
                if (formatted != s.toString()) s?.replace(0, s.length, formatted)
                isFormatting = false
            }
        })

        // Auto-format expiry
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
                if (formatted != s.toString()) s?.replace(0, s.length, formatted)
                isFormattingExp = false
            }
        })

        btnMotoPay.setOnClickListener {
            val pan      = panInput.text.toString().filter { it.isDigit() }
            val expText  = expInput.text.toString()
            val expParts = expText.split("/").map { it.trim() }
            val expMonth = expParts.getOrElse(0) { "" }
            val expYear  = expParts.getOrElse(1) { "" }
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
            btnMotoPay.text = "Processing…"

            if (isOffline) {
                // Offline — store directly, no Stripe call
                val json = buildPayload("OFFLINE-PENDING", expMonth, expYear, cvv.isNotEmpty(), true)
                CoroutineScope(Dispatchers.IO).launch {
                    OfflineSyncManager.saveOffline(this@MotoActivity, json)
                }
                showOfflineResult()
            } else {
                // Online — tokenize with Stripe first
                tokenizeWithStripe(pan, expMonth, expYear, cvv)
            }
        }
    }

    private fun fetchStripeKey() {
        CoroutineScope(Dispatchers.IO).launch {
            try {
                val req = Request.Builder()
                    .url("${prefs.getServerUrl()}/stripe/config")
                    .get().build()
                val res  = client.newCall(req).execute()
                val body = res.body?.string()
                if (body != null) {
                    stripePublishableKey = JSONObject(body).optString("publishable_key", "")
                }
            } catch (e: Exception) { /* use empty key */ }
        }
    }

    /**
     * Tokenize card directly with Stripe API using publishable key.
     * Card data goes to Stripe servers — never to our backend.
     * Returns pm_xxx PaymentMethod ID.
     */
    private fun tokenizeWithStripe(pan: String, expMonth: String, expYear: String, cvv: String) {
        if (stripePublishableKey.isEmpty()) {
            Toast.makeText(this, "Payment system not ready — check server connection", Toast.LENGTH_LONG).show()
            resetButton()
            return
        }

        CoroutineScope(Dispatchers.IO).launch {
            try {
                val fullYear = if (expYear.length == 2) "20$expYear" else expYear

                // POST directly to Stripe API with publishable key
                val formBody = FormBody.Builder()
                    .add("type", "card")
                    .add("card[number]", pan)
                    .add("card[exp_month]", expMonth.trimStart('0').ifEmpty { "1" })
                    .add("card[exp_year]", fullYear)
                    .apply { if (cvv.isNotEmpty()) add("card[cvc]", cvv) }
                    .build()

                val req = Request.Builder()
                    .url("https://api.stripe.com/v1/payment_methods")
                    .addHeader("Authorization", "Bearer $stripePublishableKey")
                    .post(formBody)
                    .build()

                val res  = client.newCall(req).execute()
                val body = res.body?.string() ?: ""

                if (res.isSuccessful) {
                    val pmId = JSONObject(body).optString("id", "")
                    if (pmId.startsWith("pm_")) {
                        // Send pm_xxx to our backend
                        val json = buildPayload(pmId, expMonth, expYear, cvv.isNotEmpty(), false)
                        runOnUiThread { sendToBackend(json) }
                    } else {
                        runOnUiThread {
                            Toast.makeText(this@MotoActivity, "Tokenization failed", Toast.LENGTH_LONG).show()
                            resetButton()
                        }
                    }
                } else {
                    val errMsg = try {
                        JSONObject(body).getJSONObject("error").optString("message", "Card error")
                    } catch (e: Exception) { "Card declined" }
                    runOnUiThread {
                        Toast.makeText(this@MotoActivity, errMsg, Toast.LENGTH_LONG).show()
                        resetButton()
                    }
                }
            } catch (e: Exception) {
                runOnUiThread {
                    Toast.makeText(this@MotoActivity, "Network error: ${e.message}", Toast.LENGTH_LONG).show()
                    resetButton()
                }
            }
        }
    }

    private fun buildPayload(
        panOrPmId: String,
        expMonth: String,
        expYear: String,
        cvvPresent: Boolean,
        offline: Boolean
    ): String {
        val secret = prefs.getTerminalSecret() ?: ""
        val sale = mutableMapOf<String, Any>(
            "protocol"       to "101.6",
            "message_type"   to txType,
            "transaction_id" to "TXN-${System.currentTimeMillis()}",
            "timestamp"      to nowUtc(),
            "merchant" to mapOf(
                "merchant_id" to (prefs.getMerchantId() ?: ""),
                "store_id"    to "STR-01",
                "terminal_id" to (prefs.getTerminalId() ?: ""),
                "country"     to "AE",
                "currency"    to "AED"
            ),
            "amount" to mapOf("value" to amount, "currency" to "AED"),
            "card" to mapOf(
                "entry_mode"   to "MOTO",
                "pan"          to panOrPmId,
                "expiry_month" to expMonth,
                "expiry_year"  to expYear,
                "cvv_present"  to cvvPresent
            ),
            "transaction_flags" to mapOf(
                "offline"   to offline,
                "moto"      to true,
                "recurring" to false
            )
        )
        val sig = HmacUtil.sign(JSONObject(sale as Map<*, *>).toString(), secret)
        sale["security"] = mapOf(
            "nonce"     to "N-${System.currentTimeMillis()}",
            "signature" to sig,
            "algorithm" to "HMAC_SHA256"
        )
        return JSONObject(sale).toString()
    }

    private fun sendToBackend(json: String) {
        val body    = json.toRequestBody("application/json; charset=utf-8".toMediaTypeOrNull())
        val request = Request.Builder().url("${prefs.getServerUrl()}/1016/transaction").post(body).build()

        client.newCall(request).enqueue(object : Callback {
            override fun onFailure(call: Call, e: IOException) {
                CoroutineScope(Dispatchers.IO).launch {
                    OfflineSyncManager.saveOffline(this@MotoActivity, json)
                }
                runOnUiThread { showOfflineResult() }
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

    private fun showOfflineResult() {
        val result = JSONObject().apply {
            put("protocol",       "101.6")
            put("message_type",   "SALE_RESPONSE")
            put("transaction_id", "TXN-${System.currentTimeMillis()}")
            put("timestamp",      nowUtc())
            put("result", JSONObject().apply {
                put("status",      "PENDING")
                put("code",        "OF")
                put("description", "Stored offline — will sync when connected")
                put("auth_code",   "OFFLINE")
                put("rrn",         "")
            })
            put("amount", JSONObject().apply {
                put("value",    amount)
                put("currency", "AED")
            })
        }.toString()
        val intent = Intent(this, ResultActivity::class.java)
        intent.putExtra("RESULT", result)
        startActivity(intent)
        finish()
    }

    private fun resetButton() {
        val df = DecimalFormat("0.00")
        val btn = findViewById<Button>(R.id.btnMotoPay)
        btn.isEnabled = true
        btn.text = "$txType AED ${df.format(amount)}"
    }
}

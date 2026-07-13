package com.primestack.taptopay

import android.content.Intent
import android.os.Bundle
import android.text.Editable
import android.text.TextWatcher
import android.widget.Button
import android.widget.EditText
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import com.stripe.android.Stripe
import com.stripe.android.model.CardParams
import com.stripe.android.model.PaymentMethodCreateParams
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import okhttp3.*
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject
import java.io.IOException
import java.text.DecimalFormat
import java.time.Instant

class MotoActivity : AppCompatActivity() {

    private val client = OkHttpClient()
    private var amount: Double  = 0.0
    private var txType: String  = "SALE"
    private var isOffline: Boolean = false
    private lateinit var prefs: PrefsManager
    private var stripePublishableKey: String = ""

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
        val nameInput = findViewById<EditText>(R.id.nameInput)

        // Fetch Stripe publishable key from backend
        fetchStripeKey()

        // Auto-format card number
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
                    if (formatted != s.toString()) s?.replace(0, s.length, formatted)
                } else {
                    val trimmed = digits.take(16).chunked(4).joinToString(" ")
                    s?.replace(0, s.length, trimmed)
                }
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

            if (isOffline) {
                // Offline — skip Stripe tokenization, store directly
                val json = buildMotoPayload("OFFLINE-NO-TOKEN", expMonth, expYear, cvv.isNotEmpty(), txType, true)
                CoroutineScope(Dispatchers.IO).launch {
                    OfflineSyncManager.saveOffline(this@MotoActivity, json)
                }
                val offlineResult = buildOfflineResultJson(amount, txType)
                val intent = Intent(this, ResultActivity::class.java)
                intent.putExtra("RESULT", offlineResult)
                startActivity(intent)
                finish()
            } else {
                // Online — tokenize with Stripe first
                tokenizeAndCharge(pan, expMonth, expYear, cvv)
            }
        }
    }

    private fun fetchStripeKey() {
        CoroutineScope(Dispatchers.IO).launch {
            try {
                val request  = Request.Builder().url("${prefs.getServerUrl()}/stripe/config").get().build()
                val response = client.newCall(request).execute()
                val body     = response.body?.string()
                if (body != null) {
                    val json = JSONObject(body)
                    stripePublishableKey = json.optString("publishable_key", "")
                }
            } catch (e: Exception) {
                // Will fall back to direct send if key not available
            }
        }
    }

    private fun tokenizeAndCharge(pan: String, expMonth: String, expYear: String, cvv: String) {
        if (stripePublishableKey.isEmpty()) {
            // No Stripe key — send directly (will fail on server, but at least try)
            val json = buildMotoPayload(pan, expMonth, expYear, cvv.isNotEmpty(), txType, false)
            sendToBackend(json)
            return
        }

        CoroutineScope(Dispatchers.Main).launch {
            try {
                val stripe = Stripe(this@MotoActivity, stripePublishableKey)

                // Build card params for Stripe tokenization
                val fullYear = if (expYear.length == 2) "20$expYear" else expYear
                val cardParams = PaymentMethodCreateParams.create(
                    PaymentMethodCreateParams.Card.Builder()
                        .setNumber(pan)
                        .setExpiryMonth(expMonth.toIntOrNull() ?: 1)
                        .setExpiryYear(fullYear.toIntOrNull() ?: 2026)
                        .setCvc(cvv.ifEmpty { null })
                        .build()
                )

                // Create PaymentMethod on Stripe servers
                val pmResult = withContext(Dispatchers.IO) {
                    stripe.createPaymentMethod(cardParams)
                }

                val pmId = pmResult.id
                if (pmId == null) {
                    runOnUiThread {
                        Toast.makeText(this@MotoActivity, "Card tokenization failed", Toast.LENGTH_LONG).show()
                        val btnMotoPay = findViewById<Button>(R.id.btnMotoPay)
                        btnMotoPay.isEnabled = true
                        btnMotoPay.text = "$txType AED ${DecimalFormat("0.00").format(amount)}"
                    }
                    return@launch
                }

                // Send pm_xxx token to backend instead of raw PAN
                val json = buildMotoPayload(pmId, expMonth, expYear, cvv.isNotEmpty(), txType, false)
                sendToBackend(json)

            } catch (e: Exception) {
                runOnUiThread {
                    Toast.makeText(this@MotoActivity, "Card error: ${e.message}", Toast.LENGTH_LONG).show()
                    val btnMotoPay = findViewById<Button>(R.id.btnMotoPay)
                    btnMotoPay.isEnabled = true
                    btnMotoPay.text = "$txType AED ${DecimalFormat("0.00").format(amount)}"
                }
            }
        }
    }

    fun buildMotoPayload(
        panOrToken: String,
        expMonth: String,
        expYear: String,
        cvvPresent: Boolean,
        txType: String = "SALE",
        isOffline: Boolean = false
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
                "pan"          to panOrToken,   // pm_xxx Stripe token or raw PAN for offline
                "expiry_month" to expMonth,
                "expiry_year"  to expYear,
                "cvv_present"  to cvvPresent
            ),
            "transaction_flags" to mapOf(
                "offline"   to isOffline,
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

    private fun sendToBackend(json: String) {
        val body    = json.toRequestBody("application/json; charset=utf-8".toMediaTypeOrNull())
        val url     = "${prefs.getServerUrl()}/1016/transaction"
        val request = Request.Builder().url(url).post(body).build()

        client.newCall(request).enqueue(object : Callback {
            override fun onFailure(call: Call, e: IOException) {
                CoroutineScope(Dispatchers.IO).launch {
                    OfflineSyncManager.saveOffline(this@MotoActivity, json)
                }
                runOnUiThread {
                    val offlineResult = buildOfflineResultJson(amount, txType)
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

    private fun buildOfflineResultJson(amount: Double, txType: String): String {
        return try {
            val df = DecimalFormat("0.00")
            JSONObject().apply {
                put("protocol",       "101.6")
                put("message_type",   "${txType}_RESPONSE")
                put("transaction_id", "TXN-${System.currentTimeMillis()}")
                put("timestamp",      Instant.now().toString())
                put("result", JSONObject().apply {
                    put("status",      "PENDING")
                    put("code",        "OF")
                    put("description", "Stored offline — will sync when connection is restored")
                    put("auth_code",   "OFFLINE")
                    put("rrn",         "")
                })
                put("amount", JSONObject().apply {
                    put("value",    amount)
                    put("currency", "AED")
                })
            }.toString()
        } catch (e: Exception) {
            """{"result":{"status":"PENDING","code":"OF","description":"Stored offline"}}"""
        }
    }
}

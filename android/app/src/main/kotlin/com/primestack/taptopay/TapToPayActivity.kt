package com.primestack.taptopay

import android.content.Intent
import android.nfc.NfcAdapter
import android.nfc.Tag
import android.nfc.tech.IsoDep
import android.os.Bundle
import android.widget.Button
import android.widget.TextView
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
import java.text.SimpleDateFormat
import java.util.Locale
import java.util.TimeZone

class TapToPayActivity : AppCompatActivity(), NfcAdapter.ReaderCallback {

    private var nfcAdapter: NfcAdapter? = null
    private val client = OkHttpClient()
    private var amount: Double  = 0.0
    private var txType: String  = "SALE"
    private var isOffline: Boolean = false
    private lateinit var prefs: PrefsManager

    // Floor limit — transactions AT or BELOW this amount can be approved offline
    // Fetched from backend, defaults to 100 AED
    private var floorLimitAED: Double = 100.0

    private fun nowUtc(): String {
        val sdf = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'", Locale.US)
        sdf.timeZone = TimeZone.getTimeZone("UTC")
        return sdf.format(java.util.Date())
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_tap)

        prefs     = PrefsManager(this)
        amount    = intent.getDoubleExtra("AMOUNT", 0.0)
        txType    = intent.getStringExtra("TX_TYPE") ?: "SALE"
        isOffline = intent.getBooleanExtra("OFFLINE", false)

        nfcAdapter = NfcAdapter.getDefaultAdapter(this)
        if (nfcAdapter == null) {
            Toast.makeText(this, "NFC not available on this device", Toast.LENGTH_LONG).show()
            finish()
            return
        }

        // Update tap instruction based on mode
        val tvInstruction = findViewById<TextView?>(R.id.tvTapInstruction)
        if (isOffline) {
            if (amount <= floorLimitAED) {
                tvInstruction?.text = "OFFLINE MODE — Tap card\nAmount: AED ${DecimalFormat("0.00").format(amount)}\nFloor limit: AED ${floorLimitAED.toInt()}"
            } else {
                // Amount exceeds floor limit — cannot do offline NFC
                tvInstruction?.text = "Amount AED ${DecimalFormat("0.00").format(amount)} exceeds offline floor limit (AED ${floorLimitAED.toInt()})\nRequires internet connection"
                Toast.makeText(
                    this,
                    "Amount exceeds offline floor limit (AED ${floorLimitAED.toInt()}). Please use MOTO entry or connect to internet.",
                    Toast.LENGTH_LONG
                ).show()
                finish()
                return
            }
        }

        // Fetch floor limit from backend
        fetchFloorLimit()

        enableNfc()

        val btnCancel = findViewById<Button>(R.id.btnCancel)
        btnCancel.setOnClickListener { finish() }
    }

    private fun fetchFloorLimit() {
        CoroutineScope(Dispatchers.IO).launch {
            try {
                val request  = Request.Builder()
                    .url("${prefs.getServerUrl()}/pos/config")
                    .get().build()
                val response = client.newCall(request).execute()
                val body     = response.body?.string()
                if (body != null) {
                    val json = JSONObject(body)
                    floorLimitAED = json.optDouble("floor_limit_aed", 100.0)
                }
            } catch (e: Exception) {
                // Use default 100 AED if can't reach server
            }
        }
    }

    private fun enableNfc() {
        val options = Bundle()
        options.putInt(NfcAdapter.EXTRA_READER_PRESENCE_CHECK_DELAY, 100)
        nfcAdapter?.enableReaderMode(
            this, this,
            NfcAdapter.FLAG_READER_NFC_A or
                    NfcAdapter.FLAG_READER_NFC_B or
                    NfcAdapter.FLAG_READER_SKIP_NDEF_CHECK,
            options
        )
    }

    override fun onPause() {
        super.onPause()
        nfcAdapter?.disableReaderMode(this)
    }

    override fun onResume() {
        super.onResume()
        enableNfc()
    }

    override fun onTagDiscovered(tag: Tag?) {
        val isoDep = IsoDep.get(tag) ?: return
        try {
            isoDep.connect()

            val selectPPSE = byteArrayOf(
                0x00, 0xA4.toByte(), 0x04, 0x00, 0x0E,
                0x32, 0x50, 0x41, 0x59, 0x2E, 0x53, 0x59, 0x53,
                0x2E, 0x44, 0x44, 0x46, 0x30, 0x31
            )
            val ppseResponse = isoDep.transceive(selectPPSE)
            val aid          = EmvParser.extractAid(ppseResponse)
            val aidResponse  = isoDep.transceive(EmvParser.buildSelectAidCommand(aid))
            val gpoResponse  = isoDep.transceive(EmvParser.buildGpoCommand(aidResponse))
            val cardData     = EmvParser.extractCardData(gpoResponse)
            isoDep.close()

            // Offline mode — apply floor limit logic
            if (isOffline) {
                handleOfflineTap(cardData)
            } else {
                sendToBackend(cardData, offline = false)
            }

        } catch (e: Exception) {
            runOnUiThread {
                Toast.makeText(this, "Card read error: ${e.message}", Toast.LENGTH_LONG).show()
            }
        }
    }

    private fun handleOfflineTap(cardData: Map<String, String>) {
        if (amount > floorLimitAED) {
            // Over floor limit — reject offline tap
            runOnUiThread {
                Toast.makeText(
                    this,
                    "Transaction declined — amount exceeds offline floor limit of AED ${floorLimitAED.toInt()}",
                    Toast.LENGTH_LONG
                ).show()
                finish()
            }
            return
        }

        // Under floor limit — auto-approve offline, store with FLOOR_LIMIT flag
        sendToBackend(cardData, offline = true)
    }

    fun build1016Sale(
        cardData: Map<String, String>,
        amount: Double,
        secret: String,
        offline: Boolean = false
    ): Map<String, Any> {
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
            "amount" to mapOf(
                "value"    to amount,
                "currency" to "AED"
            ),
            "card" to mapOf(
                "entry_mode"   to "CONTACTLESS",
                "pan"          to (cardData["pan"]          ?: ""),
                "expiry_month" to (cardData["expiry_month"] ?: ""),
                "expiry_year"  to (cardData["expiry_year"]  ?: ""),
                "token"        to (cardData["token"]        ?: ""),
                "emv_data"     to (cardData["cryptogram"]   ?: ""),
                "last4"        to (cardData["last4"]        ?: ""),
                "scheme"       to (cardData["scheme"]       ?: "UNKNOWN")
            ),
            "transaction_flags" to mapOf(
                "offline"      to offline,
                "floor_limit"  to offline,   // signals this was approved under floor limit
                "moto"         to false,
                "recurring"    to false
            ),
            "metadata" to mapOf(
                "floor_limit_aed" to floorLimitAED,
                "offline_reason"  to if (offline) "NO_INTERNET_FLOOR_LIMIT" else ""
            )
        )

        val jsonWithoutSecurity = JSONObject(sale as Map<*, *>).toString()
        val signature = HmacUtil.sign(jsonWithoutSecurity, secret)
        sale["security"] = mapOf(
            "nonce"     to "N-${System.currentTimeMillis()}",
            "signature" to signature,
            "algorithm" to "HMAC_SHA256"
        )
        return sale
    }

    fun sendToBackend(cardData: Map<String, String>, offline: Boolean) {
        val secret = prefs.getTerminalSecret() ?: ""
        val sale   = build1016Sale(cardData, amount, secret, offline)
        val json   = JSONObject(sale).toString()
        val body   = json.toRequestBody("application/json; charset=utf-8".toMediaTypeOrNull())

        val request = Request.Builder()
            .url("${prefs.getServerUrl()}/1016/transaction")
            .post(body)
            .build()

        client.newCall(request).enqueue(object : Callback {
            override fun onFailure(call: Call, e: IOException) {
                // Network failed — if amount is within floor limit, store offline
                if (amount <= floorLimitAED) {
                    CoroutineScope(Dispatchers.IO).launch {
                        OfflineSyncManager.saveOffline(this@TapToPayActivity, json)
                    }
                    runOnUiThread {
                        // Show floor-limit approved result
                        val result = buildFloorLimitResult(sale)
                        val intent = Intent(this@TapToPayActivity, ResultActivity::class.java)
                        intent.putExtra("RESULT", result)
                        startActivity(intent)
                        finish()
                    }
                } else {
                    runOnUiThread {
                        Toast.makeText(
                            this@TapToPayActivity,
                            "No connection and amount exceeds floor limit. Please retry when online.",
                            Toast.LENGTH_LONG
                        ).show()
                    }
                }
            }

            override fun onResponse(call: Call, response: Response) {
                val result = response.body?.string()
                runOnUiThread {
                    val intent = Intent(this@TapToPayActivity, ResultActivity::class.java)
                    intent.putExtra("RESULT", result)
                    startActivity(intent)
                    finish()
                }
            }
        })
    }

    private fun buildFloorLimitResult(sale: Map<String, Any>): String {
        val df = DecimalFormat("0.00")
        return JSONObject().apply {
            put("protocol",       "101.6")
            put("message_type",   "SALE_RESPONSE")
            put("transaction_id", sale["transaction_id"])
            put("timestamp",      nowUtc())
            put("result", JSONObject().apply {
                put("status",      "APPROVED")
                put("code",        "FL")
                put("description", "Approved offline — floor limit AED ${floorLimitAED.toInt()}")
                put("auth_code",   "FLOOR")
                put("rrn",         "")
            })
            put("amount", JSONObject().apply {
                put("value",    amount)
                put("currency", "AED")
            })
        }.toString()
    }
}

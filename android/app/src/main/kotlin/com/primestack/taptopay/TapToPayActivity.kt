package com.primestack.taptopay

import android.content.Intent
import android.nfc.NfcAdapter
import android.nfc.Tag
import android.nfc.tech.IsoDep
import android.os.Bundle
import android.widget.Button
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import okhttp3.*
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject
import java.io.IOException
import java.time.Instant

class TapToPayActivity : AppCompatActivity(), NfcAdapter.ReaderCallback {

    private var nfcAdapter: NfcAdapter? = null
    private val client = OkHttpClient()
    private var amount: Double = 0.0
    private lateinit var prefs: PrefsManager

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_tap)

        prefs  = PrefsManager(this)
        amount = intent.getDoubleExtra("AMOUNT", 0.0)

        nfcAdapter = NfcAdapter.getDefaultAdapter(this)

        if (nfcAdapter == null) {
            Toast.makeText(this, "NFC not available on this device", Toast.LENGTH_LONG).show()
            finish()
            return
        }

        val options = Bundle()
        options.putInt(NfcAdapter.EXTRA_READER_PRESENCE_CHECK_DELAY, 100)

        nfcAdapter?.enableReaderMode(
            this,
            this,
            NfcAdapter.FLAG_READER_NFC_A or
                    NfcAdapter.FLAG_READER_NFC_B or
                    NfcAdapter.FLAG_READER_SKIP_NDEF_CHECK,
            options
        )

        val btnCancel = findViewById<Button>(R.id.btnCancel)
        btnCancel.setOnClickListener { finish() }
    }

    override fun onPause() {
        super.onPause()
        nfcAdapter?.disableReaderMode(this)
    }

    override fun onResume() {
        super.onResume()
        val options = Bundle()
        options.putInt(NfcAdapter.EXTRA_READER_PRESENCE_CHECK_DELAY, 100)
        nfcAdapter?.enableReaderMode(
            this,
            this,
            NfcAdapter.FLAG_READER_NFC_A or
                    NfcAdapter.FLAG_READER_NFC_B or
                    NfcAdapter.FLAG_READER_SKIP_NDEF_CHECK,
            options
        )
    }

    // Called on a background thread by the NFC stack
    override fun onTagDiscovered(tag: Tag?) {
        val isoDep = IsoDep.get(tag) ?: return
        try {
            isoDep.connect()

            // 1. Select PPSE (Proximity Payment System Environment)
            val selectPPSE = byteArrayOf(
                0x00, 0xA4.toByte(), 0x04, 0x00,
                0x0E,
                0x32, 0x50, 0x41, 0x59, 0x2E, 0x53, 0x59, 0x53,
                0x2E, 0x44, 0x44, 0x46, 0x30, 0x31
            )
            val ppseResponse = isoDep.transceive(selectPPSE)

            // 2. Parse AID from PPSE response
            val aid = EmvParser.extractAid(ppseResponse)

            // 3. Select application (AID)
            val selectAID   = EmvParser.buildSelectAidCommand(aid)
            val aidResponse = isoDep.transceive(selectAID)

            // 4. Get processing options (GPO)
            val gpo         = EmvParser.buildGpoCommand(aidResponse)
            val gpoResponse = isoDep.transceive(gpo)

            // 5. Extract card data
            val cardData = EmvParser.extractCardData(gpoResponse)

            isoDep.close()

            // 6. Send to backend — must switch back to main thread for UI after
            sendToBackend(cardData)

        } catch (e: Exception) {
            runOnUiThread {
                Toast.makeText(this, "Card read error: ${e.message}", Toast.LENGTH_LONG).show()
            }
        }
    }

    fun build1016Sale(cardData: Map<String, String>, amount: Double, secret: String): Map<String, Any> {
        val sale = mutableMapOf<String, Any>(
            "protocol"       to "101.6",
            "message_type"   to "SALE",
            "transaction_id" to "TXN-${System.currentTimeMillis()}",
            "timestamp"      to Instant.now().toString(),
            "merchant"       to mapOf(
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
                "entry_mode" to "CONTACTLESS",
                "token"      to cardData["token"],
                "emv_data"   to cardData["cryptogram"],
                "last4"      to cardData["last4"]
            ),
            "transaction_flags" to mapOf(
                "offline"   to false,
                "moto"      to false,
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
        return sale
    }

    fun sendToBackend(cardData: Map<String, String>) {
        val secret = prefs.getTerminalSecret() ?: ""
        val sale   = build1016Sale(cardData, amount, secret)
        val json   = JSONObject(sale).toString()
        val body   = json.toRequestBody("application/json; charset=utf-8".toMediaTypeOrNull())

        val request = Request.Builder()
            .url("${prefs.getServerUrl()}/1016/transaction")
            .post(body)
            .build()

        client.newCall(request).enqueue(object : Callback {
            override fun onFailure(call: Call, e: IOException) {
                runOnUiThread {
                    Toast.makeText(
                        this@TapToPayActivity,
                        "Network error — transaction stored offline",
                        Toast.LENGTH_LONG
                    ).show()
                }
            }

            override fun onResponse(call: Call, response: Response) {
                val result = response.body?.string()
                // Back on main thread for Activity navigation
                runOnUiThread {
                    val intent = Intent(this@TapToPayActivity, ResultActivity::class.java)
                    intent.putExtra("RESULT", result)
                    startActivity(intent)
                    finish()
                }
            }
        })
    }
}

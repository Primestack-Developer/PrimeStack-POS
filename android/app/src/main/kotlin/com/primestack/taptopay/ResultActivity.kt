package com.primestack.taptopay

import android.content.Intent
import android.os.Bundle
import android.view.View
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import org.json.JSONObject
import java.text.DecimalFormat

class ResultActivity : AppCompatActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_result)

        val tvResultStatus  = findViewById<TextView>(R.id.tvResultStatus)
        val tvAmount        = findViewById<TextView>(R.id.tvAmount)
        val tvCardInfo      = findViewById<TextView>(R.id.tvCardInfo)
        val tvAuthCode      = findViewById<TextView>(R.id.tvAuthCode)
        val tvRRN           = findViewById<TextView>(R.id.tvRRN)
        val tvSTNCode       = findViewById<TextView>(R.id.tvSTNCode)
        val stnBox          = findViewById<LinearLayout>(R.id.stnBox)
        val tvOfflineNotice = findViewById<TextView>(R.id.tvOfflineNotice)
        val btnPrintReceipt = findViewById<Button>(R.id.btnPrintReceipt)
        val btnNewSale      = findViewById<Button>(R.id.btnNewSale)

        val df = DecimalFormat("0.00")
        var receiptText = ""

        val resultJson = intent.getStringExtra("RESULT")

        if (resultJson != null) {
            try {
                val json   = JSONObject(resultJson)
                val result = json.getJSONObject("result")
                val status = result.getString("status")

                // ── Status ──────────────────────────────────────────────
                when (status) {
                    "APPROVED" -> {
                        tvResultStatus.text = "APPROVED ✔"
                        tvResultStatus.setTextColor(ContextCompat.getColor(this, R.color.primestack_success))
                    }
                    "PENDING" -> {
                        tvResultStatus.text = "STORED OFFLINE"
                        tvResultStatus.setTextColor(ContextCompat.getColor(this, R.color.primestack_accent))
                        tvOfflineNotice.visibility = View.VISIBLE
                    }
                    else -> {
                        tvResultStatus.text = "DECLINED ✖"
                        tvResultStatus.setTextColor(ContextCompat.getColor(this, R.color.primestack_danger))
                    }
                }

                // ── Amount ───────────────────────────────────────────────
                val amountValue    = if (json.has("amount")) json.getJSONObject("amount").optDouble("value", 0.0) else 0.0
                val amountCurrency = if (json.has("amount")) json.getJSONObject("amount").optString("currency", "AED") else "AED"
                tvAmount.text = "$amountCurrency ${df.format(amountValue)}"

                // ── Card / Issuer info ────────────────────────────────────
                when {
                    json.has("card") -> {
                        val card   = json.getJSONObject("card")
                        val scheme = card.optString("scheme", "")
                        val last4  = card.optString("last4", "")
                        tvCardInfo.text = if (last4.isNotEmpty()) "$scheme •••• $last4" else scheme
                    }
                    json.has("external_issuer") -> {
                        tvCardInfo.text = "Issuer Ref: ${result.optString("issuer_reference", "N/A")}"
                    }
                    else -> tvCardInfo.text = ""
                }

                // ── Auth code + RRN ──────────────────────────────────────
                val authCode = result.optString("auth_code", "")
                val rrn      = result.optString("rrn", "")
                tvAuthCode.text = "Auth: $authCode"
                tvRRN.text      = "RRN: $rrn"

                // ── STN Code — shown prominently for APPROVED sales ──────
                val metadata = json.optJSONObject("metadata")
                val stnCode  = metadata?.optString("stn_code", "") ?: ""

                if (status == "APPROVED" && stnCode.isNotEmpty()) {
                    tvSTNCode.text       = stnCode
                    stnBox.visibility    = View.VISIBLE

                    // Build receipt text for sharing
                    receiptText = buildReceiptText(
                        status        = status,
                        amount        = "$amountCurrency ${df.format(amountValue)}",
                        cardInfo      = tvCardInfo.text.toString(),
                        authCode      = authCode,
                        rrn           = rrn,
                        stnCode       = stnCode,
                        transactionId = json.optString("transaction_id", "")
                    )
                }

            } catch (e: Exception) {
                tvResultStatus.text = "ERROR"
                tvResultStatus.setTextColor(ContextCompat.getColor(this, R.color.primestack_danger))
            }
        }

        // ── Share receipt ────────────────────────────────────────────────
        btnPrintReceipt.setOnClickListener {
            if (receiptText.isEmpty()) {
                Toast.makeText(this, "No receipt available", Toast.LENGTH_SHORT).show()
                return@setOnClickListener
            }
            val shareIntent = Intent(Intent.ACTION_SEND).apply {
                type = "text/plain"
                putExtra(Intent.EXTRA_TEXT, receiptText)
                putExtra(Intent.EXTRA_SUBJECT, "PrimeStack Payment Receipt")
            }
            startActivity(Intent.createChooser(shareIntent, "Share Receipt"))
        }

        // ── New sale ─────────────────────────────────────────────────────
        btnNewSale.setOnClickListener {
            val intent = Intent(this, HomeActivity::class.java)
            intent.flags = Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_NEW_TASK
            startActivity(intent)
            finish()
        }
    }

    private fun buildReceiptText(
        status: String,
        amount: String,
        cardInfo: String,
        authCode: String,
        rrn: String,
        stnCode: String,
        transactionId: String
    ): String {
        val line = "─────────────────────────"
        return """
$line
    PRIMESTACK POS
    Payment Receipt
$line
Status:   $status
Amount:   $amount
Card:     $cardInfo
Auth:     $authCode
RRN:      $rrn
Ref:      $transactionId
$line
STN CODE: $stnCode
$line
Keep this STN code.
Present it when requesting
a payout withdrawal.
$line
        """.trimIndent()
    }
}

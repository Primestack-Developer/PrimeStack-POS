package com.primestack.taptopay

import android.content.Intent
import android.os.Bundle
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import org.json.JSONObject
import android.widget.Button
import android.widget.TextView

class ResultActivity : AppCompatActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_result)

        val tvResultStatus = findViewById<TextView>(R.id.tvResultStatus)
        val tvAmount       = findViewById<TextView>(R.id.tvAmount)
        val tvCardInfo     = findViewById<TextView>(R.id.tvCardInfo)
        val tvAuthCode     = findViewById<TextView>(R.id.tvAuthCode)
        val tvRRN          = findViewById<TextView>(R.id.tvRRN)
        val btnPrintReceipt = findViewById<Button>(R.id.btnPrintReceipt)
        val btnNewSale     = findViewById<Button>(R.id.btnNewSale)

        val resultJson = intent.getStringExtra("RESULT")

        if (resultJson != null) {
            try {
                val json   = JSONObject(resultJson)
                val result = json.getJSONObject("result")
                val status = result.getString("status")

                if (status == "APPROVED") {
                    tvResultStatus.text = "APPROVED ✔"
                    tvResultStatus.setTextColor(
                        ContextCompat.getColor(this, R.color.primestack_success)
                    )
                } else {
                    tvResultStatus.text = "DECLINED ✖"
                    tvResultStatus.setTextColor(
                        ContextCompat.getColor(this, R.color.primestack_danger)
                    )
                }

                // Amount
                if (json.has("amount")) {
                    val amount = json.getJSONObject("amount")
                    tvAmount.text = "Amount: ${amount.optDouble("value", 0.0)} ${amount.optString("currency", "AED")}"
                }

                // Card info (regular sale) or issuer reference (cash-out)
                when {
                    json.has("card") -> {
                        val card = json.getJSONObject("card")
                        val scheme = card.optString("scheme", "")
                        val last4  = card.optString("last4", "")
                        tvCardInfo.text = if (last4.isNotEmpty()) "$scheme •••• $last4" else scheme
                    }
                    json.has("external_issuer") -> {
                        val issuer = json.getJSONObject("external_issuer")
                        tvCardInfo.text = "Issuer Ref: ${result.optString("issuer_reference", "N/A")}"
                    }
                    else -> tvCardInfo.text = ""
                }

                tvAuthCode.text = "Auth Code: ${result.optString("auth_code", result.getString("code"))}"
                tvRRN.text      = "RRN: ${result.optString("rrn", "N/A")}"

            } catch (e: Exception) {
                tvResultStatus.text = "ERROR"
                tvResultStatus.setTextColor(
                    ContextCompat.getColor(this, R.color.primestack_danger)
                )
            }
        }

        btnPrintReceipt.setOnClickListener {
            // Print / share: placeholder for receipt integration
        }

        btnNewSale.setOnClickListener {
            val intent = Intent(this, HomeActivity::class.java)
            intent.flags = Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_NEW_TASK
            startActivity(intent)
            finish()
        }
    }
}

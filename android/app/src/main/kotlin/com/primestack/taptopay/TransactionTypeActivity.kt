package com.primestack.taptopay

import android.content.Intent
import android.os.Bundle
import android.widget.Button
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import java.text.DecimalFormat

/**
 * TransactionTypeActivity
 *
 * Shown after amount entry.
 * Merchant selects: SALE | PRE-AUTH | VOID | REFUND
 * Then proceeds to Payment Method selection.
 */
class TransactionTypeActivity : AppCompatActivity() {

    private var amount: Double = 0.0

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_transaction_type)

        amount = intent.getDoubleExtra("AMOUNT", 0.0)

        val df = DecimalFormat("0.00")
        val tvAmount = findViewById<TextView>(R.id.tvTxAmount)
        tvAmount.text = "AED ${df.format(amount)}"

        val btnSale     = findViewById<Button>(R.id.btnTxSale)
        val btnPreAuth  = findViewById<Button>(R.id.btnTxPreAuth)
        val btnVoid     = findViewById<Button>(R.id.btnTxVoid)
        val btnRefund   = findViewById<Button>(R.id.btnTxRefund)

        btnSale.setOnClickListener    { proceed("SALE") }
        btnPreAuth.setOnClickListener { proceed("PREAUTH") }
        btnVoid.setOnClickListener    { proceed("VOID") }
        btnRefund.setOnClickListener  { proceed("REFUND") }
    }

    private fun proceed(txType: String) {
        val intent = Intent(this, PaymentMethodActivity::class.java)
        intent.putExtra("AMOUNT",   amount)
        intent.putExtra("TX_TYPE",  txType)
        startActivity(intent)
    }
}

package com.primestack.taptopay

import android.content.Intent
import android.os.Bundle
import android.widget.Button
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import java.text.DecimalFormat

class PaymentMethodActivity : AppCompatActivity() {

    private var amount: Double = 0.0
    private var txType: String = "SALE"

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_payment_method)

        amount = intent.getDoubleExtra("AMOUNT", 0.0)
        txType = intent.getStringExtra("TX_TYPE") ?: "SALE"

        // Show selected transaction type in the header
        val df = DecimalFormat("0.00")
        val tvHeader = findViewById<TextView>(R.id.tvPaymentMethodHeader)
        tvHeader?.text = "$txType — AED ${df.format(amount)}"

        val btnTapToPay  = findViewById<Button>(R.id.btnTapToPay)
        val btnCardEntry = findViewById<Button>(R.id.btnCardEntry)

        btnTapToPay.setOnClickListener {
            val i = Intent(this, TapToPayActivity::class.java)
            i.putExtra("AMOUNT",  amount)
            i.putExtra("TX_TYPE", txType)
            startActivity(i)
        }

        btnCardEntry.setOnClickListener {
            val i = Intent(this, MotoActivity::class.java)
            i.putExtra("AMOUNT",  amount)
            i.putExtra("TX_TYPE", txType)
            startActivity(i)
        }
    }
}

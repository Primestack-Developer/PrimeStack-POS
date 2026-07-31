package com.primestack.taptopay

import android.content.Intent
import android.os.Bundle
import android.widget.Button
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import java.text.DecimalFormat

/** All POS payments are processed online. The app never stores card transactions for later replay. */
class TransactionTypeActivity : AppCompatActivity() {
    private var amount = 0.0
    private var txType = "SALE"
    private lateinit var btnTxSale: Button
    private lateinit var btnTxPreAuth: Button
    private lateinit var btnTxVoid: Button
    private lateinit var btnTxRefund: Button
    private lateinit var tvSelected: TextView

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_transaction_type)
        amount = intent.getDoubleExtra("AMOUNT", 0.0)
        findViewById<TextView>(R.id.tvTxAmount).text = "AED ${DecimalFormat("0.00").format(amount)}"
        btnTxSale = findViewById(R.id.btnTxSale)
        btnTxPreAuth = findViewById(R.id.btnTxPreAuth)
        btnTxVoid = findViewById(R.id.btnTxVoid)
        btnTxRefund = findViewById(R.id.btnTxRefund)
        tvSelected = findViewById(R.id.tvSelectedType)
        btnTxSale.setOnClickListener { selectType("SALE", true) }
        btnTxPreAuth.setOnClickListener { selectType("PREAUTH", true) }
        btnTxVoid.setOnClickListener { selectType("VOID", true) }
        btnTxRefund.setOnClickListener { selectType("REFUND", true) }
        selectType("SALE", false)
    }

    private fun selectType(type: String, continueToPayment: Boolean) {
        txType = type
        listOf(btnTxSale, btnTxPreAuth, btnTxVoid, btnTxRefund).forEach {
            it.setBackgroundColor(getColor(R.color.primestack_light_gray))
        }
        val selected = when (type) {
            "PREAUTH" -> btnTxPreAuth
            "VOID" -> btnTxVoid
            "REFUND" -> btnTxRefund
            else -> btnTxSale
        }
        selected.setBackgroundColor(getColor(R.color.primestack_primary))
        selected.setTextColor(getColor(android.R.color.white))
        tvSelected.text = "Selected: $type - processed online"
        if (continueToPayment) proceed()
    }

    private fun proceed() {
        startActivity(Intent(this, PaymentMethodActivity::class.java).apply {
            putExtra("AMOUNT", amount)
            putExtra("TX_TYPE", txType)
        })
    }
}

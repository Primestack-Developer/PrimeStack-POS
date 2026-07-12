package com.primestack.taptopay

import android.content.Intent
import android.graphics.Color
import android.os.Bundle
import android.widget.Button
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import java.text.DecimalFormat

/**
 * TransactionTypeActivity
 *
 * Operator selects:
 *   1. Transaction type: SALE | PRE-AUTH | VOID | REFUND
 *   2. Processing mode:  ONLINE (Stripe charges now) | OFFLINE (stored, STN code on receipt)
 */
class TransactionTypeActivity : AppCompatActivity() {

    private var amount: Double  = 0.0
    private var txType: String  = "SALE"
    private var isOffline: Boolean = false

    private lateinit var btnTxSale:    Button
    private lateinit var btnTxPreAuth: Button
    private lateinit var btnTxVoid:    Button
    private lateinit var btnTxRefund:  Button
    private lateinit var btnOnline:    Button
    private lateinit var btnOffline:   Button
    private lateinit var tvSelected:   TextView

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_transaction_type)

        amount = intent.getDoubleExtra("AMOUNT", 0.0)

        val df = DecimalFormat("0.00")
        val tvAmount = findViewById<TextView>(R.id.tvTxAmount)
        tvAmount.text = "AED ${df.format(amount)}"

        btnTxSale    = findViewById(R.id.btnTxSale)
        btnTxPreAuth = findViewById(R.id.btnTxPreAuth)
        btnTxVoid    = findViewById(R.id.btnTxVoid)
        btnTxRefund  = findViewById(R.id.btnTxRefund)
        btnOnline    = findViewById(R.id.btnModeOnline)
        btnOffline   = findViewById(R.id.btnModeOffline)
        tvSelected   = findViewById(R.id.tvSelectedType)

        // Transaction type buttons
        btnTxSale.setOnClickListener    { selectType("SALE") }
        btnTxPreAuth.setOnClickListener { selectType("PREAUTH") }
        btnTxVoid.setOnClickListener    { selectType("VOID") }
        btnTxRefund.setOnClickListener  { selectType("REFUND") }

        // Mode buttons — tapping ONLINE or OFFLINE immediately proceeds
        btnOnline.setOnClickListener {
            isOffline = false
            proceed()
        }

        btnOffline.setOnClickListener {
            isOffline = true
            proceed()
        }

        // Default selection
        selectType("SALE")
    }

    private fun selectType(type: String) {
        txType = type

        // Reset all type buttons to unselected style
        listOf(btnTxSale, btnTxPreAuth, btnTxVoid, btnTxRefund).forEach {
            it.setBackgroundColor(getColor(R.color.primestack_light_gray))
        }
        btnTxVoid.setTextColor(getColor(R.color.primestack_danger))
        btnTxRefund.setTextColor(getColor(R.color.primestack_danger))
        btnTxSale.setTextColor(getColor(R.color.primestack_primary))
        btnTxPreAuth.setTextColor(getColor(R.color.primestack_primary))

        // Highlight selected
        val selectedBtn = when (type) {
            "SALE"    -> btnTxSale
            "PREAUTH" -> btnTxPreAuth
            "VOID"    -> btnTxVoid
            "REFUND"  -> btnTxRefund
            else      -> btnTxSale
        }
        selectedBtn.setBackgroundColor(getColor(R.color.primestack_primary))
        selectedBtn.setTextColor(getColor(android.R.color.white))

        tvSelected.text = "Selected: $type — tap ONLINE or OFFLINE to continue"
    }

    private fun proceed() {
        val intent = Intent(this, PaymentMethodActivity::class.java)
        intent.putExtra("AMOUNT",   amount)
        intent.putExtra("TX_TYPE",  txType)
        intent.putExtra("OFFLINE",  isOffline)
        startActivity(intent)
    }
}

package com.primestack.taptopay

import android.content.Intent
import android.os.Bundle
import android.widget.Button
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import java.text.DecimalFormat

class AmountActivity : AppCompatActivity() {

    private var amountString = ""
    private lateinit var tvAmountDisplay: TextView

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_amount)

        tvAmountDisplay = findViewById(R.id.tvAmountDisplay)

        val btn0 = findViewById<Button>(R.id.btn0)
        val btn1 = findViewById<Button>(R.id.btn1)
        val btn2 = findViewById<Button>(R.id.btn2)
        val btn3 = findViewById<Button>(R.id.btn3)
        val btn4 = findViewById<Button>(R.id.btn4)
        val btn5 = findViewById<Button>(R.id.btn5)
        val btn6 = findViewById<Button>(R.id.btn6)
        val btn7 = findViewById<Button>(R.id.btn7)
        val btn8 = findViewById<Button>(R.id.btn8)
        val btn9 = findViewById<Button>(R.id.btn9)
        val btnDot = findViewById<Button>(R.id.btnDot)
        val btnDel = findViewById<Button>(R.id.btnDel)
        val btnProceed = findViewById<Button>(R.id.btnProceed)

        val numberButtons = listOf(btn0, btn1, btn2, btn3, btn4, btn5, btn6, btn7, btn8, btn9, btnDot)
        numberButtons.forEach { button ->
            button.setOnClickListener {
                val text = (it as Button).text.toString()
                if (amountString.isEmpty() && text == ".") return@setOnClickListener
                if (amountString.contains(".") && text == ".") return@setOnClickListener
                amountString += text
                updateDisplay()
            }
        }

        btnDel.setOnClickListener {
            if (amountString.isNotEmpty()) {
                amountString = amountString.dropLast(1)
                updateDisplay()
            }
        }

        btnProceed.setOnClickListener {
            val amount = if (amountString.isNotEmpty()) amountString.toDouble() else 0.0
            if (amount <= 0) return@setOnClickListener
            val mode = intent.getStringExtra("MODE") ?: "SALE"
            when (mode) {
                "CASH_OUT" -> {
                    val i = Intent(this, CashOutActivity::class.java)
                    i.putExtra("AMOUNT", amount)
                    startActivity(i)
                }
                "MOTO" -> {
                    // MOTO goes directly to TransactionType → PaymentMethod
                    val i = Intent(this, TransactionTypeActivity::class.java)
                    i.putExtra("AMOUNT", amount)
                    startActivity(i)
                }
                else -> {
                    // SALE / TAP → show transaction type selector first
                    val i = Intent(this, TransactionTypeActivity::class.java)
                    i.putExtra("AMOUNT", amount)
                    startActivity(i)
                }
            }
        }
    }

    private fun updateDisplay() {
        val df = DecimalFormat("0.00")
        val amount = if (amountString.isNotEmpty()) amountString.toDouble() else 0.0
        tvAmountDisplay.text = "${df.format(amount)} AED"
    }
}

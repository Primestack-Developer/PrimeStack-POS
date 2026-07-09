package com.primestack.taptopay

import android.content.Intent
import android.os.Bundle
import android.widget.Button
import androidx.appcompat.app.AppCompatActivity

class PaymentMethodActivity : AppCompatActivity() {

    private var amount: Double = 0.0

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_payment_method)

        amount = intent.getDoubleExtra("AMOUNT", 0.0)

        val btnTapToPay = findViewById<Button>(R.id.btnTapToPay)
        val btnCardEntry = findViewById<Button>(R.id.btnCardEntry)

        btnTapToPay.setOnClickListener {
            val intent = Intent(this, TapToPayActivity::class.java)
            intent.putExtra("AMOUNT", amount)
            startActivity(intent)
        }

        btnCardEntry.setOnClickListener {
            val intent = Intent(this, MotoActivity::class.java)
            intent.putExtra("AMOUNT", amount)
            startActivity(intent)
        }
    }
}

package com.primestack.taptopay

import android.content.Intent
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import androidx.appcompat.app.AppCompatActivity

class SplashActivity : AppCompatActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_splash)

        val prefs = PrefsManager(this)

        Handler(Looper.getMainLooper()).postDelayed({
            if (prefs.isRegistered()) {
                val intent = Intent(this, HomeActivity::class.java)
                startActivity(intent)
            } else {
                val intent = Intent(this, DeviceRegistrationActivity::class.java)
                startActivity(intent)
            }
            finish()
        }, 1500)
    }
}

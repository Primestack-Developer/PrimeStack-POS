package com.primestack.taptopay

import android.content.Intent
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import okhttp3.OkHttpClient
import okhttp3.Request
import java.util.concurrent.TimeUnit

class SplashActivity : AppCompatActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_splash)

        val prefs = PrefsManager(this)

        // Wake up the backend server (free tier may be sleeping)
        // This runs in background while splash is showing
        CoroutineScope(Dispatchers.IO).launch {
            try {
                val client = OkHttpClient.Builder()
                    .connectTimeout(60, TimeUnit.SECONDS)
                    .readTimeout(60, TimeUnit.SECONDS)
                    .build()
                val request = Request.Builder()
                    .url("${prefs.getServerUrl()}/health")
                    .get().build()
                client.newCall(request).execute()
                // Backend is awake — proceed
            } catch (e: Exception) {
                // Backend unreachable — app will work offline
            }
        }

        // Navigate after 2 seconds (gives backend time to wake)
        Handler(Looper.getMainLooper()).postDelayed({
            if (prefs.isRegistered()) {
                startActivity(Intent(this, HomeActivity::class.java))
            } else {
                startActivity(Intent(this, DeviceRegistrationActivity::class.java))
            }
            finish()
        }, 2000)
    }
}

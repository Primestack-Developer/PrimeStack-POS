package com.primestack.taptopay

import android.content.Intent
import android.os.Bundle
import android.provider.Settings
import android.widget.Button
import android.widget.EditText
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import okhttp3.*
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject
import java.io.IOException

class DeviceRegistrationActivity : AppCompatActivity() {

    private val client = OkHttpClient()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_device_registration)

        val prefs = PrefsManager(this)

        val serverUrlInput  = findViewById<EditText>(R.id.serverUrlInput)
        val merchantIdInput = findViewById<EditText>(R.id.merchantIdInput)
        val terminalIdInput = findViewById<EditText>(R.id.terminalIdInput)
        val tvStatus        = findViewById<TextView>(R.id.tvStatus)
        val btnRegister     = findViewById<Button>(R.id.btnRegister)

        // Pre-fill server URL from saved prefs (so it persists across attempts)
        serverUrlInput.setText(prefs.getServerUrl())

        // Pre-fill terminal ID with unique suffix from ANDROID_ID
        val androidId         = Settings.Secure.getString(contentResolver, Settings.Secure.ANDROID_ID)
        val defaultTerminalId = "TERM-${androidId.take(8).uppercase()}"
        terminalIdInput.setText(defaultTerminalId)

        btnRegister.setOnClickListener {
            val serverUrl  = serverUrlInput.text.toString().trim().trimEnd('/')
            val merchantId = merchantIdInput.text.toString().trim()
            val terminalId = terminalIdInput.text.toString().trim()

            if (serverUrl.isEmpty()) {
                Toast.makeText(this, "Please enter the server URL", Toast.LENGTH_SHORT).show()
                return@setOnClickListener
            }
            if (merchantId.isEmpty() || terminalId.isEmpty()) {
                Toast.makeText(this, "Please fill in Merchant ID and Device ID", Toast.LENGTH_SHORT).show()
                return@setOnClickListener
            }

            // Save the URL immediately so it's available even if registration fails
            prefs.saveServerUrl(serverUrl)

            btnRegister.isEnabled = false
            tvStatus.text = "Status: Connecting to $serverUrl..."
            registerTerminal(prefs, serverUrl, merchantId, terminalId, tvStatus)
        }
    }

    private fun registerTerminal(
        prefs: PrefsManager,
        serverUrl: String,
        merchantId: String,
        terminalId: String,
        tvStatus: TextView
    ) {
        val jsonObject = JSONObject().apply {
            put("merchant_id", merchantId)
            put("terminal_id", terminalId)
        }

        val body    = jsonObject.toString()
            .toRequestBody("application/json; charset=utf-8".toMediaTypeOrNull())
        val url     = "$serverUrl/merchant/register-terminal"
        val request = Request.Builder().url(url).post(body).build()

        client.newCall(request).enqueue(object : Callback {
            override fun onFailure(call: Call, e: IOException) {
                runOnUiThread {
                    tvStatus.text = "Status: Cannot reach server — check URL"
                    Toast.makeText(
                        this@DeviceRegistrationActivity,
                        "Connection failed: ${e.message}\n\nMake sure:\n• Backend is running\n• URL is correct\n• Phone and PC are on the same WiFi",
                        Toast.LENGTH_LONG
                    ).show()
                    findViewById<Button>(R.id.btnRegister).isEnabled = true
                }
            }

            override fun onResponse(call: Call, response: Response) {
                val responseString = response.body?.string()
                runOnUiThread {
                    if (response.isSuccessful && responseString != null) {
                        try {
                            val json   = JSONObject(responseString)
                            val status = json.optString("status")

                            if (status == "SUCCESS") {
                                val secretKey = json.getString("secret_key")
                                prefs.saveTerminalCredentials(
                                    terminalId    = terminalId,
                                    terminalSecret = secretKey,
                                    merchantId    = merchantId,
                                    merchantName  = merchantId
                                )
                                tvStatus.text = "Status: Registered ✔"
                                Toast.makeText(
                                    this@DeviceRegistrationActivity,
                                    "Device registered successfully!",
                                    Toast.LENGTH_SHORT
                                ).show()
                                startActivity(
                                    Intent(this@DeviceRegistrationActivity, HomeActivity::class.java)
                                )
                                finish()
                            } else {
                                val msg = json.optString("message", "Registration failed")
                                tvStatus.text = "Status: $msg"
                                findViewById<Button>(R.id.btnRegister).isEnabled = true
                            }
                        } catch (e: Exception) {
                            tvStatus.text = "Status: Unexpected server response"
                            findViewById<Button>(R.id.btnRegister).isEnabled = true
                        }
                    } else {
                        tvStatus.text = "Status: Server error (${response.code})"
                        findViewById<Button>(R.id.btnRegister).isEnabled = true
                    }
                }
            }
        })
    }
}

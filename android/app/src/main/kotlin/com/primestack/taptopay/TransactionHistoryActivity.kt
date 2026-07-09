package com.primestack.taptopay

import android.os.Bundle
import android.view.View
import android.widget.ArrayAdapter
import android.widget.Button
import android.widget.ListView
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import com.primestack.taptopay.data.db.AppDatabase
import com.primestack.taptopay.data.db.entity.OfflineTransaction
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import org.json.JSONObject

class TransactionHistoryActivity : AppCompatActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_transaction_history)

        val listView   = findViewById<ListView>(R.id.transactionListView)
        val btnFilters = findViewById<Button>(R.id.btnFilters)

        loadHistory(listView)

        // Filters button — reload list (simple refresh for now)
        btnFilters.text = "Refresh"
        btnFilters.setOnClickListener { loadHistory(listView) }
    }

    private fun loadHistory(listView: ListView) {
        CoroutineScope(Dispatchers.IO).launch {
            val db      = AppDatabase.getInstance(this@TransactionHistoryActivity)
            val records = db.offlineDao().getAll()   // fetch all, not just PENDING

            withContext(Dispatchers.Main) {
                if (records.isEmpty()) {
                    listView.adapter = ArrayAdapter(
                        this@TransactionHistoryActivity,
                        android.R.layout.simple_list_item_1,
                        listOf("No offline transactions stored")
                    )
                    return@withContext
                }

                val display = records.map { record ->
                    formatRecord(record)
                }

                listView.adapter = ArrayAdapter(
                    this@TransactionHistoryActivity,
                    android.R.layout.simple_list_item_1,
                    display
                )
            }
        }
    }

    private fun formatRecord(record: OfflineTransaction): String {
        val sdf  = SimpleDateFormat("dd/MM/yy HH:mm", Locale.getDefault())
        val time = sdf.format(Date(record.createdAt))

        return try {
            val json   = JSONObject(record.json)
            val amount = json.optJSONObject("amount")
            val value  = amount?.optDouble("value", 0.0) ?: 0.0
            val ccy    = amount?.optString("currency", "AED") ?: "AED"
            val type   = json.optString("message_type", "SALE")
            val card   = json.optJSONObject("card")
            val mode   = card?.optString("entry_mode", "") ?: ""

            "$ccy %.2f • $type • $mode • ${record.status} • $time".format(value)
        } catch (e: Exception) {
            "Record #${record.id} • ${record.status} • $time"
        }
    }
}

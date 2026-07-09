package com.primestack.taptopay

import com.primestack.taptopay.data.db.AppDatabase
import com.primestack.taptopay.data.db.entity.OfflineTransaction
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import android.content.Context

/**
 * OfflineSyncManager
 *
 * Single place that handles:
 *  - Saving a failed transaction to the Room database
 *  - Syncing all PENDING offline records back to the 101.6 backend
 *
 * Used by MotoActivity, CashOutActivity, and the Sync button in Settings/Home.
 */
object OfflineSyncManager {

    private val httpClient = OkHttpClient()

    /**
     * Persist a signed 101.6 JSON payload as a PENDING offline record.
     * Call this whenever the network request fails.
     */
    suspend fun saveOffline(context: Context, json: String) {
        withContext(Dispatchers.IO) {
            val db = AppDatabase.getInstance(context)
            db.offlineDao().insert(OfflineTransaction(json = json))
        }
    }

    /**
     * Try to send every PENDING record to the backend.
     *
     * @param context       Android context (for Room access)
     * @param serverUrl     The base URL from PrefsManager (e.g. "https://api.primestack.io")
     * @param onProgress    Called after each record: (attempted, total, lastStatus)
     * @return              SyncResult with counts
     */
    suspend fun sync(
        context: Context,
        serverUrl: String,
        onProgress: ((attempted: Int, total: Int, status: String) -> Unit)? = null
    ): SyncResult = withContext(Dispatchers.IO) {
        val db      = AppDatabase.getInstance(context)
        val pending = db.offlineDao().getPending()

        if (pending.isEmpty()) return@withContext SyncResult(0, 0, 0)

        var synced  = 0
        var failed  = 0

        pending.forEachIndexed { index, record ->
            // Determine endpoint from the stored JSON message_type
            val endpoint = if (record.json.contains("\"CASH_OUT\"")) {
                "$serverUrl/1016/cashout"
            } else {
                "$serverUrl/1016/transaction"
            }

            val body    = record.json.toRequestBody("application/json; charset=utf-8".toMediaTypeOrNull())
            val request = Request.Builder().url(endpoint).post(body).build()

            try {
                val response = httpClient.newCall(request).execute()
                if (response.isSuccessful) {
                    db.offlineDao().updateStatus(record.id, "SYNCED")
                    synced++
                    onProgress?.invoke(index + 1, pending.size, "SYNCED")
                } else {
                    // Server rejected it (e.g. duplicate) — mark FAILED so we don't retry forever
                    db.offlineDao().updateStatus(record.id, "FAILED")
                    failed++
                    onProgress?.invoke(index + 1, pending.size, "FAILED")
                }
            } catch (e: Exception) {
                // Still no network — leave as PENDING, stop trying
                failed++
                onProgress?.invoke(index + 1, pending.size, "PENDING")
                // Don't continue — backend is still unreachable
                return@withContext SyncResult(synced, failed, pending.size - index - 1)
            }
        }

        SyncResult(synced, failed, 0)
    }

    data class SyncResult(
        val synced: Int,
        val failed: Int,
        val remaining: Int
    )
}

package com.primestack.taptopay.data.db.dao

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.Query
import com.primestack.taptopay.data.db.entity.OfflineTransaction

@Dao
interface OfflineDao {

    @Insert
    suspend fun insert(tx: OfflineTransaction)

    /** All records regardless of status — for history view */
    @Query("SELECT * FROM offline_transactions ORDER BY createdAt DESC")
    suspend fun getAll(): List<OfflineTransaction>

    /** Only PENDING records — for sync */
    @Query("SELECT * FROM offline_transactions WHERE status = 'PENDING' ORDER BY createdAt ASC")
    suspend fun getPending(): List<OfflineTransaction>

    @Query("UPDATE offline_transactions SET status = :status WHERE id = :id")
    suspend fun updateStatus(id: Int, status: String)
}

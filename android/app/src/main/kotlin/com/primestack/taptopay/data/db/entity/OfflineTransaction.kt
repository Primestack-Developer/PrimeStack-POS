package com.primestack.taptopay.data.db.entity

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "offline_transactions")
data class OfflineTransaction(
    @PrimaryKey(autoGenerate = true) val id: Int = 0,
    val json: String,
    val status: String = "PENDING",
    val createdAt: Long = System.currentTimeMillis()
)

package com.primestack.taptopay.data.db

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase
import com.primestack.taptopay.data.db.dao.OfflineDao
import com.primestack.taptopay.data.db.entity.OfflineTransaction

@Database(entities = [OfflineTransaction::class], version = 1, exportSchema = false)
abstract class AppDatabase : RoomDatabase() {

    abstract fun offlineDao(): OfflineDao

    companion object {
        @Volatile
        private var INSTANCE: AppDatabase? = null

        fun getInstance(context: Context): AppDatabase {
            return INSTANCE ?: synchronized(this) {
                Room.databaseBuilder(
                    context.applicationContext,
                    AppDatabase::class.java,
                    "primestack_db"
                ).build().also { INSTANCE = it }
            }
        }
    }
}

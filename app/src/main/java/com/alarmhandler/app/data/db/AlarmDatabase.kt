package com.alarmhandler.app.data.db

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase
import androidx.room.TypeConverters
import com.alarmhandler.app.data.model.Alarm

@Database(
    entities = [Alarm::class, AlarmHistoryEntry::class],
    version = 1,
    exportSchema = true,
)
@TypeConverters(Converters::class)
abstract class AlarmDatabase : RoomDatabase() {

    abstract fun alarmDao(): AlarmDao

    abstract fun historyDao(): HistoryDao

    companion object {
        private const val NAME = "alarm_handler.db"

        @Volatile
        private var instance: AlarmDatabase? = null

        fun get(context: Context): AlarmDatabase =
            instance ?: synchronized(this) {
                instance ?: build(context.applicationContext).also { instance = it }
            }

        private fun build(context: Context): AlarmDatabase =
            Room.databaseBuilder(context, AlarmDatabase::class.java, NAME)
                // Alarms are user data; never silently drop them on upgrade.
                // Future versions add explicit migrations here.
                .build()
    }
}

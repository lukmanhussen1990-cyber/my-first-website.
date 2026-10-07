# WorkManager (pulled in by the Google Mobile Ads SDK) creates its Room
# database by reflection (WorkDatabase_Impl). R8 full mode, the default with
# AGP 9, strips that constructor when only the old Room rules apply, and the
# app crashed at startup with "Failed to create an instance of
# androidx.work.impl.WorkDatabase". Keep every Room database's constructor.
-keep class * extends androidx.room.RoomDatabase {
    <init>();
}

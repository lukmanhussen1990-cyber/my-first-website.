# Alarm Handler R8 configuration.
#
# Room, Compose and kotlinx.serialization all ship consumer rules, so only the
# app's own reflective surfaces need to be declared here.

# Backup/restore serialises these models by name; keep them intact so a backup
# written by one build can always be restored by another.
-keep class com.alarmhandler.app.data.backup.** { *; }
-keep class com.alarmhandler.app.data.model.** { *; }
-keep class com.alarmhandler.app.data.db.** { *; }

# Manifest-declared components are entry points reached only from the system.
-keep class com.alarmhandler.app.alarm.AlarmReceiver { *; }
-keep class com.alarmhandler.app.alarm.BootReceiver { *; }
-keep class com.alarmhandler.app.alarm.AlarmService { *; }

# kotlinx.serialization generated serializers.
-keepclassmembers class ** {
    public static ** Companion;
}
-keepclasseswithmembers class ** {
    kotlinx.serialization.KSerializer serializer(...);
}

-dontwarn org.jetbrains.annotations.**

# Keep debug info for readable crash stack traces; do not rename anything.
-dontobfuscate
-keepattributes SourceFile,LineNumberTable,Signature,InnerClasses,EnclosingMethod,*Annotation*

# Kotlin stdlib is only needed for what the app actually calls.
-dontwarn kotlin.**
-dontwarn org.jetbrains.annotations.**
-dontwarn java.lang.invoke.StringConcatFactory

# Enums are looked up by name when restoring persisted state.
-keepclassmembers enum * { public static **[] values(); public static ** valueOf(java.lang.String); }

# Anthropic SDK: models are (de)serialised by Jackson via reflection.
-keep class com.anthropic.** { *; }
-keepattributes Signature,InnerClasses,EnclosingMethod,*Annotation*
-keep class com.fasterxml.jackson.** { *; }
-keepclassmembers class * {
    @com.fasterxml.jackson.annotation.* <fields>;
    @com.fasterxml.jackson.annotation.* <init>(...);
    @com.fasterxml.jackson.annotation.* <methods>;
}
-keep class kotlin.Metadata { *; }
-dontwarn java.beans.**
-dontwarn org.w3c.dom.bootstrap.**
-dontwarn org.slf4j.**
-dontwarn javax.annotation.**
-dontwarn org.conscrypt.**
-dontwarn org.bouncycastle.**
-dontwarn org.openjsse.**

# Only used by the SDK's class-based JSON-schema generator, which this app does not call.
-dontwarn java.lang.reflect.AnnotatedParameterizedType
-dontwarn java.lang.reflect.AnnotatedType

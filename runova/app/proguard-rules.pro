# RUNOVA release shrinking rules.
#
# The Anthropic SDK ships its own R8 rules (META-INF/proguard/anthropic-java-core.pro) that
# keep what Jackson needs for its request and response models; R8 applies them automatically.

# Jackson and the SDK reference optional JVM-only integrations that do not exist on Android.
-dontwarn java.beans.**
-dontwarn javax.annotation.**
-dontwarn org.w3c.dom.bootstrap.DOMImplementationRegistry
-dontwarn com.fasterxml.jackson.databind.ext.**
-dontwarn org.slf4j.**
-dontwarn io.swagger.v3.oas.annotations.**
-dontwarn com.github.victools.jsonschema.**
-dontwarn kotlin.reflect.jvm.internal.**
-dontwarn org.bouncycastle.**
-dontwarn org.conscrypt.**
-dontwarn org.openjsse.**

# Jackson creates some of the SDK's helper classes reflectively, through no-arg constructors that
# nothing in the code calls, so R8 full mode removes or merges them. The release build failed its
# connection test with "Class b9.s has no default (no arg) constructor" before these rules:
#  - every model field carries @ExcludeMissing, a bundle of
#    @JsonInclude(valueFilter = JsonField.IsMissing::class);
#  - JsonNull is written with @JsonSerialize(using = NullSerializer::class).
-keep @interface com.anthropic.core.ExcludeMissing
-keep class com.anthropic.core.JsonField$IsMissing { <init>(); }
-keep class com.fasterxml.jackson.databind.ser.std.NullSerializer { <init>(); }
# The SDK's own (de)serializers, named in @JsonSerialize/@JsonDeserialize(using = ...).
-keepclassmembers class com.anthropic.** extends com.fasterxml.jackson.databind.JsonSerializer { <init>(); }
-keepclassmembers class com.anthropic.** extends com.fasterxml.jackson.databind.JsonDeserializer { <init>(); }

# Keep line numbers for readable crash reports.
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile

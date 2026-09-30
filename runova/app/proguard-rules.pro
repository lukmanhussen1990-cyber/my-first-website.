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

# Keep line numbers for readable crash reports.
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile

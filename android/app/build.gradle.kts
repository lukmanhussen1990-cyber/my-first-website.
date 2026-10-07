import java.io.FileInputStream
import java.util.Properties

plugins {
    id("com.android.application")
    // The Flutter Gradle Plugin must be applied after the Android and Kotlin Gradle plugins.
    id("dev.flutter.flutter-gradle-plugin")
}

// Release signing: android/key.properties (never committed). See README.md.
val keystoreProperties = Properties()
val keystorePropertiesFile = rootProject.file("key.properties")
if (keystorePropertiesFile.exists()) {
    FileInputStream(keystorePropertiesFile).use { keystoreProperties.load(it) }
}

// Monetization settings (see docs/MONETIZATION.md). Read from
// android/key.properties, a -P gradle property or an environment variable.
fun monetizationSetting(name: String, env: String, default: String): String =
    keystoreProperties.getProperty(name)?.trim()
        ?: providers.gradleProperty(name).orNull?.trim()
        ?: System.getenv(env)?.trim()
        ?: default

// Base64 RSA public key from Play Console > Monetize > Monetization setup.
val playLicenseKey = monetizationSetting("playLicenseKey", "BLOCKBLAST_PLAY_LICENSE_KEY", "")
// AdMob app ID; defaults to Google's public test app ID.
val admobAppId = monetizationSetting("admobAppId", "BLOCKBLAST_ADMOB_APP_ID", "ca-app-pub-3940256099942544~3347511713")

android {
    namespace = "com.myapps.blockblast"
    compileSdk = flutter.compileSdkVersion
    ndkVersion = flutter.ndkVersion

    buildFeatures {
        buildConfig = true
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    defaultConfig {
        applicationId = "com.myapps.blockblast"
        // Android 8.0 (API 26) and above.
        minSdk = 26
        targetSdk = flutter.targetSdkVersion
        versionCode = flutter.versionCode
        versionName = flutter.versionName

        buildConfigField("String", "PLAY_LICENSE_KEY", "\"$playLicenseKey\"")
        manifestPlaceholders["admobAppId"] = admobAppId
    }

    signingConfigs {
        create("release") {
            if (keystorePropertiesFile.exists()) {
                keyAlias = keystoreProperties.getProperty("keyAlias")
                keyPassword = keystoreProperties.getProperty("keyPassword")
                storeFile = file(keystoreProperties.getProperty("storeFile"))
                storePassword = keystoreProperties.getProperty("storePassword")
            }
        }
    }

    packaging {
        jniLibs {
            // Compress native libraries: roughly halves the APK download size.
            useLegacyPackaging = true
        }
    }

    buildTypes {
        release {
            // Always signed with the release key; the build fails if
            // android/key.properties is missing instead of using debug keys.
            signingConfig = signingConfigs.getByName("release")
        }
    }
}

kotlin {
    compilerOptions {
        jvmTarget = org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17
    }
}

flutter {
    source = "../.."
}

dependencies {
    testImplementation("junit:junit:4.13.2")
}

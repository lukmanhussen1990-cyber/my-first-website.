import org.jetbrains.kotlin.gradle.dsl.JvmTarget

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

// The website (index.html + your photos, videos and songs) lives in ../../website
// and is packed into the app's assets folder when you build.
val websiteDir: File = rootProject.file("../website")

// The app name is CONFIG.name from website/index.html, so you only change it in one place.
val appName: String = websiteDir.resolve("index.html").takeIf { it.isFile }?.readText()
    ?.let { Regex("""\bname\s*:\s*["'`]([^"'`]+)["'`]""").find(it)?.groupValues?.get(1)?.trim() }
    ?.takeIf { it.isNotEmpty() }
    ?: "My Page"

// Android string resources need ' " \ & < > escaped.
fun androidString(s: String): String = s
    .replace("\\", "\\\\").replace("'", "\\'").replace("\"", "\\\"")
    .replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")

android {
    namespace = "com.imran.bio"
    compileSdk = 36

    defaultConfig {
        applicationId = "com.imran.bio"
        minSdk = 24
        targetSdk = 36
        versionCode = 30
        versionName = "2.8"
        resValue("string", "app_name", androidString(appName))
    }

    signingConfigs {
        // One shared key (in this folder) so every build - yours, GitHub's or mine -
        // can be installed over the previous one without uninstalling.
        getByName("debug") {
            storeFile = file("debug.keystore")
            storePassword = "android"
            keyAlias = "androiddebugkey"
            keyPassword = "android"
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            signingConfig = signingConfigs.getByName("debug")
        }
    }

    sourceSets {
        getByName("main") {
            assets.srcDir(websiteDir)
        }
    }

    buildFeatures {
        resValues = true
    }

    // photos, videos and songs are stored as they are inside the APK (not zipped again),
    // so the phone can read and jump around in them directly instead of unpacking them first
    androidResources {
        noCompress += listOf("mp3", "mp4", "jpg", "png", "woff2")
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}

kotlin {
    compilerOptions {
        jvmTarget.set(JvmTarget.JVM_17)
    }
}

dependencies {
    implementation("androidx.core:core-ktx:1.17.0")
    implementation("androidx.activity:activity-ktx:1.11.0")
    // WebViewAssetLoader: the page opens from https://appassets.androidplatform.net instead of file://
    implementation("androidx.webkit:webkit:1.14.0")
    testImplementation("junit:junit:4.13.2")
}

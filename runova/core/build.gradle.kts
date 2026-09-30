import org.jetbrains.kotlin.gradle.dsl.JvmTarget

// Pure-Kotlin domain logic (tracking math, calories, XP, achievements, statistics, coach rules).
// No Android dependencies, so it is unit-tested on any JVM.
plugins {
    alias(libs.plugins.kotlin.jvm)
}

java {
    sourceCompatibility = JavaVersion.VERSION_17
    targetCompatibility = JavaVersion.VERSION_17
}

kotlin {
    compilerOptions {
        jvmTarget.set(JvmTarget.JVM_17)
        // Keep JDK 21-only members (e.g. List.removeFirst()) out of the API surface:
        // this module is dexed into the Android app, which runs on API 26+.
        freeCompilerArgs.add("-Xjdk-release=17")
    }
}

dependencies {
    testImplementation(libs.junit)
    testImplementation(libs.kotlin.test.junit)
}

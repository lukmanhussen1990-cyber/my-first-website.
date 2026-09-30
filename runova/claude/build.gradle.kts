import org.jetbrains.kotlin.gradle.dsl.JvmTarget

// Optional Claude-powered answers for the AI Coach, built on the official Anthropic Java SDK.
// Plain JVM code (no Android APIs), so it is unit-tested against a local fake API server.
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
        freeCompilerArgs.add("-Xjdk-release=17")
    }
}

dependencies {
    implementation(project(":core"))
    implementation(libs.anthropic.java)
    implementation(libs.kotlinx.coroutines.core)
    testImplementation(libs.junit)
    testImplementation(libs.kotlin.test.junit)
    testImplementation(libs.kotlinx.coroutines.test)
}

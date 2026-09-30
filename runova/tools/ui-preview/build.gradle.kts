plugins {
    kotlin("jvm") version "1.9.22"
    id("org.jetbrains.compose") version "1.5.12"
    application
}

kotlin {
    jvmToolchain {
        languageVersion.set(JavaLanguageVersion.of(21))
    }
    sourceSets["main"].kotlin.srcDirs(
        "src/main/kotlin",
        "../../core/src/main/kotlin",
        "../../app/src/shared/kotlin",
    )
}

tasks.withType<org.jetbrains.kotlin.gradle.tasks.KotlinCompile>().configureEach {
    kotlinOptions {
        jvmTarget = "17"
        freeCompilerArgs += listOf("-opt-in=kotlin.RequiresOptIn")
    }
}

java {
    sourceCompatibility = JavaVersion.VERSION_17
    targetCompatibility = JavaVersion.VERSION_17
}

dependencies {
    implementation(compose.desktop.currentOs)
    implementation(compose.material3)
    implementation(compose.materialIconsExtended)
    implementation(compose.animation)
}

application {
    mainClass.set("com.runova.preview.PreviewMainKt")
    applicationDefaultJvmArgs = listOf("-Djava.awt.headless=true", "-Xmx3g")
}

tasks.named<JavaExec>("run") {
    args = listOf(
        rootProject.projectDir.resolve("../../app/src/main/res/font").absolutePath,
        rootProject.projectDir.resolve("build/previews").absolutePath,
    ) + (project.findProperty("screens")?.toString()?.split(",") ?: emptyList())
}

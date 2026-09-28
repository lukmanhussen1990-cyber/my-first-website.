import org.jetbrains.kotlin.gradle.dsl.JvmTarget

plugins {
    kotlin("jvm") version "2.1.21"
}

// Inputs prepared by tools/run-tests.sh (the same aapt2 outputs the APK build uses).
val appDir = file("../../app")
val offlineOut = file(providers.gradleProperty("offlineOut").get())
val androidApi = file(providers.gradleProperty("androidApi").get())
val testConfigDir = layout.buildDirectory.dir("generated/test-config")

kotlin {
    compilerOptions { jvmTarget.set(JvmTarget.JVM_17) }
}
java {
    sourceCompatibility = JavaVersion.VERSION_17
    targetCompatibility = JavaVersion.VERSION_17
}

sourceSets {
    main {
        kotlin.srcDir(appDir.resolve("src/main/java"))
        java.srcDir(offlineOut.resolve("gen"))
    }
    test {
        kotlin.srcDir(appDir.resolve("src/test/java"))
        java.srcDir("androidx-test-stubs")
        resources.srcDir(testConfigDir)
    }
}

// androidx.test is only published on Google Maven, which this build may not reach.
// The few classes Robolectric needs from it are provided as small stubs in androidx-test-stubs/.
configurations.all {
    exclude(group = "androidx.test")
    exclude(group = "androidx.test.espresso")
}

val robolectricJars by configurations.creating { isTransitive = false }

dependencies {
    robolectricJars("org.robolectric:robolectric:4.17")
    robolectricJars("org.robolectric:shadows-framework:4.17")
    robolectricJars("org.robolectric:sandbox:4.17")
    robolectricJars("org.robolectric:junit:4.17")
    robolectricJars("org.robolectric:utils:4.17")
    robolectricJars("org.robolectric:nativeruntime:4.17")
    robolectricJars("org.robolectric:resources:4.17")
    compileOnly(files(androidApi))
    testCompileOnly(files(androidApi))
    // Like AGP's "mockable android.jar": Robolectric resolves some android types outside its sandbox.
    testRuntimeOnly(files(androidApi))
    testImplementation("junit:junit:4.13.2")
    testImplementation("org.robolectric:robolectric:4.17")
}

// Tells Robolectric where the compiled resources and manifest are, like AGP does.
val writeTestConfig by tasks.registering {
    val out = testConfigDir
    val apk = offlineOut.resolve("base.apk")
    val manifest = offlineOut.resolve("AndroidManifest.xml")
    val assets = offlineOut.resolve("assets")
    outputs.dir(out)
    doLast {
        assets.mkdirs()
        val file = out.get().file("com/android/tools/test_config.properties").asFile
        file.parentFile.mkdirs()
        file.writeText(
            "android_merged_manifest=${manifest.absolutePath}\n" +
                "android_merged_assets=${assets.absolutePath}\n" +
                "android_resource_apk=${apk.absolutePath}\n" +
                "android_custom_package=com.imran.examcountdown\n",
        )
    }
}
tasks.named("processTestResources") { dependsOn(writeTestConfig) }

tasks.test {
    maxHeapSize = "3g"
    systemProperty("screenshotDir", providers.gradleProperty("screenshotDir").getOrElse(""))
    systemProperty("robolectric.offline", "true")
    systemProperty("robolectric.dependency.dir", providers.gradleProperty("roboDir").get())
    // Robolectric's file-descriptor interceptor (used when decoding the saved profile photo)
    // reaches into java.io, which JDK 17+ keeps closed unless it's opened explicitly.
    jvmArgs("--add-opens=java.base/java.io=ALL-UNNAMED")
    testLogging {
        events("passed", "skipped", "failed")
        exceptionFormat = org.gradle.api.tasks.testing.logging.TestExceptionFormat.FULL
        showStandardStreams = false
    }
}

tasks.register<Copy>("copyRobolectricJars") {
    from(robolectricJars)
    into(layout.buildDirectory.dir("robolectric-jars"))
}

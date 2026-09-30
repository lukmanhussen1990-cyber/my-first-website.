// JVM-only developer build: runs the :core unit tests and renders the shared Compose UI
// (app/src/shared) to PNG files with Compose Desktop. Needs no Android SDK / Google Maven.
//
//   gradle -p tools/dev :core:test :claude:test
//   (UI previews live in tools/ui-preview)
pluginManagement {
    repositories {
        mavenCentral()
        gradlePluginPortal()
    }
}

dependencyResolutionManagement {
    repositories {
        mavenCentral()
    }
    versionCatalogs {
        create("libs") {
            from(files("../../gradle/libs.versions.toml"))
        }
    }
}

rootProject.name = "runova-dev"

include(":core")
project(":core").projectDir = file("../../core")
include(":claude")
project(":claude").projectDir = file("../../claude")


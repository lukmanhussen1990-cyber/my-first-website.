// Why a mirror? Maven Central sometimes answers "429 Too Many Requests" to shared build machines,
// and Gradle then fails the whole build with a confusing "plugin not found" message.
// The Google-hosted mirror below is an exact copy of Maven Central, so it is tried first;
// the real Maven Central stays in the list as a fallback for anything the mirror does not have.

pluginManagement {
    repositories {
        google {
            content {
                includeGroupByRegex("com\\.android.*")
                includeGroupByRegex("com\\.google.*")
                includeGroupByRegex("androidx.*")
            }
        }
        maven(url = "https://maven-central.storage-download.googleapis.com/maven2")
        mavenCentral()
        gradlePluginPortal()
    }
}

dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        google()
        maven(url = "https://maven-central.storage-download.googleapis.com/maven2")
        mavenCentral()
    }
}

rootProject.name = "JARVIS"
include(":app")

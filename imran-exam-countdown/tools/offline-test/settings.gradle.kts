// Runs the app's unit and Robolectric tests without the Android Gradle Plugin.
// Used by tools/run-tests.sh; Android Studio users can simply run the tests in app/.
pluginManagement {
    repositories {
        gradlePluginPortal()
        mavenCentral()
    }
}

dependencyResolutionManagement {
    repositories {
        mavenCentral()
    }
}

rootProject.name = "offline-test"

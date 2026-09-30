// Stand-alone preview tool: renders the platform-independent RUNOVA UI (app/src/shared) to PNG
// with Compose for Desktop, so screens can be reviewed without an Android device.
//
//   gradle -p tools/ui-preview run            # all screens -> tools/ui-preview/build/previews
//   gradle -p tools/ui-preview run -Pscreens=home,running
//   gradle -p tools/ui-preview test           # tests for the shared screen-state mapping
//
// It deliberately uses Compose Multiplatform 1.5.x, whose artifacts are all on Maven Central,
// so the shared UI code sticks to APIs available in both Compose 1.5 and the app's Compose.
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
}

rootProject.name = "runova-ui-preview"

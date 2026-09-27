#!/usr/bin/env bash
# Runs the unit and Robolectric tests without the Android Gradle Plugin.
# Builds the resources first (via build-apk.sh) if needed, then runs Gradle in tools/offline-test.
# Extra arguments go to Gradle, e.g.: tools/run-tests.sh --tests '*SeasonTest*'
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT="${OUT_DIR:-$ROOT/build/offline}"
TOOLS="${TOOLCHAIN_DIR:-$HOME/.cache/imran-exam-countdown}"

if [ ! -f "$OUT/base.apk" ] || [ ! -d "$OUT/gen" ] || [ -n "${REBUILD:-}" ]; then
    "$ROOT/tools/build-apk.sh"
fi

# Robolectric downloads Android framework jars itself, which trips Maven Central's rate
# limit. Fetch them here with retries (SHA-1 checked) and run Robolectric offline.
ROBO_DIR="$TOOLS/robolectric"
mkdir -p "$ROBO_DIR"
for version in 8.0.0_r4-robolectric-r1-i7 15-robolectric-13954326-i7; do
    jar="android-all-instrumented-$version.jar"
    url="https://repo1.maven.org/maven2/org/robolectric/android-all-instrumented/$version/$jar"
    if [ ! -f "$ROBO_DIR/$jar" ]; then
        echo "Downloading $jar"
        for attempt in 1 2 3 4 5 6; do
            if curl -fsSL -o "$ROBO_DIR/$jar.part" "$url" && curl -fsSL -o "$ROBO_DIR/$jar.sha1" "$url.sha1"; then
                if [ "$(sha1sum "$ROBO_DIR/$jar.part" | cut -d' ' -f1)" = "$(cut -c1-40 "$ROBO_DIR/$jar.sha1")" ]; then
                    mv "$ROBO_DIR/$jar.part" "$ROBO_DIR/$jar"
                    break
                fi
                echo "Checksum mismatch for $jar, retrying"
            fi
            sleep $((attempt * 5))
        done
        [ -f "$ROBO_DIR/$jar" ] || { echo "Could not download $jar" >&2; exit 1; }
    fi
done

GRADLE=gradle
command -v gradle >/dev/null 2>&1 || GRADLE="$ROOT/gradlew"

cd "$ROOT/tools/offline-test"
exec "$GRADLE" --no-daemon test \
    -PofflineOut="$OUT" \
    -PandroidApi="$TOOLS/android-35-api.jar" \
    -PscreenshotDir="${SCREENSHOT_DIR:-}" \
    -ProboDir="$ROBO_DIR" \
    "$@"

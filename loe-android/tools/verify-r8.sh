#!/usr/bin/env bash
# Proves the R8-shrunk release code can still talk to Claude through the Anthropic SDK.
# It re-runs R8 with the release configuration (emitting JVM class files instead of dex),
# then runs app/src/test/.../r8/R8Harness.kt against a local fake Anthropic server.
# Run from loe-android/ after `gradle :app:assembleRelease`.
set -euo pipefail
WORK=build/verify-r8
mkdir -p "$WORK/harness"
R8JAR=$(find ~/.gradle/caches/modules-2/files-2.1/com.android.tools.build/builder -name "builder-*.jar" | sort | tail -1)
ANDROID_JAR="${ANDROID_HOME:?set ANDROID_HOME}/platforms/android-36/android.jar"
JDK="${JAVA_HOME:?set JAVA_HOME}"

gradle -q -I tools/print-classpath.init.gradle :app:printReleaseClasspath :app:compileDebugUnitTestKotlin \
  | grep '^CP:' | sed 's/^CP://' > "$WORK/classpath.txt"
(cd app/build/tmp/kotlin-classes/release && jar cf "$OLDPWD/$WORK/app-kotlin.jar" .)
(cd app/build/intermediates/javac/release/compileReleaseJavaWithJavac/classes && jar cf "$OLDPWD/$WORK/app-java.jar" .)
mkdir -p "$WORK/harness/com/loe/chat/r8"
cp app/build/tmp/kotlin-classes/debugUnitTest/com/loe/chat/r8/*.class "$WORK/harness/com/loe/chat/r8/"
(cd "$WORK/harness" && jar cf ../harness.jar .)
grep -v -E '^-print(mapping|usage|seeds|configuration)' app/build/outputs/mapping/release/configuration.txt > "$WORK/release.pro"
printf -- '-keep class com.loe.chat.r8.R8Harness { public static void main(java.lang.String[]); }\n-dontwarn org.junit.**\n' > "$WORK/harness.pro"

java -Xmx6g -cp "$R8JAR" com.android.tools.r8.R8 --release --classfile --output "$WORK/out.jar" \
  --lib "$JDK" --lib "$ANDROID_JAR" --pg-conf "$WORK/release.pro" --pg-conf "$WORK/harness.pro" \
  "$WORK/app-kotlin.jar" "$WORK/app-java.jar" \
  app/build/intermediates/compile_and_runtime_not_namespaced_r_class_jar/release/processReleaseResources/R.jar \
  "$WORK/harness.jar" $(tr '\n' ' ' < "$WORK/classpath.txt")

python3 tools/fake_anthropic.py 18765 "$WORK/server.log" &
SERVER=$!
trap 'kill $SERVER' EXIT
sleep 1
java -cp "$WORK/out.jar" com.loe.chat.r8.R8Harness http://127.0.0.1:18765

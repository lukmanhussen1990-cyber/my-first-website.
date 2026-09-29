#!/usr/bin/env bash
# Headless screenshot / smoke-test harness (Robolectric 4.14.1 + native Skia graphics, no emulator).
#
#   harness/shots.sh [options] [filter ...]
#
#   filter       substring(s) matched (case-insensitive) against "TestClass.testMethod"; only matching tests run
#   --app        (default) build the real app and run harness/src/**/*Test.java   -> build/shots/*.png
#   --sandbox    run the throw-away sandbox app (harness/sandbox) instead        -> build/shots/sandbox_*.png
#   --all        both
#   --sdk N      Android API level to emulate (34 or 35, default 35)
#   --legacy     Robolectric LEGACY graphics: smoke test only, no pixels, no PNGs
#   --rebuild    ignore caches (stubs / resources / classes / tests)
#   --keep-going don't stop at the first failing target
#   -v           show the full java command + raw Robolectric logging
#
# Env: HARNESS_JAVA_OPTS (extra JVM flags, default -Xmx3g), HARNESS_SHOTS_DIR (default <root>/build/shots),
#      TOOLS_DIR (default <root>/.tools)
set -uo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/.." && pwd)"
TOOLS="${TOOLS_DIR:-$ROOT/.tools}"
RBL="$TOOLS/rbl"
OUT="$ROOT/build/harness"
AAPT2="$TOOLS/bin/aapt2"
FRAMEWORK_RES="$TOOLS/bin/android-framework.apk"
ANDROID_ALL="$TOOLS/dl/android-all-15.jar"      # compile classpath, and (last) on the test classpath so annotation defaults resolve
KOTLIN="$TOOLS/dl/kotlin-stdlib-2.1.21.jar"
SHOTS_DIR="${HARNESS_SHOTS_DIR:-$ROOT/build/shots}"

TARGETS=app; SDK=35; GRAPHICS=NATIVE; REBUILD=0; KEEP_GOING=0; VERBOSE=0; FILTERS=()
while [ $# -gt 0 ]; do
  case "$1" in
    --app) TARGETS=app;; --sandbox) TARGETS=sandbox;; --all) TARGETS="sandbox app";;
    --sdk) SDK="$2"; shift;;
    --legacy) GRAPHICS=LEGACY;;
    --rebuild) REBUILD=1;; --keep-going) KEEP_GOING=1;; -v) VERBOSE=1;;
    -h|--help) sed -n '2,20p' "$0"; exit 0;;
    -*) echo "unknown option $1" >&2; exit 64;;
    *) FILTERS+=("$1");;
  esac
  shift
done

say() { echo "==> $*"; }
die() { echo "harness: $*" >&2; exit 2; }
quiet() { grep -v -e '^Picked up JAVA_TOOL_OPTIONS' || true; }
# newer STAMP PATH...: true if STAMP is missing or any file below PATH... is newer (or REBUILD=1)
newer() {
  [ "$REBUILD" = 1 ] && return 0
  local stamp="$1"; shift
  [ -e "$stamp" ] || return 0
  [ -n "$(find "$@" -type f -newer "$stamp" -print -quit 2>/dev/null)" ]
}

# ---------------------------------------------------------------------------------------- prerequisites
for f in "$AAPT2" "$FRAMEWORK_RES" "$ANDROID_ALL" "$KOTLIN"; do [ -e "$f" ] || die "missing build tool: $f"; done
if [ ! -f "$RBL/lib/robolectric-4.14.1.jar" ] || ! ls "$RBL"/sdk/*"$([ "$SDK" = 34 ] && echo 14- || echo 15-)"* >/dev/null 2>&1; then
  say "fetching Robolectric dependencies (one-time)"; "$HERE/fetch-rbl.sh" "$SDK" || die "fetch-rbl.sh failed"
fi
mkdir -p "$OUT" "$SHOTS_DIR" "$OUT/tmp"

# androidx.test monitor/espresso-idling stubs (real ones only exist on the blocked Google Maven)
STUBS_JAR="$RBL/androidx-test-stubs.jar"
if newer "$STUBS_JAR" "$HERE/androidx-test-stubs/src"; then
  say "compiling androidx-test stubs"
  rm -rf "$OUT/stubs" && mkdir -p "$OUT/stubs"
  find "$HERE/androidx-test-stubs/src" -name '*.java' > "$OUT/stubs.txt"
  javac -nowarn -encoding UTF-8 --release 17 -cp "$ANDROID_ALL" -d "$OUT/stubs" @"$OUT/stubs.txt" 2>&1 | quiet
  [ "${PIPESTATUS[0]}" = 0 ] || die "stub compilation failed"
  ( cd "$OUT/stubs" && jar cf "$STUBS_JAR" . )
fi

RBL_CP="$RBL/lib/*"
OPENS=""
for p in java.lang java.lang.reflect java.io java.net java.security java.text java.util java.util.concurrent \
         java.util.concurrent.atomic java.util.regex java.nio java.nio.file sun.nio.ch java.time jdk.internal.access; do
  OPENS="$OPENS --add-opens=java.base/$p=ALL-UNNAMED"
done

# harness helpers (Shots, Main) -- shared by every target
COMMON_CLASSES="$OUT/common"
if newer "$OUT/common.stamp" "$HERE/common/src" "$STUBS_JAR"; then
  say "compiling harness helpers"
  rm -rf "$COMMON_CLASSES" && mkdir -p "$COMMON_CLASSES"
  javac -nowarn -encoding UTF-8 --release 17 -cp "$ANDROID_ALL:$RBL_CP:$STUBS_JAR" -d "$COMMON_CLASSES" \
     $(find "$HERE/common/src" -name '*.java') 2>&1 | quiet
  [ "${PIPESTATUS[0]}" = 0 ] || die "helper compilation failed"
  touch "$OUT/common.stamp"
fi

# ---------------------------------------------------------------------------------------- one target
# run_target NAME MANIFEST RESDIR TARGET_SDK "JAVA_SRC_DIRS" TEST_SRC_DIR
run_target() {
  local name="$1" manifest="$2" res="$3" tsdk="$4" srcs="$5" tests="$6"
  local d="$OUT/$name" pkg
  pkg="$(sed -n 's/.*package="\([^"]*\)".*/\1/p' "$manifest" | head -1)"
  mkdir -p "$d/gen" "$d/tmp"

  # 1) resources -> base.apk (+ R.java)
  if newer "$d/res.stamp" "$res" "$manifest"; then
    say "[$name] aapt2 compile + link"
    rm -rf "$d/gen" && mkdir -p "$d/gen"
    "$AAPT2" compile --dir "$res" -o "$d/res.zip" 2>&1 | quiet
    [ "${PIPESTATUS[0]}" = 0 ] || { echo "aapt2 compile failed" >&2; return 2; }
    "$AAPT2" link -I "$FRAMEWORK_RES" --manifest "$manifest" --min-sdk-version 26 --target-sdk-version "$tsdk" \
        --java "$d/gen" --auto-add-overlay -o "$d/base.apk" "$d/res.zip" 2>&1 | quiet
    [ "${PIPESTATUS[0]}" = 0 ] || { echo "aapt2 link failed" >&2; return 2; }
    touch "$d/res.stamp"
  fi

  # 2) app classes
  if newer "$d/classes.stamp" $srcs "$d/res.stamp"; then
    say "[$name] javac (app sources)"
    rm -rf "$d/classes" && mkdir -p "$d/classes"
    find $srcs "$d/gen" -name '*.java' > "$d/sources.txt"
    javac -nowarn -encoding UTF-8 --release 17 -g:source,lines -Xlint:-options -XDsuppressNotes -Xmaxerrs 200 -proc:none \
        -cp "$ANDROID_ALL:$KOTLIN" -d "$d/classes" @"$d/sources.txt" > "$d/javac.out" 2>&1
    if [ $? -ne 0 ]; then
      rm -f "$d/classes.stamp"
      local n; n=$(grep -c ': error:' "$d/javac.out")
      echo "harness: [$name] the app does not compile yet ($n javac errors) -- first ones:" >&2
      grep -v '^Picked up' "$d/javac.out" | grep -A2 ': error:' | head -40 | sed "s|$ROOT/||" >&2
      echo "  (full log: $d/javac.out; run tools/check.sh for the canonical list; use --sandbox to test the harness alone)" >&2
      return 2
    fi
    touch "$d/classes.stamp"
  fi

  # 3) tests
  local tcp="$ANDROID_ALL:$RBL_CP:$STUBS_JAR:$KOTLIN:$COMMON_CLASSES:$d/classes"
  if newer "$d/tests.stamp" "$tests" "$COMMON_CLASSES" "$d/classes.stamp"; then
    say "[$name] javac (tests)"
    rm -rf "$d/testclasses" && mkdir -p "$d/testclasses"
    javac -nowarn -encoding UTF-8 --release 17 -g:source,lines -Xlint:-options -proc:none -cp "$tcp" -d "$d/testclasses" \
        $(find "$tests" -name '*.java') 2>&1 | quiet
    [ "${PIPESTATUS[0]}" = 0 ] || { echo "harness: [$name] test compilation failed" >&2; return 2; }
    touch "$d/tests.stamp"
  fi

  # 4) Robolectric config: AGP-style test_config.properties + robolectric.properties (defaults for every test)
  local cfg="$d/cfg"
  rm -rf "$cfg" && mkdir -p "$cfg/com/android/tools"
  cat > "$cfg/com/android/tools/test_config.properties" <<PROPS
android_merged_manifest=file:$manifest
android_merged_resources=file:$res
android_resource_apk=file:$d/base.apk
android_custom_package=$pkg
PROPS
  cat > "$cfg/robolectric.properties" <<PROPS
sdk=$SDK
graphicsMode=$GRAPHICS
PROPS

  # 5) run
  local args=(--dir "$d/testclasses")
  local f; for f in "${FILTERS[@]:-}"; do [ -n "$f" ] && args+=(--filter "$f"); done
  local cp="$d/testclasses:$cfg:$COMMON_CLASSES:$d/classes:$STUBS_JAR:$KOTLIN:$RBL_CP:$ANDROID_ALL"
  say "[$name] running tests (sdk $SDK, $GRAPHICS graphics) -> $SHOTS_DIR"
  local cmd=(java -Xmx3g ${HARNESS_JAVA_OPTS:-} $OPENS
      -Drobolectric.offline=true "-Drobolectric.dependency.dir=$RBL/sdk"
      "-Djava.io.tmpdir=$OUT/tmp" "-Dharness.shots.dir=$SHOTS_DIR" "-Dharness.graphics=$GRAPHICS" "-Dharness.name=$name"
      -Djava.awt.headless=true -Duser.timezone=UTC
      -cp "$cp" harness.Main "${args[@]}")
  [ "$VERBOSE" = 1 ] && echo "${cmd[@]}"
  "${cmd[@]}" 2> >(quiet >&2)
}

rc=0
for t in $TARGETS; do
  case "$t" in
    sandbox) run_target sandbox "$HERE/sandbox/AndroidManifest.xml" "$HERE/sandbox/res" 34 "$HERE/sandbox/src" "$HERE/sandbox/test";;
    app)     run_target app "$ROOT/app/src/main/AndroidManifest.xml" "$ROOT/app/src/main/res" 35 "$ROOT/app/src/main/java" "$HERE/src";;
  esac
  r=$?
  [ $r -ne 0 ] && { rc=$r; [ "$KEEP_GOING" = 1 ] || break; }
done
if [ $rc -eq 0 ]; then echo; ls -1 "$SHOTS_DIR"/*.png 2>/dev/null | sed "s|^|  |" | tail -60; fi
exit $rc

#!/usr/bin/env bash
# One-time setup: resolves the Robolectric dependency set from Maven Central into .tools/rbl/lib and
# pre-downloads the instrumented android-all jars Robolectric needs at runtime into .tools/rbl/sdk.
#
# Google Maven is not reachable in this environment, so androidx.test:monitor and
# espresso-idling-resource (which only exist there) are EXCLUDED here and replaced by the source stubs in
# harness/androidx-test-stubs (see README).
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/.." && pwd)"
TOOLS="${TOOLS_DIR:-$ROOT/.tools}"
RBL="$TOOLS/rbl"
mkdir -p "$RBL/lib" "$RBL/sdk"

if [ ! -f "$RBL/lib/robolectric-4.14.1.jar" ]; then
  echo "==> resolving Robolectric 4.14.1 (Maven Central)"
  mkdir -p "$RBL/resolve"
  cp "$HERE/rbl-pom.xml" "$RBL/resolve/pom.xml"
  ( cd "$RBL/resolve" && mvn -q -B dependency:copy-dependencies -DoutputDirectory="$RBL/lib" -DincludeScope=runtime )
fi

# name of the instrumented android-all artifact per API level (Robolectric 4.14.1 DefaultSdkProvider)
declare -A SDKV=( [34]=14-robolectric-10818077-i7 [35]=15-robolectric-12650502-i7 )
for api in "${@:-34 35}"; do
  for a in $api; do
    v="${SDKV[$a]:?unknown sdk $a}"
    f="$RBL/sdk/android-all-instrumented-$v.jar"
    if [ ! -s "$f" ]; then
      echo "==> downloading android-all-instrumented $v"
      for try in 1 2 3 4 5; do
        curl -sS -f -o "$f.part" "https://repo1.maven.org/maven2/org/robolectric/android-all-instrumented/$v/android-all-instrumented-$v.jar" && { mv "$f.part" "$f"; break; } || { echo "   retry $try"; sleep $((try*5)); }
      done
      [ -s "$f" ] || { echo "download failed: $f" >&2; exit 1; }
    fi
  done
done
echo "OK  Robolectric deps in $RBL"

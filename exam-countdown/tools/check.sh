#!/usr/bin/env bash
# Fast compile check (javac only). Prints errors as "path:line: message"; exit 0 if clean.
# Usage: tools/check.sh [file-substring-filter]
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TOOLS="${TOOLS_DIR:-$ROOT/.tools}"
export PATH="$PATH:$TOOLS/bin"
SRC="$ROOT/app/src/main"
B="$ROOT/build/check"
mkdir -p "$B/gen" "$B/classes"
if [ ! -f "$B/gen/.done" ] || [ -n "$(find "$SRC/res" "$SRC/AndroidManifest.xml" -newer "$B/gen/.done" -print -quit)" ]; then
  "$TOOLS/bin/aapt2" compile --dir "$SRC/res" -o "$B/res.zip" >/dev/null 2>&1 || { echo "aapt2 compile failed"; exit 2; }
  "$TOOLS/bin/aapt2" link -I "$TOOLS/bin/android-framework.apk" --manifest "$SRC/AndroidManifest.xml" \
     --min-sdk-version 26 --target-sdk-version 35 --java "$B/gen" --auto-add-overlay -o "$B/base.apk" "$B/res.zip" >/dev/null 2>&1 \
     || { echo "aapt2 link failed"; exit 2; }
  touch "$B/gen/.done"
fi
rm -rf "$B/classes" && mkdir -p "$B/classes"
find "$SRC/java" "$B/gen" -name '*.java' > "$B/sources.txt"
javac -nowarn -Xmaxerrs 100000 -encoding UTF-8 --release 17 -Xlint:-options -XDsuppressNotes \
  -cp "$TOOLS/dl/android-all-15.jar:$TOOLS/dl/kotlin-stdlib-2.1.21.jar" \
  -d "$B/classes" @"$B/sources.txt" 2>&1 | grep -v '^Picked up' > "$B/out.txt"
ERR=$(grep -c ': error:' "$B/out.txt" || true)
if [ -n "${1:-}" ]; then
  grep -A3 -F "$1" "$B/out.txt" | sed "s|$SRC/java/com/imran/examcountdown/||"
else
  sed "s|$SRC/java/com/imran/examcountdown/||" "$B/out.txt"
fi
echo "ERRORS: $ERR"
[ "$ERR" -eq 0 ]

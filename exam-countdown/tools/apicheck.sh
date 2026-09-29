#!/usr/bin/env bash
# Lists framework members used by the app that are missing from API 26 (minSdk). Run after tools/check.sh.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
T="$ROOT/.tools"
mkdir -p "$ROOT/build/apicheck"
javac -cp "$T/rbl/lib/asm-9.7.1.jar" -d "$ROOT/build/apicheck" "$ROOT/tools/apicheck/ApiCheck.java" 2> >(grep -v '^Picked up' >&2)
java -cp "$T/rbl/lib/asm-9.7.1.jar:$ROOT/build/apicheck" ApiCheck "$T/dl/android-all-26.jar" "${1:-$ROOT/build/check/classes}" 2> >(grep -v '^Picked up' >&2)

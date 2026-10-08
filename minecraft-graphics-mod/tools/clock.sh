#!/usr/bin/env bash
# 3-hour work-session clock.
#   tools/clock.sh            -> print elapsed / remaining
#   tools/clock.sh "label"    -> same, and append a line to WORKLOG.md
set -euo pipefail
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
START="$(cat "$DIR/tools/.session_start")"
BUDGET=$((3*3600))
NOW=$(date +%s)
EL=$((NOW-START)); REM=$((BUDGET-EL))
fmt(){ local s=$1; printf '%02d:%02d:%02d' $((s/3600)) $((s%3600/60)) $((s%60)); }
if [ "$REM" -lt 0 ]; then R="OVER budget by $(fmt $((-REM)))"; else R="$(fmt $REM) left"; fi
LINE="$(date -u +%Y-%m-%d\ %H:%M:%S)Z | elapsed $(fmt $EL) | $R"
echo "$LINE"
if [ "${1:-}" != "" ]; then
  python3 - "$DIR/WORKLOG.md" "- $LINE — $1" <<'PY'
import sys
path, line = sys.argv[1], sys.argv[2]
text = open(path, encoding="utf-8").read()
marker = "\n## Key decisions"
if marker in text:
    head, tail = text.split(marker, 1)
    text = head.rstrip("\n") + "\n" + line + "\n" + marker + tail
else:
    text = text.rstrip("\n") + "\n" + line + "\n"
open(path, "w", encoding="utf-8").write(text)
PY
fi

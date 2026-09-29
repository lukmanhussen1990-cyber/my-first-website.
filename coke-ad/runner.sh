#!/bin/bash
# Background render runner: renders the shot ids listed in $L/queue.txt, in order.
# Append ids to queue.txt to add work; a line "STOP" ends the runner.
cd "$(dirname "$0")"
L=/tmp/claude-0/-home-user-my-first-website-/0735c37f-ff6b-57d4-b08a-d20fb3844685/scratchpad/logs
touch "$L/queue.txt" "$L/done.txt"
while pgrep -f "render_shot.py 1$" >/dev/null; do sleep 10; done
while true; do
  next=$(grep -vxFf "$L/done.txt" "$L/queue.txt" | head -1)
  if [ -z "$next" ]; then sleep 20; continue; fi
  if [ "$next" = "STOP" ]; then exit 0; fi
  python3 -u render_shot.py "$next" >> "$L/shot$next.log" 2>&1
  echo "$next" >> "$L/done.txt"
done

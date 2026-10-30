#!/bin/bash
cd "$(dirname "$0")/.."
export SUB=6
for X in A B C D E; do
  rm -rf renders/${X}_full
  s=$(date +%s); python3 scripts/anim_$X.py full 2>/dev/null; echo "$X full $(( $(date +%s)-s ))s $(ls renders/${X}_full | wc -l) frames"
done
echo FULL DONE

#!/bin/bash
# low-res previews + full-quality stills for all new parts
cd "$(dirname "$0")/.."
export SRC=/root/.claude/uploads/c69215b6-4697-53a1-bac1-6c6b85bcc43f/397f8b4b-Introducing_Claude_Fable_5.1_-_Anthropic_1080p_h264.mp4
rm -rf renders/*_preview renders/*_stills renders/F_trans_preview
for X in A B C D E; do
  s=$(date +%s); python3 scripts/anim_$X.py preview 2>/dev/null; echo "$X preview $(( $(date +%s)-s ))s"
done
s=$(date +%s); python3 scripts/anim_E.py trans_preview; echo "F trans preview $(( $(date +%s)-s ))s"
python3 scripts/anim_A.py stills 20 59 99 2>/dev/null
python3 scripts/anim_B.py stills 46 117 151 2>/dev/null
python3 scripts/anim_C.py stills 35 62 134 2>/dev/null
python3 scripts/anim_D.py stills 38 105 168 2>/dev/null
python3 scripts/anim_E.py stills 14 58 103 2>/dev/null
python3 scripts/anim_E.py trans_full
echo ALL DONE

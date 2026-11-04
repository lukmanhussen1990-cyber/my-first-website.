"""Turn Whisper's word list into words.json (timings untouched), applying a few spelling fixes.
usage: python3 scripts/build_words.py birthday/words_raw.json birthday/words.json
Each entry: {"i", "word" (caption text, outer punctuation removed), "raw" (as transcribed), "start", "end"}
"""
import json, re, sys

src, dst = sys.argv[1], sys.argv[2]
raw = json.load(open(src))
# Whisper homophone mistakes (checked by ear against the voiceover)
FIX = {'Flower': 'Flour'}
out = []
for k, w in enumerate(raw):
    text = w['word']
    core = re.sub(r"^[\"'“”‘(]+|[\"'“”’).,!?;:…]+$", '', text)
    if core in FIX:
        text = text.replace(core, FIX[core])
        core = FIX[core]
    out.append({'i': k, 'word': core, 'raw': text, 'start': round(w['start'], 3), 'end': round(w['end'], 3)})
json.dump(out, open(dst, 'w'), indent=1)
print(f'{len(out)} words -> {dst}')
print(' '.join(f"{w['i']}:{w['word']}@{w['start']:.2f}" for w in out))

"""Bob voiceover: Whisper words -> bob/words.json (timings from Whisper, a few small fixes checked against the audio).
  - "o" + "'clock" are one word: "o'clock"
  - roll call: Whisper put the first "Bob" at 32.28-32.30, the audio has it at 32.04-32.40
usage: python3 scripts/bob_words.py
"""
import json, re

raw = json.load(open('bob/words_raw.json'))
words = []
for w in raw:
    text = w['word'].strip()
    if text.startswith("'") and words:  # o + 'clock -> o'clock
        prev = words[-1]
        prev['raw'] += text
        prev['word'] = re.sub(r"[.,!?;:]+$", '', prev['raw'])
        prev['end'] = round(w['end'], 3)
        continue
    core = re.sub(r"^[\"'“”‘(]+|[\"'“”’).,!?;:…]+$", '', text)
    words.append({'word': core, 'raw': text, 'start': round(w['start'], 3), 'end': round(w['end'], 3)})
# roll call fix (the first "Bob" before the first "here")
for k in range(len(words) - 1):
    if words[k]['word'] == 'Bob' and words[k + 1]['word'] == 'here' and abs(words[k]['start'] - 32.28) < 0.05:
        words[k]['start'], words[k]['end'] = 32.04, 32.40
for k, w in enumerate(words):
    w['i'] = k
words = [{'i': w['i'], 'word': w['word'], 'raw': w['raw'], 'start': w['start'], 'end': w['end']} for w in words]
json.dump(words, open('bob/words.json', 'w'), indent=1)
print(len(words), 'words')
print(' '.join(f"{w['i']}:{w['word']}@{w['start']:.2f}" for w in words))

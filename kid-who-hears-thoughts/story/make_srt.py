"""Write out/captions.srt from the word timestamps (short phrases, split at punctuation / 6 words).
Usage: python3 story/make_srt.py"""
import json
import os

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
words = json.load(open(os.path.join(ROOT, 'story', 'words.json')))['words']


def ts(t):
    ms = int(round(t * 1000))
    return f'{ms // 3600000:02d}:{ms // 60000 % 60:02d}:{ms // 1000 % 60:02d},{ms % 1000:03d}'


cues, cur = [], []
for w in words:
    cur.append(w)
    if w['word'][-1:] in '.,!?' or len(cur) >= 6:
        cues.append(cur)
        cur = []
if cur:
    cues.append(cur)
os.makedirs(os.path.join(ROOT, 'out'), exist_ok=True)
with open(os.path.join(ROOT, 'out', 'captions.srt'), 'w') as f:
    for i, c in enumerate(cues, 1):
        f.write(f"{i}\n{ts(c[0]['start'])} --> {ts(c[-1]['end'] + 0.15)}\n{' '.join(x['word'] for x in c)}\n\n")
print('captions.srt', len(cues), 'cues')

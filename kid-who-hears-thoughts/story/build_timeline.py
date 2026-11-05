"""Turn story/script.json + story/words.json (voiceover word timestamps) into story/timeline.json.
Shot cuts snap to the nearest word start (so shot lengths follow the narration).
Usage: python3 story/build_timeline.py"""
import json
import math
import os

here = os.path.dirname(os.path.abspath(__file__))
script = json.load(open(os.path.join(here, 'script.json')))
words = json.load(open(os.path.join(here, 'words.json')))
fps = script['fps']
duration = words['duration'] + script['tail_seconds']
frames = math.ceil(duration * fps)
starts = [w['start'] for w in words['words']]

shots = []
for i, s in enumerate(script['shots']):
    t = s['at']
    near = min(starts, key=lambda w: abs(w - t))
    if i > 0 and abs(near - t) < 0.35:
        t = max(0.0, near - 0.03)  # cut just before the word
    shots.append({'id': s['id'], 'mood': s['mood'], 'start': round(t, 3)})
for i, s in enumerate(shots):
    s['end'] = shots[i + 1]['start'] if i + 1 < len(shots) else round(duration, 3)
    s['startFrame'] = round(s['start'] * fps)
    s['endFrame'] = round(s['end'] * fps) if i + 1 < len(shots) else frames

# Caption words: join split numbers ("4" + ",000"), strip outer punctuation, mark key words.
keys = set(script['keywords'])
caps = []
for w in words['words']:
    raw = w['word'].strip()
    if caps and raw[:1] in ',.' and raw[1:2].isdigit():
        caps[-1]['text'] += raw
        caps[-1]['end'] = w['end']
        continue
    caps.append({'text': raw, 'start': w['start'], 'end': w['end']})
for i, c in enumerate(caps):
    c['text'] = c['text'].strip('.,!?;:"')
    low = c['text'].lower()
    # key emotional words in yellow; "you" only as part of "thank you"
    c['key'] = (low in keys and low != 'you') or (low == 'you' and i > 0 and caps[i - 1]['text'].lower() == 'thank')
json.dump({'title': script['title'], 'fps': fps, 'duration': round(duration, 3), 'frames': frames, 'voiceDuration': words['duration'], 'shots': shots, 'words': caps}, open(os.path.join(here, 'timeline.json'), 'w'), indent=1)
print(f"timeline: {len(shots)} shots, {len(caps)} words, {duration:.2f} s, {frames} frames")

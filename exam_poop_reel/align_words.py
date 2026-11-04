"""Word timings for captions and animation sync.
Speech-to-text gives word times that drift by ~0.1-0.3 s; the line start/end times in
audio/vo_lines.json are measured from the audio itself and are exact. So the words of each
line are mapped onto that line's exact span (keeping the relative STT timing inside the line).
Writes audio/words_aligned.json: [{w, s, e, line}] for every script word, in order."""
import json, os, re
HERE = os.path.dirname(os.path.abspath(__file__))
vo = json.load(open(os.path.join(HERE, 'audio/vo_lines.json')))
stt = json.load(open(os.path.join(HERE, 'audio/voiceover.words.json')))
script = json.load(open(os.path.join(HERE, 'script.json')))['lines']
def norm(w):
    w = re.sub(r"o{3,}", "o", re.sub(r"[^a-z0-9']", '', w.lower()))
    return "gardyloo" if re.match(r"^(gard|guard|card)", w) else w      # STT spells the made-up word freely
out, k = [], 0
for li, (L, S) in enumerate(zip(vo['lines'], script)):
    words = S['text'].split()
    seg = stt[k:k + len(words)]; k += len(words)
    assert [norm(w) for w in words] == [norm(s['w']) for s in seg], (words, [s['w'] for s in seg])
    a0, a1 = seg[0]['s'], max(seg[-1]['e'], seg[0]['s'] + 0.05)
    for w, s in zip(words, seg):
        f0 = (s['s'] - a0) / (a1 - a0); f1 = (s['e'] - a0) / (a1 - a0)
        st = L['start'] + max(0, min(1, f0)) * (L['end'] - L['start'])
        en = L['start'] + max(0, min(1, f1)) * (L['end'] - L['start'])
        out.append({'w': w, 's': round(st, 3), 'e': round(max(en, st + 0.06), 3), 'line': li + 1})
json.dump(out, open(os.path.join(HERE, 'audio/words_aligned.json'), 'w'), indent=0)
print(' '.join(f"{o['w']}@{o['s']:.2f}" for o in out))

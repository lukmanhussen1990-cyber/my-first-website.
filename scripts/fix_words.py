"""Fix Whisper's words using the real script, keeping Whisper's timings.

- Aligns Whisper's words to the script character-by-character (difflib), so
  split/merged words ("6am" -> "6" "AM", "spider webs" -> "spiderwebs") keep good timings.
- Script words Whisper missed entirely (e.g. the shouted "WHOOSH") are timed from
  the voice energy inside the gap between their neighbours.
- Also writes a per-frame (30 fps) loudness envelope used to drive mouth movement.

usage: python3 scripts/fix_words.py
reads  words_raw.json, voiceover.mp3, scripts/script.txt
writes words.json, src/data/words.json, src/data/amp.json
"""
import json, re, subprocess, difflib
import numpy as np

FPS = 30
script = open('scripts/script.txt').read()
raw = json.load(open('words_raw.json'))

# ---------- script tokens ----------
# display text: strip surrounding quotes/punctuation, keep apostrophes
tokens = []
for t in script.split():
    disp = re.sub(r"^[\"'“”‘(]+|[\"'“”’).,!?;:…]+$", '', t)
    disp = disp.replace('...', '').replace('…', '')
    if not disp:
        continue
    tokens.append({'raw': t, 'text': disp})


def norm(s):
    return re.sub(r"[^a-z0-9]", '', s.lower())


# ---------- character alignment ----------
s_chars, s_owner = [], []
for i, tk in enumerate(tokens):
    for c in norm(tk['text']):
        s_chars.append(c)
        s_owner.append(i)
w_chars, w_t0, w_t1 = [], [], []
for w in raw:
    n = norm(w['word'])
    L = max(len(n), 1)
    for k, c in enumerate(n):
        w_chars.append(c)
        w_t0.append(w['start'] + (w['end'] - w['start']) * k / L)
        w_t1.append(w['start'] + (w['end'] - w['start']) * (k + 1) / L)

sm = difflib.SequenceMatcher(None, ''.join(s_chars), ''.join(w_chars), autojunk=False)
s2w = {}
for blk in sm.get_matching_blocks():
    for k in range(blk.size):
        s2w[blk.a + k] = blk.b + k

starts = [None] * len(tokens)
ends = [None] * len(tokens)
for si, owner in enumerate(s_owner):
    if si in s2w:
        wi = s2w[si]
        starts[owner] = w_t0[wi] if starts[owner] is None else min(starts[owner], w_t0[wi])
        ends[owner] = w_t1[wi] if ends[owner] is None else max(ends[owner], w_t1[wi])

# ---------- audio energy (10 ms hop) ----------
pcm = subprocess.run(['ffmpeg', '-v', 'error', '-i', 'voiceover.mp3', '-f', 'f32le', '-ac', '1', '-ar', '16000', '-'],
                     capture_output=True, check=True).stdout
a = np.frombuffer(pcm, dtype=np.float32)
hop = 160
n = len(a) // hop
rms = np.sqrt(np.mean(a[:n * hop].reshape(n, hop) ** 2, axis=1))
db = 20 * np.log10(rms + 1e-6)


def voiced_region(t0, t1, thresh=-45):
    """longest run of frames above thresh inside [t0, t1]"""
    i0, i1 = int(t0 * 100), int(t1 * 100)
    best, cur = None, None
    for i in range(i0, i1):
        if db[i] > thresh:
            cur = (cur[0], i) if cur else (i, i)
            if best is None or (cur[1] - cur[0]) > (best[1] - best[0]):
                best = cur
        else:
            cur = None
    return (best[0] / 100, (best[1] + 1) / 100) if best else None


fixed = []
i = 0
while i < len(tokens):
    if starts[i] is not None:
        i += 1
        continue
    j = i
    while j < len(tokens) and starts[j] is None:
        j += 1
    g0 = ends[i - 1] if i > 0 else 0.0
    g1 = starts[j] if j < len(tokens) else len(a) / 16000
    reg = voiced_region(g0 + 0.03, g1 - 0.03)
    if reg is None:
        reg = (g0 + 0.05, g1 - 0.05)
    span = (reg[1] - reg[0]) / (j - i)
    for k in range(i, j):
        starts[k] = reg[0] + span * (k - i)
        ends[k] = reg[0] + span * (k - i + 1)
        fixed.append(f"{tokens[k]['text']} -> {starts[k]:.2f}-{ends[k]:.2f} (from audio energy)")
    i = j

# sanity: monotonic
for k in range(1, len(tokens)):
    if starts[k] < starts[k - 1]:
        starts[k] = starts[k - 1] + 0.02

out = []
for k, tk in enumerate(tokens):
    out.append({
        'i': k,
        'word': tk['text'],
        'start': round(starts[k], 3),
        'end': round(max(ends[k], starts[k] + 0.06), 3),
    })

# report what changed vs whisper
w_words = [norm(w['word']) for w in raw]
s_words = [norm(t['text']) for t in tokens]
for op, a0, a1, b0, b1 in difflib.SequenceMatcher(None, s_words, w_words, autojunk=False).get_opcodes():
    if op != 'equal':
        print(f"{op:8s} script{a0}:{[t['text'] for t in tokens[a0:a1]]}  whisper:{[raw[b]['word'] for b in range(b0, b1)]}")
for f in fixed:
    print('  timed', f)

json.dump(out, open('words.json', 'w'), indent=1)
json.dump(out, open('src/data/words.json', 'w'))

# ---------- per-frame loudness for lip flap ----------
total_frames = int(np.ceil(len(a) / 16000 * FPS)) + FPS
env = []
for f in range(total_frames):
    c = int(f / FPS * 100)
    seg = db[max(c - 2, 0):c + 3]
    v = float(np.max(seg)) if len(seg) else -90.0
    env.append(round(float(np.clip((v + 50) / 35, 0, 1)), 3))
json.dump(env, open('src/data/amp.json', 'w'))
print(f"{len(out)} words -> words.json; amp.json {len(env)} frames")

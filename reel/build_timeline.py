#!/usr/bin/env python3
"""Aligns the script to the voiceover, inserts comedy pauses, writes vo.wav + timeline.json."""
import json, re, subprocess, difflib, random, sys
import numpy as np
from scipy.io import wavfile

SR = 44100
HERE = __file__.rsplit('/', 1)[0]
SRC = HERE + '/voiceover_src.mp3'

LINES = [
    "Your neighbor's dog poops in your backyard. Every. Single. Day.",
    "So you decide to build a volcano.",
    "First, dig a giant crater right next to the fence. Go deep. Deeper.",
    "Pile all that dirt into a huge mountain, and pack the sides nice and tight.",
    "Next, dig a secret tunnel under the fence, straight to his septic tank.",
    "Connect a thick pipe from his tank to the bottom of your crater.",
    "Line the inside with stone, so the pressure has nowhere to go.",
    "Add a pump. A big one.",
    "Now collect every poop his dog ever left you, and drop it in the top. That's your fuel.",
    "Plant some palm trees, add some rocks, and make it look totally innocent.",
    "Then wait for his barbecue party.",
    "Press the button.",
    "The ground starts shaking. Steam pours out. And then...",
    "Brown lava blasts into the sky, and rains down on his entire party.",
    "The dog never comes back.",
    "Congratulations. You just built a backyard poop volcano. Follow for more.",
]
HL = {'volcano', 'poop', 'poops', 'septic', 'pump', 'lava', 'blasts', 'congratulations', 'button'}
norm = lambda s: re.sub(r"[^a-z']", '', s.lower())

# ---------- audio ----------
raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', SRC, '-f', 'f32le', '-ac', '1', '-ar', str(SR), '-'], capture_output=True).stdout
a = np.frombuffer(raw, dtype=np.float32).copy()
a /= max(1e-6, np.abs(a).max())
hop = int(SR * 0.005)
env = np.sqrt(np.convolve(a ** 2, np.ones(hop * 4) / (hop * 4), mode='same'))[::hop]
thr = 10 ** (-34 / 20)
act = env > thr
# speech islands (gap >= 90 ms splits)
islands = []; i = 0; n = len(act)
while i < n:
    if act[i]:
        j = i
        while j < n and act[j]: j += 1
        islands.append([i * 0.005, j * 0.005]); i = j
    else: i += 1
merged = []
for s, e in islands:
    if e - s < 0.03: continue
    if merged and s - merged[-1][1] < 0.09: merged[-1][1] = e
    else: merged.append([s, e])
islands = merged

# ---------- align script to whisper ----------
ww = json.load(open(HERE + '/whisper_words.json'))
script = []
for li, line in enumerate(LINES):
    for wi, tok in enumerate(line.split()):
        script.append({'tok': tok, 'line': li + 1, 'idx': wi})
A = [norm(w['tok']) for w in script]; B = [norm(w['w']) for w in ww]
sm = difflib.SequenceMatcher(a=A, b=B, autojunk=False)
for tag, i1, i2, j1, j2 in sm.get_opcodes():
    if tag == 'equal':
        for k in range(i2 - i1): script[i1 + k]['s'] = ww[j1 + k]['s']; script[i1 + k]['e'] = ww[j1 + k]['e']
    elif tag == 'replace' and (i2 - i1) == (j2 - j1):
        for k in range(i2 - i1): script[i1 + k]['s'] = ww[j1 + k]['s']; script[i1 + k]['e'] = ww[j1 + k]['e']
    elif tag == 'replace':
        s0, e0 = ww[j1]['s'], ww[j2 - 1]['e']; m = i2 - i1
        for k in range(m): script[i1 + k]['s'] = s0 + (e0 - s0) * k / m; script[i1 + k]['e'] = s0 + (e0 - s0) * (k + 1) / m
missing = [w for w in script if 's' not in w]
if missing: print('UNALIGNED', [w['tok'] for w in missing]); sys.exit(1)

# ---------- refine with speech islands ----------
print('islands', [(round(x,2),round(y,2)) for x,y in islands])
NW, NI = len(script), len(islands)
def wcost(w, k):
    s_, e_ = islands[k]; d = max(0.06, w['e'] - w['s'])
    o = max(0.0, min(e_, w['e']) - max(s_, w['s']))
    c = (w['s'] + w['e']) / 2
    dist = 0.0 if s_ <= c <= e_ else min(abs(c - s_), abs(c - e_))
    return (1 - o / d) + dist * 2.0
def punct(w):
    t = w['tok']
    return 2 if re.search(r'[.!?]$', t) else (1 if t.endswith(',') else 0)
INF = 1e9
dp = [[INF] * NI for _ in range(NW)]; bk = [[0] * NI for _ in range(NW)]
dp[0][0] = wcost(script[0], 0)
for i in range(1, NW):
    pc = punct(script[i - 1])
    for k in range(NI):
        stay = dp[i - 1][k] + (1.6 if pc == 2 else 0.0)
        move = dp[i - 1][k - 1] + (-1.0 if pc == 2 else (-0.2 if pc == 1 else 1.2)) if k > 0 else INF
        if stay <= move: dp[i][k] = stay; bk[i][k] = k
        else: dp[i][k] = move; bk[i][k] = k - 1
        dp[i][k] += wcost(script[i], k)
k = NI - 1
for i in range(NW - 1, -1, -1):
    script[i]['isl'] = k; k = bk[i][k]
groups = {}
for w in script: groups.setdefault(w['isl'], []).append(w)
for k, ws in groups.items():
    s, e = islands[k]
    lens = [max(0.06, 0.5 * (w['e'] - w['s']) + 0.5 * (0.05 * len(norm(w['tok'])) + 0.04)) for w in ws]; tot = sum(lens); t = s
    for w, L in zip(ws, lens):
        w['s'] = t; t += (e - s) * L / tot; w['e'] = t

# ---------- insert pauses ----------
def W(line, idx): return next(w for w in script if w['line'] == line and w['idx'] == idx)
def gap_after(w):
    nxt = script[script.index(w) + 1]
    return (w['e'] + nxt['s']) / 2
ins = [
    (gap_after(W(1, 9)), 0.40),    # after "Day."
    (gap_after(W(12, 2)), 0.30),   # after "button."
    (gap_after(W(13, 6)), 0.40),   # before "And then..."
    (gap_after(W(13, 8)), 0.70),   # hold after "And then..."
    (gap_after(W(14, 12)), 0.80),  # splat aftermath
]
ins.sort()
out = []; prev = 0
for t, d in ins:
    cut = int(t * SR); out.append(a[prev:cut]); out.append(np.zeros(int(d * SR), dtype=np.float32)); prev = cut
out.append(a[prev:])
for w in script:
    sh = sum(d for t, d in ins if t <= w['s'] + 1e-6)
    w['s'] += sh; w['e'] += sh
TAIL = 2.3
vo = np.concatenate(out)
vo_end = len(vo) / SR
last = script[-1]['e']
dur = round(last + 0.45 + 1.75, 2)
vo = np.concatenate([vo, np.zeros(max(0, int(dur * SR) - len(vo)), dtype=np.float32)])[: int(dur * SR)]
wavfile.write(HERE + '/build/vo.wav', SR, (vo * 0.89 * 32767).astype(np.int16))

# ---------- timeline ----------
def ws(line, idx): return W(line, idx)['s']
def we(line, idx): return W(line, idx)['e']
S = [0.0] + [max(0.0, ws(i, 0) - 0.08) for i in range(1, 17)]
S[1] = 0.0
boom = ws(14, 0) - 0.06
S[14] = boom
S.append(dur)
rnd = random.Random(4)
E = {}
E['dog_poop'] = ws(1, 3) + 0.2
E['poop_pops'] = [E['dog_poop'], ws(1, 7) + 0.04, ws(1, 8) + 0.04, ws(1, 9) + 0.04]
E['ring1'] = ws(2, 4)
E['exc_arrive'] = S[3] + 0.85
E['dig_start'] = S[3] + 0.95
E['cut_deeper'] = ws(3, 10) - 0.1
E['deeper'] = ws(3, 12)
sc = []; t = E['dig_start'] + 0.15
while t < S[4] - 0.25: sc.append(round(t, 3)); t += 0.5
E['scoops'] = sc
E['ring2'] = S[4] + 0.02
E['cone_stages'] = [ws(4, 0) + 0.3, ws(4, 3), ws(4, 6), ws(4, 7) + 0.22]
E['pats'] = [ws(4, 9), ws(4, 11), ws(4, 12), ws(4, 14)]
E['tunnel_ring'] = S[5] + 0.02
E['tunnel_start'] = ws(5, 1)
E['tunnel_end'] = ws(5, 9)
E['tank_arrow'] = ws(5, 11) - 0.05
E['pipe_start'] = S[6] + 0.25
E['pipe_end'] = ws(6, 9) + 0.1
r0, r1 = S[7] + 0.2, ws(7, 9)
E['stone_rings'] = [round(r0 + (r1 - r0) * k / 13, 3) for k in range(14)]
E['pump_land'] = ws(8, 2) + 0.12
E['pump_big'] = ws(8, 4)
E['dump1'] = ws(9, 3) + 0.05
E['dump2'] = ws(9, 8)
E['cut_fuel'] = ws(9, 9) - 0.05
d0, d1 = E['cut_fuel'] + 0.1, S[10] - 0.75
E['poop_drops'] = [round(d0 + (d1 - d0) * k / 15, 3) for k in range(16)]
E['fuel_arrow'] = ws(9, 15) - 0.05
E['palms'] = [ws(10, 0) + 0.05, ws(10, 2), ws(10, 3) + 0.1]
E['rocks'] = [round(ws(10, 4) + 0.11 * k, 3) for k in range(6)]
E['bushes'] = [round(ws(10, 7) + 0.1 * k, 3) for k in range(7)]
E['party_items'] = [S[11] + 0.05, S[11] + 0.22, S[11] + 0.4]
E['people'] = [round(S[11] + 0.3 + 0.2 * k, 3) for k in range(6)]
E['button_press'] = ws(12, 2) + 0.08
E['shake_start'] = S[13]
E['steam_start'] = ws(13, 4) - 0.12
E['dial_cut'] = we(13, 6) + 0.18
E['andthen'] = ws(13, 7)
E['boom'] = boom
E['cut14b'] = ws(14, 6) - 0.05
E['cut14c'] = ws(14, 10) - 0.05
E['rain_start'] = E['cut14b'] + 0.35
E['rain_end'] = S[15] - 0.15
E['grill_hit'] = ws(14, 11) + 0.2
E['table_hit'] = E['grill_hit'] + 0.5
E['splats'] = sorted(round(rnd.uniform(E['rain_start'], E['rain_end']), 3) for _ in range(16))
E['dog_peek'] = S[15] + 0.05
E['dog_run'] = ws(15, 2) + 0.2
E['follow_pop'] = ws(16, 8) - 0.05
E['follow_tap'] = last + 0.45
E = {k: ([round(x, 3) for x in v] if isinstance(v, list) else round(v, 3)) for k, v in E.items()}

words = []
for w in script:
    core = re.sub(r"^[^\w']+|[^\w']+$", '', w['tok'])
    disp = core[0].upper() + core[1:]
    if w['line'] == 13 and w['idx'] == 8: disp = 'Then...'
    words.append({'t': disp, 's': round(w['s'], 3), 'e': round(w['e'], 3), 'line': w['line'], 'hl': norm(core) in HL})
json.dump({'fps': 30, 'duration': dur, 'S': [round(x, 3) for x in S], 'E': E, 'words': words}, open(HERE + '/build/timeline.json', 'w'), indent=1)
print('duration', dur, 'frames', int(round(dur * 30)))
print('scenes', [round(x, 2) for x in S])
print(' '.join(f"{w['t']}@{w['s']:.2f}" for w in words))

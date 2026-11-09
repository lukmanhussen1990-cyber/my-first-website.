# Voiceover: tighten pauses, time-stretch (pitch preserved) to the target length, and write the
# timeline (word timestamps + loudness envelope for lip sync) used by the renderer.
import json, re, subprocess, sys, difflib
import numpy as np

SR = 48000
SRC, WORDS_JSON = 'audio/vo_user.mp3', 'audio/vo_user_words.json'
TARGET = float(sys.argv[1]) if len(sys.argv) > 1 else 32.0   # spoken length after processing
LEAD = 0.12                                                    # silence before the first word
SCRIPT = ("You're rubbing up and down on it, you're moaning loud, and boom, her dad walks in. But it's just your back. "
          "It's itchy. REALLY itchy. So Grandma saves the day. She knits you a special scratch sweater… made of Velcro. "
          "You put it on… and it feels AMAZING. Until you lean on the wall… and you stick. You pull free… and get stuck on "
          "the ceiling fan instead. Dad holds the button. Of course he does. You spin faster and faster… and fly right out "
          "the window. Onto the neighbor's trampoline. Boing. Boing. BOING. Last bounce, you land on the roof… and her dad is "
          "already up there. He hands you a pancake. The itch is gone. You're a genius. Kind of.")

def load(path):
    pcm = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-f', 'f32le', '-ac', '1', '-ar', str(SR), '-'], capture_output=True, check=True).stdout
    return np.frombuffer(pcm, dtype=np.float32).copy()

def save(path, x):
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'f32le', '-ac', '1', '-ar', str(SR), '-i', '-', '-c:a', 'pcm_s16le', path], input=x.astype(np.float32).tobytes(), check=True)

norm = lambda s: re.sub(r"[^a-z']", '', s.lower())

# ---- align whisper words to the script words ----
script = SCRIPT.split()
wh = json.load(open(WORDS_JSON))['words']
a = [norm(w) for w in script]
b = [norm(w['text']) for w in wh]
sm = difflib.SequenceMatcher(a=a, b=b, autojunk=False)
times = [None] * len(script)
for tag, i1, i2, j1, j2 in sm.get_opcodes():
    if tag == 'equal':
        for k in range(i2 - i1): times[i1 + k] = (wh[j1 + k]['start'], wh[j1 + k]['end'])
    elif j2 > j1:
        # replaced span: spread the whisper words over the script words
        s0, e0 = wh[j1]['start'], wh[j2 - 1]['end']
        n = i2 - i1
        for k in range(n): times[i1 + k] = (s0 + (e0 - s0) * k / n, s0 + (e0 - s0) * (k + 1) / n)
for i, tm in enumerate(times):
    if tm is None:  # interpolate missing
        prev = times[i - 1][1] if i else 0
        times[i] = (prev, prev + 0.15)
print('aligned', len(script), 'script words to', len(wh), 'whisper words')

# ---- tighten pauses (energy based) ----
x = load(SRC)
hop = int(0.01 * SR)
rms = np.sqrt(np.convolve(x ** 2, np.ones(hop) / hop, mode='same'))[::hop] + 1e-9
db = 20 * np.log10(rms / rms.max())
quiet = db < -38
segs = []  # silent regions (start, end) in seconds
i = 0
while i < len(quiet):
    if quiet[i]:
        j = i
        while j < len(quiet) and quiet[j]: j += 1
        segs.append((i * 0.01, j * 0.01)); i = j
    else: i += 1
kind_start = times[script.index('Kind')][0]
keep_pieces = []  # (orig_start, orig_end) of audio we keep
cursor = 0.0
first_word = times[0][0]
for s, e in segs:
    dur = e - s
    if e <= first_word + 0.02:  # leading silence: drop
        cursor = max(cursor, e - 0.03); continue
    keep = 0.30 if abs(e - kind_start) < 0.4 else 0.10   # comic beat before "Kind of."
    if dur > keep + 0.04:
        cut0 = s + keep / 2
        cut1 = e - keep / 2
        keep_pieces.append((cursor, cut0)); cursor = cut1
keep_pieces.append((cursor, len(x) / SR))
# build the time map orig->tight
pieces, mapping, acc = [], [], 0.0
fade = int(0.006 * SR)
for s, e in keep_pieces:
    seg = x[int(s * SR):int(e * SR)].copy()
    if len(seg) > 2 * fade:
        seg[:fade] *= np.linspace(0, 1, fade); seg[-fade:] *= np.linspace(1, 0, fade)
    pieces.append(seg); mapping.append((s, e, acc)); acc += (e - s)
tight = np.concatenate(pieces)
# trim trailing silence
tail = np.where(np.abs(tight) > 0.01)[0]
tight = tight[:tail[-1] + int(0.08 * SR)]
L1 = len(tight) / SR
def tmap(t):
    for s, e, o in mapping:
        if t <= e: return o + max(0.0, t - s)
    return mapping[-1][2] + (t - mapping[-1][0])
tempo = max(1.0, L1 / TARGET)
print(f'original {len(x)/SR:.2f}s -> tightened {L1:.2f}s -> tempo x{tempo:.3f}')
save('audio/vo_tight.wav', tight)
subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', 'audio/vo_tight.wav', '-af', f'rubberband=tempo={tempo:.5f}:pitchq=quality:transients=crisp:formant=preserved',
                '-ar', str(SR), '-ac', '1', 'audio/vo_fast.wav'], check=True)
fast = load('audio/vo_fast.wav')
# gentle cleanup: high-pass + light compression + loudness
vo = np.concatenate([np.zeros(int(LEAD * SR), np.float32), fast])
save('audio/vo_stage.wav', vo)
subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', 'audio/vo_stage.wav', '-af',
                'highpass=f=70,acompressor=threshold=-20dB:ratio=3:attack=5:release=80:makeup=2,loudnorm=I=-16:TP=-2:LRA=7',
                '-ar', str(SR), '-ac', '1', 'audio/vo_final.wav'], check=True)
vo = load('audio/vo_final.wav')

words = []
for w, (s, e) in zip(script, times):
    words.append({'text': w, 'start': round(LEAD + tmap(s) / tempo, 3), 'end': round(LEAD + tmap(e) / tempo, 3)})
# fix tiny overlaps
for i in range(1, len(words)):
    if words[i]['start'] < words[i - 1]['start'] + 0.02: words[i]['start'] = words[i - 1]['start'] + 0.02
# loudness envelope at 30 fps (for mouth shapes)
fh = SR // 30
n = len(vo) // fh + 1
envv = np.array([np.sqrt(np.mean(vo[k * fh:(k + 1) * fh] ** 2)) if k * fh < len(vo) else 0 for k in range(n)])
envv = envv / (np.percentile(envv[envv > 0], 95) + 1e-9)
envv = np.clip(envv, 0, 1)
sm_env = np.convolve(envv, [0.25, 0.5, 0.25], mode='same')
end = len(vo) / SR
json.dump({'words': words, 'voiceEnv': [round(float(v), 3) for v in sm_env], 'voEnd': round(end, 3), 'end': round(words[-1]['end'] + 1.35, 3)}, open('src/timeline.json', 'w'))
print(f'voice file {end:.2f}s, last word ends {words[-1]["end"]:.2f}s; video ~{words[-1]["end"] + 1.35:.2f}s')
print(' '.join(f"{w['text']}@{w['start']:.2f}" for w in words[:16]))

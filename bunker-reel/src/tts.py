"""Synthesize the narration line by line (Kokoro, am_onyx) and force-align
every word with PocketSphinx. Writes audio/vo/<id>.wav + audio/vo/align.json."""
import sys, json, re, os, numpy as np, soundfile as sf
from scipy.signal import resample_poly
from kokoro_onnx import Kokoro
from pocketsphinx import Decoder

S = sys.argv[1]
OUT = f'{S}/audio/vo'
os.makedirs(OUT, exist_ok=True)
FAST = {'s5a', 's5b', 's8a', 's8b', 's8c'}   # lines that must fit a tighter window
LINES = [
    ('s1',  "What if you dug a secret bunker... right under your living room?"),
    ('s2a', "First, the rug comes off."),
    ('s2b', "Then we cut straight through the wooden floor."),
    ('s3a', "Under that is a thick concrete slab."),
    ('s3b', "It has to go."),
    ('s4a', "We dig down nearly four meters,"),
    ('s4b', "carefully moving the water pipe out of the way."),
    ('s5a', "Steel and thick concrete walls make it strong enough to survive almost anything."),
    ('s5b', "And this pipe brings in fresh air."),
    ('s6',  "Inside, we add beds, lights, food, water, and a ladder up to a secret hatch."),
    ('s7',  "Then the hatch closes, the floor slides back, and the rug hides everything."),
    ('s8a', "Congratulations."),
    ('s8b', "Your living room now hides a secret bunker..."),
    ('s8c', "and nobody will ever know."),
]
k = Kokoro(f'{S}/models/kokoro-v1.0.onnx', f'{S}/models/voices-v1.0.bin')
# voice chosen by the user: deep American blend (55% am_michael + 45% am_fenrir)
VOICE = 0.55 * k.get_voice_style('am_michael') + 0.45 * k.get_voice_style('am_fenrir')


def trim(a, sr, thr=0.008, pad=0.04):
    env = np.convolve(np.abs(a), np.ones(240) / 240, 'same')
    idx = np.where(env > thr)[0]
    a0 = max(0, idx[0] - int(pad * sr)); a1 = min(len(a), idx[-1] + int(pad * sr))
    return a[a0:a1]


def align(a, sr, words):
    a16 = resample_poly(a, 2, 3)
    pcm = (np.clip(a16, -1, 1) * 32767).astype(np.int16).tobytes()
    d = Decoder(samprate=16000, bestpath=False)
    d.set_align_text(' '.join(words))
    d.start_utt(); d.process_raw(pcm, full_utt=True); d.end_utt()
    segs = [(s.word, s.start_frame / 100.0, (s.end_frame + 1) / 100.0) for s in d.seg()]
    segs = [s for s in segs if s[0] not in ('<s>', '</s>', '<sil>', '(NULL)') and not s[0].startswith('[')]
    return segs


res = {}
for lid, text in LINES:
    a, sr = k.create(text, voice=VOICE, speed=0.85 if lid in FAST else 0.8, lang='en-us')
    a = trim(np.asarray(a, np.float32), sr)
    sf.write(f'{OUT}/{lid}.wav', a, sr)
    shown = text.replace('...', '…').split()
    words = [re.sub(r"[^a-z']", '', w.lower()) for w in shown]
    segs = align(a, sr, words)
    clean = [s for s in segs]
    if len(clean) != len(words):
        print('ALIGN MISMATCH', lid, [c[0] for c in clean], words)
    res[lid] = dict(text=text, dur=len(a) / sr,
                    words=[dict(w=shown[i], t0=c[1], t1=c[2]) for i, c in enumerate(clean[:len(shown)])])
    print(f'{lid:4s} {len(a)/sr:5.2f}s ', ' '.join(f"{w['w']}@{w['t0']:.2f}" for w in res[lid]['words']))
json.dump(res, open(f'{OUT}/align.json', 'w'), indent=1)

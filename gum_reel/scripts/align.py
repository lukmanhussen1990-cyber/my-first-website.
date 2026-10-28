# Forced alignment of the known script against voiceover.mp3 with PocketSphinx (bundled en-us model).
import os, re, json, wave, sys
import numpy as np
import pocketsphinx
from pocketsphinx import Decoder

MODEL = os.path.join(os.path.dirname(pocketsphinx.__file__), 'model', 'en-us')
script = open('/home/user/work/scripts/script.txt').read()
disp_words = script.split()
norm = [re.sub(r"[^a-z']", "", w.lower()) for w in disp_words]

dict_path = '/home/user/work/test/align.dict'
base = {}
for l in open(os.path.join(MODEL, 'cmudict-en-us.dict')):
    p = l.split()
    base.setdefault(p[0], p[1:])
base['stretchy'] = 'S T R EH CH IY'.split()
with open(dict_path, 'w') as f:
    for w in sorted(set(norm)):
        f.write(w + ' ' + ' '.join(base[w]) + '\n')

dec = Decoder(hmm=os.path.join(MODEL, 'en-us'), dict=dict_path, lm=None, loglevel='ERROR')
w = wave.open('/home/user/work/input/vo16k.wav')
audio = w.readframes(w.getnframes())
dec.set_align_text(' '.join(norm))
dec.start_utt(); dec.process_raw(audio, full_utt=True); dec.end_utt()
dec.set_alignment(); dec.start_utt(); dec.process_raw(audio, full_utt=True); dec.end_utt()
al = dec.get_alignment()
out = []
for wseg in al:
    if wseg.name in ('<sil>', '<s>', '</s>'):
        continue
    out.append({'w': wseg.name, 'start': wseg.start / 100.0, 'end': (wseg.start + wseg.duration) / 100.0})
assert len(out) == len(norm), (len(out), len(norm))
for o, d in zip(out, disp_words):
    o['text'] = d
json.dump(out, open('/home/user/work/words.json', 'w'), indent=1)
for o in out:
    print(f"{o['start']:6.2f} {o['end']:6.2f} {o['text']}")

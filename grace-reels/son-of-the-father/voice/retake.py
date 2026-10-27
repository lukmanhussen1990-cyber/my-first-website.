#!/usr/bin/env python3
"""Re-take single TTS clips until faster-whisper hears an expected phrase (edge-tts gives a slightly different
take on every request; weak function words like "the" or "in" sometimes blur).
usage: python3 voice/retake.py B16_0 "the just for the unjust" [B09_1 "in aramaic" ...]
Keeps the first take that passes (max 10 tries per clip); then run voice/tts.py again to rebuild voice.wav."""
import json, os, re, subprocess, sys
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import tts
from faster_whisper import WhisperModel

model = WhisperModel("small.en", device="cpu", compute_type="int8")
texts = {}
for b in tts.S["beats"]:
    for ci, c in enumerate([c.strip() for c in b["tts"].split("|")]):
        texts[f"{b['id']}_{ci}"] = c


def heard(mp3):
    pcm = subprocess.run(["ffmpeg", "-v", "error", "-i", mp3, "-ac", "1", "-ar", "16000", "-f", "f32le", "-"], capture_output=True, check=True).stdout
    segs, _ = model.transcribe(np.frombuffer(pcm, dtype=np.float32), beam_size=5, temperature=0)
    return re.sub(r"[^a-z' ]", "", " ".join(s.text for s in segs).lower())


args = sys.argv[1:]
for key, want in zip(args[0::2], args[1::2]):
    mp3 = os.path.join(tts.CLIPS, key + ".mp3")
    for k in range(10):
        h = heard(mp3) if os.path.exists(mp3) else ""
        ok = want.lower() in re.sub(r"\s+", " ", h)
        print(f"{key} take {k}: {'OK ' if ok else 'no '} | {h.strip()}")
        if ok:
            break
        for f in (mp3, mp3 + ".json", os.path.join(tts.CLIPS, key + ".wav")):
            if os.path.exists(f):
                os.remove(f)
        tts.clip_audio(texts[key], key)

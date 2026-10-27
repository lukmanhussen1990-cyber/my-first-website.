#!/usr/bin/env python3
"""Offline test of the ElevenLabs path in tools/voices.py (no network, no credits).

Fakes the /with-timestamps endpoint with the current takes (audio + per-character
times built from their word timings, plus leading silence) and checks that:
  - the request is right (voice id in the URL, key header, text, model, settings)
  - the character alignment becomes the script's words with matching times
  - main() writes every file only when all lines were voiced, and a quota error
    leaves the existing files untouched and exits non-zero.

usage: python tools/test_voices.py
"""
import base64
import importlib.util
import io
import json
import os
import shutil
import subprocess
import sys
import tempfile
import urllib.error

import numpy as np
import soundfile as sf

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
spec = importlib.util.spec_from_file_location("voices", os.path.join(ROOT, "tools", "voices.py"))
V = importlib.util.module_from_spec(spec)
spec.loader.exec_module(V)
SCRIPT = json.load(open(os.path.join(ROOT, "script.json")))
LINES = {l["id"]: l for l in SCRIPT["lines"]}
LEAD_SIL = 0.3


def fake_payload(line_id):
    """what the API would return for this line: mp3 audio + character alignment"""
    wav = os.path.join(ROOT, "assets", "vo", f"{line_id}.wav")
    x, sr = sf.read(wav)
    x = np.concatenate([np.zeros(int(LEAD_SIL * sr)), x])
    with tempfile.TemporaryDirectory() as td:
        sf.write(os.path.join(td, "a.wav"), x, sr)
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", os.path.join(td, "a.wav"), "-b:a", "128k", os.path.join(td, "a.mp3")], check=True)
        mp3 = open(os.path.join(td, "a.mp3"), "rb").read()
    words = json.load(open(os.path.join(ROOT, "assets", "vo", f"{line_id}.words.json")))
    chars, cs, ce = [], [], []
    text = LINES[line_id]["text"].split()
    for k, (w, tw) in enumerate(zip(words, text)):
        if k:
            chars.append(" ")
            cs.append(LEAD_SIL + words[k - 1]["e"])
            ce.append(LEAD_SIL + w["s"])
        n = len(tw)
        for i, ch in enumerate(tw):
            chars.append(ch)
            cs.append(LEAD_SIL + w["s"] + (w["e"] - w["s"]) * i / n)
            ce.append(LEAD_SIL + w["s"] + (w["e"] - w["s"]) * (i + 1) / n)
    return {"audio_base64": base64.b64encode(mp3).decode(), "alignment": {"characters": chars, "character_start_times_seconds": cs, "character_end_times_seconds": ce}}


class Resp(io.BytesIO):
    def __enter__(self):
        return self

    def __exit__(self, *a):
        return False


REQUESTS = []


def fake_ok(req, timeout=None):
    REQUESTS.append(req)
    body = json.loads(req.data)
    line_id = next(l["id"] for l in SCRIPT["lines"] if l["text"] == body["text"])
    return Resp(json.dumps(fake_payload(line_id)).encode())


def fake_quota(req, timeout=None):
    REQUESTS.append(req)
    body = json.loads(req.data)
    if body["text"].startswith("Then you need walls"):  # the third line runs out of credits
        msg = b'{"detail":{"status":"quota_exceeded","message":"This request exceeds your quota of 10000. You have 0 credits remaining."}}'
        raise urllib.error.HTTPError(req.full_url, 401, "Unauthorized", {}, io.BytesIO(msg))
    return fake_ok(req, timeout)


def check(cond, what):
    print(("ok   " if cond else "FAIL ") + what)
    if not cond:
        global FAILED
        FAILED = True


FAILED = False
os.environ["ELEVENLABS_API_KEY"] = "test-key-123"
V.urllib.request.urlopen = fake_ok

# 1. one line through the ElevenLabs path
line = LINES["n3"]
audio, words, eng = V.voice_line("elevenlabs", line, SCRIPT["lines"], SCRIPT)
req = REQUESTS[-1]
body = json.loads(req.data)
cfg = SCRIPT["voices"]["narrator"]["elevenlabs"]
check(cfg["voice_id"] in req.full_url and "/with-timestamps" in req.full_url, "request URL has the voice id and /with-timestamps")
check(req.get_header("Xi-api-key") == "test-key-123", "API key sent in the xi-api-key header")
check(body["text"] == line["text"] and body["model_id"] == cfg["model_id"] and body["voice_settings"] == cfg["voice_settings"], "text, model and voice settings in the body")
check(body.get("previous_text") == LINES["n2"]["text"] and body.get("next_text") == LINES["n4"]["text"], "neighbouring lines passed for continuity")
check(eng == "elevenlabs" and [w["w"] for w in words] == line["text"].split(), "words spelled exactly as the script")
ref = json.load(open(os.path.join(ROOT, "assets", "vo", "n3.words.json")))
err = max(abs(a["s"] - b["s"]) for a, b in zip(words, ref))
ref_x, _ = sf.read(os.path.join(ROOT, "assets", "vo", "n3.wav"))
check(err < 0.08, f"word starts match the alignment after the silence trim (max error {err:.3f}s)")
check(abs(len(audio) / V.SR - len(ref_x) / V.SR) < 0.12, "leading silence trimmed")
check(all(a["e"] <= b["s"] + 1e-6 for a, b in zip(words, words[1:])), "word times in order")

# 2. main(): all files written in a scratch voice folder
tmp = tempfile.mkdtemp()
V.VO = tmp
sys.argv = ["voices.py", "--engine", "elevenlabs", "--only", "n3,n10"]
V.main()
check(all(os.path.exists(os.path.join(tmp, f)) for f in ["n3.wav", "n3.words.json", "n10.wav", "n10.words.json", "manifest.json"]), "main() wrote the lines and the manifest")
man = json.load(open(os.path.join(tmp, "manifest.json")))
check(man["lines"]["n10"]["engine"] == "elevenlabs" and "Dean" in man["lines"]["n10"]["voice"], "manifest records the ElevenLabs voice")

# 3. no credits half-way: nothing written, non-zero exit
tmp2 = tempfile.mkdtemp()
V.VO = tmp2
V.urllib.request.urlopen = fake_quota
sys.argv = ["voices.py", "--engine", "elevenlabs"]
try:
    V.main()
    check(False, "quota error exits non-zero")
except SystemExit as e:
    check(e.code not in (0, None), "quota error exits non-zero")
check(not [f for f in os.listdir(tmp2) if f.endswith(".wav")], "nothing written when a line fails (no mixed voices)")

# 4. no key at all
del os.environ["ELEVENLABS_API_KEY"]
V.ROOT = tmp  # no .env there
try:
    V.tts_elevenlabs(line, cfg, {})
    check(False, "missing key is reported")
except RuntimeError as e:
    check("ELEVENLABS_API_KEY" in str(e), "missing key is reported")
shutil.rmtree(tmp)
shutil.rmtree(tmp2)
print("FAILED" if FAILED else "all good")
sys.exit(1 if FAILED else 0)

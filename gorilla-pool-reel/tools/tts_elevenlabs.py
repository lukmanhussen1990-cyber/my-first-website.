#!/usr/bin/env python3
"""Generates the narrator lines with ElevenLabs (with exact word timestamps).

Key:   ELEVENLABS_API_KEY environment variable, or a .env file
       (gorilla-pool-reel/.env or the repository root .env) with ELEVENLABS_API_KEY=...
Voice: script/voiceover.json -> elevenlabs.voice_id (override: --voice ID or ELEVENLABS_VOICE_ID)

Writes voice/lineNN.wav and voice/timings_elevenlabs.json. The current voice files
are copied to voice/previous/ first, so nothing is lost if you want to go back.
Exits with an error (and leaves the existing voice untouched) if the API fails.
"""
import argparse
import base64
import json
import os
import shutil
import subprocess
import sys
import tempfile
import urllib.error
import urllib.request
from pathlib import Path

import numpy as np
import soundfile as sf

ROOT = Path(__file__).resolve().parent.parent
API = "https://api.elevenlabs.io/v1/text-to-speech/{voice}/with-timestamps?output_format=mp3_44100_128"


def load_key():
    key = os.environ.get("ELEVENLABS_API_KEY", "").strip()
    if key:
        return key
    for env in (ROOT / ".env", ROOT.parent / ".env"):
        if env.exists():
            for line in env.read_text().splitlines():
                line = line.strip()
                if line.startswith("ELEVENLABS_API_KEY") and "=" in line:
                    return line.split("=", 1)[1].strip().strip('"').strip("'")
    return ""


def tts(key, voice, cfg, text, prev_text, next_text):
    body = {"text": text, "model_id": cfg.get("model_id", "eleven_multilingual_v2"),
            "voice_settings": cfg.get("voice_settings", {})}
    if prev_text: body["previous_text"] = prev_text
    if next_text: body["next_text"] = next_text
    req = urllib.request.Request(API.format(voice=voice), data=json.dumps(body).encode(),
                                 headers={"xi-api-key": key, "Content-Type": "application/json", "Accept": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=120) as r:
            return json.loads(r.read())
    except urllib.error.HTTPError as e:
        raise SystemExit(f"ElevenLabs error {e.code}: {e.read().decode(errors='replace')[:500]}")
    except urllib.error.URLError as e:
        raise SystemExit(f"ElevenLabs request failed: {e}")


def words_from_alignment(text, al):
    """character timestamps -> one (start, end) per whitespace-separated script word"""
    chars = al["characters"]; st = al["character_start_times_seconds"]; en = al["character_end_times_seconds"]
    words, cur, s0, e0 = [], "", None, None
    for ch, a, b in zip(chars, st, en):
        if ch.isspace():
            if cur: words.append((cur, s0, e0)); cur = ""
            continue
        if not cur: s0 = a
        cur += ch; e0 = b
    if cur: words.append((cur, s0, e0))
    script_words = text.split()
    if len(words) != len(script_words):
        print(f"  note: {len(words)} timed words vs {len(script_words)} script words; matching by order")
    out = []
    for i, w in enumerate(script_words):
        _, a, b = words[min(i, len(words) - 1)]
        out.append({"text": w, "start": round(a, 3), "end": round(b, 3)})
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--voice", default=os.environ.get("ELEVENLABS_VOICE_ID"))
    ap.add_argument("--model", default=None)
    args = ap.parse_args()
    script = json.loads((ROOT / "script" / "voiceover.json").read_text())
    cfg = dict(script.get("elevenlabs", {}))
    if args.model: cfg["model_id"] = args.model
    voice = args.voice or cfg.get("voice_id")
    key = load_key()
    if not key:
        raise SystemExit("No ElevenLabs key: set ELEVENLABS_API_KEY or put it in gorilla-pool-reel/.env")
    if not voice:
        raise SystemExit("No voice id: set elevenlabs.voice_id in script/voiceover.json or pass --voice")

    lines = script["lines"]
    results = []
    for i, line in enumerate(lines):
        print(f"{line['id']}: {line['text']}")
        prev_t = lines[i - 1]["text"] if i else None
        next_t = lines[i + 1]["text"] if i + 1 < len(lines) else None
        results.append(tts(key, voice, cfg, line["text"], prev_t, next_t))

    # all lines succeeded -> back up the current voice, then write the new one
    vdir = ROOT / "voice"; bak = vdir / "previous"
    bak.mkdir(exist_ok=True)
    for f in vdir.glob("line*.wav"): shutil.copy2(f, bak / f.name)
    for f in ("timings.json", "SOURCE.txt", "timings_elevenlabs.json"):
        if (vdir / f).exists(): shutil.copy2(vdir / f, bak / f)

    timings = {}
    for line, res in zip(lines, results):
        with tempfile.TemporaryDirectory() as d:
            mp3 = Path(d) / "a.mp3"; wav = Path(d) / "a.wav"
            mp3.write_bytes(base64.b64decode(res["audio_base64"]))
            subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(mp3), "-ac", "1", "-ar", "44100", str(wav)], check=True)
            x, sr = sf.read(str(wav), dtype="float32")
        words = words_from_alignment(line["text"], res.get("alignment") or res["normalized_alignment"])
        # trim leading/trailing silence and shift the timestamps to match
        thr = 0.01 * np.max(np.abs(x))
        idx = np.where(np.abs(x) > thr)[0]
        a = max(0, idx[0] - int(0.04 * sr)); b = min(len(x), idx[-1] + int(0.08 * sr))
        x = x[a:b]; off = a / sr
        for w in words:
            w["start"] = round(max(0.0, w["start"] - off), 3); w["end"] = round(max(0.0, w["end"] - off), 3)
        sf.write(vdir / f"{line['id']}.wav", x, sr, subtype="PCM_16")
        timings[line["id"]] = {"duration": len(x) / sr, "words": words}
        print(f"  {line['id']}.wav {len(x) / sr:.2f}s")
    (vdir / "timings_elevenlabs.json").write_text(json.dumps(timings, indent=1))
    (vdir / "SOURCE.txt").write_text(f"ElevenLabs voice {voice} model {cfg.get('model_id')}\n")
    print("ElevenLabs voice written to voice/ (old voice backed up in voice/previous/)")


if __name__ == "__main__":
    main()

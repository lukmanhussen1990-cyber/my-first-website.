#!/usr/bin/env python3
"""ElevenLabs voiceover for the tank office reel -- ONE API call per line, ever.

    python3 tools/voiceover.py --count      # character count + voices, no API calls
    python3 tools/voiceover.py --generate   # generate only the lines that do not exist yet

* ELEVENLABS_API_KEY from the environment, model eleven_flash_v2_5 (cheapest).
* /v1/text-to-speech/{voice}/with-timestamps so captions sync without extra calls.
* Each line is saved as its own file: audio/lines/<ID>.mp3 + <ID>.json (raw response,
  written to disk before anything is parsed). If a line's file exists it is reused;
  nothing is ever regenerated and no extra takes are made. Never retries on error.
"""
import argparse
import base64
import json
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
LINES_DIR = ROOT / "audio" / "lines"
MODEL = "eleven_flash_v2_5"
API = "https://api.elevenlabs.io/v1/text-to-speech/{voice}/with-timestamps"

# premade voices only (nothing designed or cloned)
VOICES = {
    "NARRATOR": {"name": "Brian - Deep, Resonant and Comforting (premade)", "voice_id": "nPczCjzI2devNBz1zQrb",
                 "settings": {"stability": 0.7, "similarity_boost": 0.75, "style": 0.0, "use_speaker_boost": True, "speed": 0.95}},
    "BOSS": {"name": "Bill - Wise, Mature, Balanced (premade, old)", "voice_id": "pqHfZKP75CvOlQylNhV4",
             "settings": {"stability": 0.35, "similarity_boost": 0.8, "style": 0.0, "use_speaker_boost": True, "speed": 1.0}},
    "YOU": {"name": "Liam - Energetic, Social Media Creator (premade, young)", "voice_id": "TX3LPaxmHKxFdv7VOQHJ",
            "settings": {"stability": 0.55, "similarity_boost": 0.8, "style": 0.0, "use_speaker_boost": True, "speed": 0.95}},
}

LINES = [
    ("L01", "NARRATOR", "It's your first day at your new job."),
    ("L02", "NARRATOR", "New shirt. New shoes. New you."),
    ("L03", "NARRATOR", "Last night, you ate extra spicy biryani."),
    ("L04", "NARRATOR", "Your boss walks in."),
    ("L05", "BOSS", "Welcome to the team!"),
    ("L06", "NARRATOR", "He hugs you. Tight."),
    ("L07", "NARRATOR", "Too tight."),
    ("L08", "NARRATOR", "Then, it happens."),
    ("L09", "NARRATOR", "Silence."),
    ("L10", "NARRATOR", "He stops. He sniffs. Once. Twice."),
    ("L11", "NARRATOR", "The whole office stops typing."),
    ("L12", "NARRATOR", "The printer stops printing."),
    ("L13", "NARRATOR", "The office plant dies."),
    ("L14", "BOSS", "YOU'RE FIRED!"),
    ("L15", "NARRATOR", "Security walks you out."),
    ("L16", "NARRATOR", "Your box of things. Your dignity. Gone."),
    ("L17", "NARRATOR", "You go home. You change your pants."),
    ("L18", "NARRATOR", "Then you make one phone call."),
    ("L19", "YOU", "Bro… I need the tank."),
    ("L20", "NARRATOR", "Nobody knows where you got a tank."),
    ("L21", "NARRATOR", "Thirty minutes later."),
    ("L22", "NARRATOR", "Everyone runs outside."),
    ("L23", "NARRATOR", "The boss comes out last. With his coffee."),
    ("L24", "YOU", "Welcome to the team."),
    ("L25", "NARRATOR", "BOOM."),
    ("L26", "NARRATOR", "Nobody got hurt."),
    ("L27", "NARRATOR", "But your boss… never hugged anyone again."),
]


def count():
    per = {}
    for _, spk, text in LINES:
        per[spk] = per.get(spk, 0) + len(text)
    for spk, v in VOICES.items():
        n = sum(1 for _, s, _ in LINES if s == spk)
        print(f"{spk:9s} {per.get(spk, 0):4d} chars in {n:2d} lines | {v['name']} [{v['voice_id']}]")
    total = sum(per.values())
    print(f"TOTAL     {total:4d} characters, {len(LINES)} lines = {len(LINES)} API calls, model {MODEL}")
    return total


def generate():
    import requests
    key = os.environ.get("ELEVENLABS_API_KEY")
    if not key:
        sys.exit("ELEVENLABS_API_KEY is not set -- nothing generated.")
    LINES_DIR.mkdir(parents=True, exist_ok=True)
    for lid, spk, text in LINES:
        mp3, raw = LINES_DIR / f"{lid}.mp3", LINES_DIR / f"{lid}.json"
        if mp3.exists() or raw.exists():
            print(f"[skip] {lid} exists -- reusing"); continue
        v = VOICES[spk]
        r = requests.post(API.format(voice=v["voice_id"]), params={"output_format": "mp3_44100_128"},
                          headers={"xi-api-key": key, "Content-Type": "application/json"},
                          json={"text": text, "model_id": MODEL, "voice_settings": v["settings"]}, timeout=120)
        if r.status_code != 200:
            sys.exit(f"[error] {lid}: HTTP {r.status_code}: {r.text[:300]} (stopping, no retry)")
        raw.write_bytes(r.content)
        data = r.json()
        mp3.write_bytes(base64.b64decode(data["audio_base64"]))
        print(f"[ok]   {lid} {spk}: {text}")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--generate", action="store_true")
    a = ap.parse_args()
    count()
    if a.generate:
        generate()

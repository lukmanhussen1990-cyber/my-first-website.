#!/usr/bin/env python3
"""ElevenLabs voiceover for the exam reel -- exactly TWO API calls, ever.

    python3 tools/voiceover.py --count      # print character counts, no API calls
    python3 tools/voiceover.py --generate   # 1 call for the narrator, 1 for the crush

* Uses ELEVENLABS_API_KEY from the environment.
* Model: eleven_flash_v2_5 (cheapest).
* Endpoint: /v1/text-to-speech/{voice}/with-timestamps, so captions can be synced
  from the returned character alignment without any extra calls.
* The raw JSON response is written to disk *before* anything else is parsed, so
  a paid result can never be lost.
* If the audio for a voice already exists, that voice is skipped. Nothing is
  ever regenerated; re-rendering the video reuses these files.
"""
import argparse
import base64
import json
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
AUDIO = ROOT / "audio"
MODEL = "eleven_flash_v2_5"
API = "https://api.elevenlabs.io/v1/text-to-speech/{voice}/with-timestamps"

# Premade voices (picked from the account's premade voice list; nothing designed or cloned)
VOICES = {
    "narrator": {
        "voice_id": "nPczCjzI2devNBz1zQrb",  # Brian - Deep, Resonant and Comforting (premade)
        "settings": {"stability": 0.7, "similarity_boost": 0.75, "style": 0.0,
                     "use_speaker_boost": True, "speed": 0.95},
    },
    "crush": {
        "voice_id": "cgSgspJ2msm6clMCkdW9",  # Jessica - Playful, Bright, Warm; tagged "cute" (premade)
        "settings": {"stability": 0.5, "similarity_boost": 0.8, "style": 0.0,
                     "use_speaker_boost": True, "speed": 0.92},
    },
}

NARRATOR_LINES = [
    "You just pooped in your final exam.",
    "But you thought it was a fart.",
    "Three hours left.",
    "No toilet breaks.",
    "You sit very still.",
    "Like nothing happened.",
    "Then, the smell starts rising.",
    "Your crush sits right behind you.",
    "She stops writing.",
    "She sniffs.",
    "Once.",
    "Twice.",
    "She looks at you.",
    "You look at the fan.",
    "The whole hall goes quiet.",
    "Then she raises her hand.",
    # <- the crush line is spliced in here at mix time
    "Thirty students turn around.",
    "Slowly.",
    "Good luck with your exam.",
]
CRUSH_LINES = ["Sir, someone needs help."]

TEXTS = {
    "narrator": " ".join(NARRATOR_LINES),
    "crush": " ".join(CRUSH_LINES),
}


def out_paths(name):
    return AUDIO / f"{name}.mp3", AUDIO / f"{name}_response.json"


def count():
    total = 0
    for name, text in TEXTS.items():
        print(f"{name:9s} {len(text):4d} chars | {text}")
        total += len(text)
    print(f"TOTAL     {total:4d} characters  (model {MODEL}, 2 API calls)")
    return total


def generate():
    import requests  # honours HTTPS_PROXY / REQUESTS_CA_BUNDLE

    key = os.environ.get("ELEVENLABS_API_KEY")
    if not key:
        sys.exit("ELEVENLABS_API_KEY is not set -- nothing generated.")
    AUDIO.mkdir(parents=True, exist_ok=True)
    for name, text in TEXTS.items():
        mp3, raw = out_paths(name)
        if mp3.exists() or raw.exists():
            print(f"[skip] {name}: already generated ({mp3.name}) -- reusing, no API call.")
            continue
        v = VOICES[name]
        print(f"[call] {name}: {len(text)} chars, voice {v['voice_id']}, model {MODEL}")
        r = requests.post(
            API.format(voice=v["voice_id"]),
            params={"output_format": "mp3_44100_128"},
            headers={"xi-api-key": key, "Content-Type": "application/json"},
            json={"text": text, "model_id": MODEL, "voice_settings": v["settings"]},
            timeout=180,
        )
        if r.status_code != 200:
            # Do NOT retry automatically: a retry could be billed again.
            sys.exit(f"[error] {name}: HTTP {r.status_code}: {r.text[:500]}")
        raw.write_bytes(r.content)  # persist the paid result first
        data = r.json()
        mp3.write_bytes(base64.b64decode(data["audio_base64"]))
        align = data.get("alignment") or data.get("normalized_alignment")
        (AUDIO / f"{name}_alignment.json").write_text(json.dumps(
            {"text": text, "voice_id": v["voice_id"], "model_id": MODEL, "alignment": align,
             "normalized_alignment": data.get("normalized_alignment")}, indent=1))
        print(f"[ok]   {name}: saved {mp3.name} + alignment")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--count", action="store_true")
    ap.add_argument("--generate", action="store_true")
    a = ap.parse_args()
    if a.generate:
        count()
        generate()
    else:
        count()

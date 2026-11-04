#!/usr/bin/env python3
"""voice.py — Hindi voiceover via the ElevenLabs API: one MP3 per line of script.txt.

  python3 voice.py                 make audio/voice/sceneNN.mp3 for every line that has none yet
  python3 voice.py 3 5             (re)generate only scenes 3 and 5
  python3 voice.py --force         regenerate every line
  python3 voice.py --find-voices   search the ElevenLabs voice library for calm male Hindi narrators

Needs ELEVENLABS_API_KEY in .env (or the environment). Voice, model and settings come from
scenes.json → "voice" (speed 0.95, stability 0.6, style 0.2, eleven_multilingual_v2).
A <break time="…"/> is inserted after every sentence that is not the last one, so lines like
"एक नियम। सौ दिन। प्यार मत करना।" are read with calm pauses. The subtitles always show the
plain line from script.txt, so they match the spoken words exactly.
"""
import json
import os
import re
import sys
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent
API = "https://api.elevenlabs.io/v1"
LANG_CODE_MODELS = ("eleven_flash_v2_5", "eleven_turbo_v2_5")   # models that accept language_code


def load_env():
    env = ROOT / ".env"
    if env.exists():
        for line in env.read_text(encoding="utf-8").splitlines():
            m = re.match(r"\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$", line)
            if m and not line.lstrip().startswith("#"):
                os.environ.setdefault(m.group(1), m.group(2).strip("'\""))
    key = os.environ.get("ELEVENLABS_API_KEY")
    if not key:
        sys.exit("ELEVENLABS_API_KEY missing: put it in .env (see .env.example)")
    return key


def tts_text(line, pause):
    sentences = [s for s in re.split(r"(?<=[।?!.])\s+", line.strip()) if s]
    return f' <break time="{pause}s" /> '.join(sentences) if pause else line


def request(url, key, body=None):
    req = urllib.request.Request(url, data=json.dumps(body).encode() if body else None,
                                 headers={"xi-api-key": key, "Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=180) as r:
            return r.read()
    except urllib.error.HTTPError as e:
        detail = e.read().decode(errors="replace")[:400]
        hint = ""
        if "voice_not_found" in detail or e.code == 404:
            hint = "\n  hint: add the voice to 'My Voices' in the ElevenLabs Voice Library, or change scenes.json voice_id"
        sys.exit(f"ElevenLabs API error {e.code}: {detail}{hint}")


def synth(text, cfg, key):
    body = {
        "text": text,
        "model_id": cfg.get("model_id", "eleven_multilingual_v2"),
        "voice_settings": {
            "stability": cfg.get("stability", 0.6),
            "similarity_boost": cfg.get("similarity_boost", 0.8),
            "style": cfg.get("style", 0.2),
            "use_speaker_boost": True,
            "speed": cfg.get("speed", 0.95),
        },
    }
    if body["model_id"] in LANG_CODE_MODELS and cfg.get("language_code"):
        body["language_code"] = cfg["language_code"]
    return request(f"{API}/text-to-speech/{cfg['voice_id']}?output_format=mp3_44100_128", key, body)


def find_voices(key):
    q = urllib.parse.urlencode({"search": "Hindi", "language": "hi", "gender": "male",
                                "use_cases": "narrative_story", "page_size": 30})
    data = json.loads(request(f"{API}/shared-voices?{q}", key))
    for v in data.get("voices", []):
        print(f"{v.get('voice_id')}  {v.get('name')}  — {(v.get('description') or '')[:90]}")


def main():
    args = sys.argv[1:]
    key = load_env()
    if "--find-voices" in args:
        return find_voices(key)
    plan = json.loads((ROOT / "scenes.json").read_text(encoding="utf-8"))
    cfg = plan["voice"]
    lines = [l.strip() for l in (ROOT / "script.txt").read_text(encoding="utf-8").splitlines()
             if l.strip() and not l.strip().startswith("#")]
    only = {int(a) for a in args if a.isdigit()}
    force = "--force" in args
    out_dir = ROOT / "audio" / "voice"
    out_dir.mkdir(parents=True, exist_ok=True)
    for i, line in enumerate(lines, 1):
        out = out_dir / f"scene{i:02d}.mp3"
        if out.exists() and not force and i not in only:
            continue
        if only and i not in only:
            continue
        text = tts_text(line, cfg.get("pause_between_sentences", 0.5))
        print(f"scene {i:02d}: {text}")
        out.write_bytes(synth(text, cfg, key))
        print(f"  → {out.relative_to(ROOT)}")


if __name__ == "__main__":
    main()

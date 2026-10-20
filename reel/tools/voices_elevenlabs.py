#!/usr/bin/env python3
"""Make every voice line with ElevenLabs (two voices: narrator and John).

Reads script.json, calls the ElevenLabs text-to-speech "with timestamps" API
for each line and writes:
  voices/<id>.wav              the line (48 kHz mono)
  voices/<id>.alignment.json   character timings, used for the subtitles
  voices/manifest.json         which engine/voice made each file

The API key comes from ELEVENLABS_API_KEY or a .env file (in this folder or the
repository root). Nothing is replaced unless every line succeeds, so a failed
run (no key, no credits, network) leaves the current voices untouched.

Usage:
  python3 tools/voices_elevenlabs.py                  # eleven_multilingual_v2, plain text
  python3 tools/voices_elevenlabs.py --model eleven_v3  # v3 with the [audio tags] in script.json
Voice overrides: ELEVEN_NARRATOR_VOICE=<voice_id>  ELEVEN_JOHN_VOICE=<voice_id>
"""
import argparse
import base64
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
API = "https://api.elevenlabs.io/v1"


def api_key():
    key = os.environ.get("ELEVENLABS_API_KEY", "").strip()
    if key:
        return key
    for env in (os.path.join(ROOT, ".env"), os.path.join(os.path.dirname(ROOT), ".env")):
        if os.path.exists(env):
            for raw in open(env, encoding="utf-8"):
                m = re.match(r"\s*(?:export\s+)?ELEVENLABS_API_KEY\s*=\s*(.*)\s*$", raw)
                if m:
                    return m.group(1).strip().strip("'\"")
    return ""


def tts(key, voice_id, text, model, settings):
    body = {"text": text, "model_id": model, "voice_settings": settings}
    req = urllib.request.Request(
        f"{API}/text-to-speech/{voice_id}/with-timestamps?output_format=mp3_44100_128",
        data=json.dumps(body).encode(), method="POST",
        headers={"xi-api-key": key, "Content-Type": "application/json", "Accept": "application/json"})
    for attempt in range(5):
        try:
            with urllib.request.urlopen(req, timeout=120) as r:
                return json.load(r)
        except urllib.error.HTTPError as e:
            msg = e.read().decode("utf-8", "replace")
            if e.code == 429 and attempt < 4:          # busy: wait and try again
                time.sleep(2 ** attempt * 2)
                continue
            raise RuntimeError(f"HTTP {e.code}: {msg[:400]}") from None
        except urllib.error.URLError as e:
            if attempt < 4:
                time.sleep(2 ** attempt * 2)
                continue
            raise RuntimeError(f"network error: {e}") from None
    raise RuntimeError("gave up after retries")


def strip_tags(alignment):
    """Drop the characters of [audio tags] (and the space after them) from the alignment."""
    chars = alignment["characters"]
    keep, depth, skip_space = [], 0, False
    for k, ch in enumerate(chars):
        if ch == "[":
            depth += 1
            continue
        if ch == "]":
            depth = max(0, depth - 1)
            skip_space = True
            continue
        if depth:
            continue
        if skip_space and ch == " ":
            skip_space = False
            continue
        skip_space = False
        keep.append(k)
    return {key: [alignment[key][k] for k in keep] for key in
            ("characters", "character_start_times_seconds", "character_end_times_seconds")}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--model", default="eleven_multilingual_v2",
                    help="eleven_multilingual_v2 (default) or eleven_v3 (uses the [audio tags])")
    args = ap.parse_args()
    key = api_key()
    if not key:
        sys.exit("No ElevenLabs API key: set ELEVENLABS_API_KEY or put it in a .env file.")
    script = json.load(open(os.path.join(ROOT, "script.json"), encoding="utf-8"))
    voices = script["voices"]
    override = {"narrator": os.environ.get("ELEVEN_NARRATOR_VOICE"), "john": os.environ.get("ELEVEN_JOHN_VOICE")}
    tmp = tempfile.mkdtemp()
    manifest = {"engine": f"elevenlabs {args.model}", "lines": {}}
    try:
        for line in script["lines"]:
            v = voices[line["speaker"]]
            text = line.get("eleven_v3_text", line["text"]) if args.model == "eleven_v3" else line["text"]
            tried = [override[line["speaker"]] or v["elevenlabs_voice_id"]]
            if v.get("elevenlabs_fallback_voice_id"):
                tried.append(v["elevenlabs_fallback_voice_id"])
            res, used, err = None, None, None
            for vid in tried:
                try:
                    res, used = tts(key, vid, text, args.model, v["elevenlabs_settings"]), vid
                    break
                except RuntimeError as e:
                    err = e
                    if "voice" in str(e).lower() and ("not found" in str(e).lower() or "not_found" in str(e).lower()):
                        print(f"  {line['id']}: voice {vid} is not in this account, trying the fallback voice")
                        continue
                    raise
            if res is None:
                raise RuntimeError(f"{line['id']}: {err}")
            mp3 = os.path.join(tmp, f"{line['id']}.mp3")
            with open(mp3, "wb") as f:
                f.write(base64.b64decode(res["audio_base64"]))
            wav = os.path.join(tmp, f"{line['id']}.wav")
            subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", mp3, "-ar", "48000", "-ac", "1", wav], check=True)
            align = res.get("alignment") or res.get("normalized_alignment")
            if args.model == "eleven_v3":
                align = strip_tags(align)
            with open(os.path.join(tmp, f"{line['id']}.alignment.json"), "w") as f:
                json.dump(align, f)
            dur = float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", wav],
                                       capture_output=True, text=True, check=True).stdout)
            manifest["lines"][line["id"]] = {"file": f"voices/{line['id']}.wav", "speaker": line["speaker"],
                                             "voice": used, "model": args.model, "duration": round(dur, 3)}
            print(f"  {line['id']}: {dur:.2f} s  ({line['speaker']}, voice {used})")
    except RuntimeError as e:
        shutil.rmtree(tmp, ignore_errors=True)
        sys.exit(f"ElevenLabs failed, voices left unchanged: {e}")
    # all lines made: swap them in
    vdir = os.path.join(ROOT, "voices")
    for line in script["lines"]:
        lid = line["id"]
        shutil.move(os.path.join(tmp, f"{lid}.wav"), os.path.join(vdir, f"{lid}.wav"))
        shutil.move(os.path.join(tmp, f"{lid}.alignment.json"), os.path.join(vdir, f"{lid}.alignment.json"))
        stale = os.path.join(vdir, f"{lid}.timing.json")   # local-TTS timings no longer match
        if os.path.exists(stale):
            os.remove(stale)
    with open(os.path.join(vdir, "manifest.json"), "w") as f:
        json.dump(manifest, f, indent=2)
    shutil.rmtree(tmp, ignore_errors=True)
    print("voices updated from ElevenLabs")


if __name__ == "__main__":
    main()

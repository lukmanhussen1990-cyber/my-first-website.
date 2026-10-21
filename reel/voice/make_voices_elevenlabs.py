"""Generate the voiceover with ElevenLabs (narrator + grandpa) including word timestamps.

Reads the API key from $ELEVENLABS_API_KEY, or from reel/.env / repo-root .env (ELEVENLABS_API_KEY=...).
Voice ids, model and voice settings come from script.json ("speakers" -> "elevenlabs").
Writes voices/elevenlabs/<id>.wav (48 kHz mono, trimmed, loudness-normalized) and
voices/elevenlabs/<id>.words.json (word start/end in seconds, built from ElevenLabs' character alignment).

Exits non-zero on any failure (no key, 401, quota, network) so the caller can stop cleanly.

    python voice/make_voices_elevenlabs.py [--only g1,n3]
"""
import argparse
import base64
import json
import os
import sys
import urllib.error
import urllib.request
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))
import common as C  # noqa: E402

API = "https://api.elevenlabs.io/v1/text-to-speech/{voice}/with-timestamps?output_format=pcm_44100"


def api_key():
    k = os.environ.get("ELEVENLABS_API_KEY", "").strip()
    if k:
        return k
    for env in (C.REEL / ".env", C.REEL.parent / ".env"):
        if env.exists():
            for line in env.read_text().splitlines():
                if line.strip().startswith("ELEVENLABS_API_KEY"):
                    return line.split("=", 1)[1].strip().strip('"').strip("'")
    return ""


def tts(key, text, cfg):
    body = {"text": text, "model_id": cfg.get("model_id", "eleven_multilingual_v2"), "voice_settings": cfg.get("voice_settings", {})}
    req = urllib.request.Request(API.format(voice=cfg["voice_id"]), data=json.dumps(body).encode(),
                                 headers={"xi-api-key": key, "Content-Type": "application/json", "Accept": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=120) as r:
            data = json.loads(r.read())
    except urllib.error.HTTPError as e:
        msg = e.read().decode(errors="replace")[:500]
        raise SystemExit(f"ElevenLabs HTTP {e.code}: {msg}")
    except urllib.error.URLError as e:
        raise SystemExit(f"ElevenLabs request failed: {e}")
    pcm = np.frombuffer(base64.b64decode(data["audio_base64"]), dtype="<i2").astype(np.float64) / 32768.0
    al = data.get("alignment") or data.get("normalized_alignment")
    return C.resample(pcm, 44100, C.SR), al


def words_from_alignment(text, al, offset, dur):
    """Group character timings into the script's whitespace tokens (punctuation kept as written)."""
    chars, st, en = al["characters"], al["character_start_times_seconds"], al["character_end_times_seconds"]
    toks = C.script_words(text)
    # walk the original text, mapping each char index to the alignment index (alignment echoes the input text)
    joined = "".join(chars)
    if joined != text:
        print(f"    note: alignment text differs slightly from script ({joined!r}); mapping by order")
    out, ai = [], 0
    for tok in toks:
        # skip whitespace in the alignment stream
        while ai < len(chars) and chars[ai].isspace():
            ai += 1
        s_i = ai; ai = min(len(chars), ai + len(tok)); e_i = max(s_i, ai - 1)
        s = st[min(s_i, len(st) - 1)] - offset
        e = en[min(e_i, len(en) - 1)] - offset
        out.append({"word": tok, "start": round(max(0.0, s), 3), "end": round(min(dur, max(e, s + 0.05)), 3)})
    for i in range(1, len(out)):  # monotonic
        out[i]["start"] = max(out[i]["start"], out[i - 1]["start"])
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--only", default="")
    a = ap.parse_args()
    key = api_key()
    if not key:
        raise SystemExit("No ElevenLabs API key: set ELEVENLABS_API_KEY or put ELEVENLABS_API_KEY=... in reel/.env")
    sc = C.load_script(); only = set(filter(None, a.only.split(",")))
    outdir = C.VOICES_DIR / "elevenlabs"; outdir.mkdir(parents=True, exist_ok=True)
    for line in sc["lines"]:
        if only and line["id"] not in only:
            continue
        cfg = sc["speakers"][line["speaker"]]["elevenlabs"]
        print(f"  {line['id']}: {cfg.get('voice_name', cfg['voice_id'])} ...")
        x, al = tts(key, line["text"], cfg)
        y, off = C.finish_line(x)
        dur = len(y) / C.SR
        words = words_from_alignment(line["text"], al, off, dur)
        probs = C.validate_words(words, line["text"], dur)
        if probs:
            print(f"    warning: {probs}")
        C.write_wav(C.wav_path("elevenlabs", line["id"]), y)
        C.words_path("elevenlabs", line["id"]).write_text(json.dumps(words, indent=1))
        print(f"    -> {dur:.2f}s, {len(words)} words")
    print("ElevenLabs voices done.")


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""Generate one audio file per voiceover line, plus word timestamps.

Engines:
  elevenlabs  ElevenLabs text-to-speech "with-timestamps" endpoint (needs
              ELEVENLABS_API_KEY in the environment or in a .env file).
  local       Piper neural TTS, run locally. Word timings come from Piper's
              phoneme alignments, so they match the audio exactly.
  auto        Try ElevenLabs; if anything fails (no key, an error, no
              credits), fall back to local for ALL lines so the voices
              stay consistent.

Output (in voices/):
  lineNN_<speaker>.wav         48 kHz mono 16-bit
  lineNN_<speaker>.words.json  {"engine", "duration", "words": [{text,start,end}]}
  manifest.json                which engine/voice made each file

New files are written to a temp folder first and only replace the old
ones once every line has succeeded.
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
import urllib.error
import urllib.request
import wave
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parent.parent
SCRIPT = ROOT / "script" / "voiceover.json"
VOICES = ROOT / "voices"
PIPER_DIRS = [ROOT / ".cache" / "piper", ROOT.parent / ".cache" / "piper"]
SR = 48000


# ---------------------------------------------------------------- helpers

def load_env():
    for p in (ROOT / ".env", ROOT.parent / ".env", Path.cwd() / ".env"):
        if p.is_file():
            for line in p.read_text().splitlines():
                m = re.match(r"\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$", line)
                if m and m.group(1) not in os.environ:
                    os.environ[m.group(1)] = m.group(2).strip().strip("'\"")


def script_words(text):
    """Display tokens exactly as written in the script."""
    return text.split()


def core(word):
    """Letters/digits/apostrophes only, lowercased: used for matching."""
    return re.sub(r"[^a-z0-9']", "", word.lower().replace("’", "'"))


def resample(x, sr_in, sr_out=SR):
    if sr_in == sr_out:
        return x.astype(np.float32)
    from scipy.signal import resample_poly
    from math import gcd
    g = gcd(sr_in, sr_out)
    return resample_poly(x, sr_out // g, sr_in // g).astype(np.float32)


def write_wav(path, x, sr=SR):
    x = np.clip(x, -1, 1)
    with wave.open(str(path), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(sr)
        w.writeframes((x * 32767).astype("<i2").tobytes())


def decode_with_ffmpeg(data: bytes):
    p = subprocess.run(
        ["ffmpeg", "-v", "error", "-i", "pipe:0", "-f", "f32le", "-ac", "1", "-ar", str(SR), "pipe:1"],
        input=data, capture_output=True, check=True)
    return np.frombuffer(p.stdout, dtype=np.float32).copy()


def trim(x, words, pad=0.05, thresh_db=-45):
    """Trim leading/trailing silence and shift word timings to match."""
    env = np.abs(x)
    th = 10 ** (thresh_db / 20) * max(env.max(), 1e-6)
    idx = np.where(env > th)[0]
    if len(idx) == 0:
        return x, words
    a = max(0, idx[0] - int(pad * SR))
    b = min(len(x), idx[-1] + int(pad * SR))
    off = a / SR
    words = [dict(w, start=max(0.0, w["start"] - off), end=max(0.0, w["end"] - off)) for w in words]
    return x[a:b], words


def normalize(x, peak_db=-1.5):
    peak = np.abs(x).max()
    return x * (10 ** (peak_db / 20) / peak) if peak > 0 else x


# ------------------------------------------------------------- ElevenLabs

class ElevenLabsError(RuntimeError):
    pass


def strip_tags(text):
    return re.sub(r"\[[^\]]*\]\s*", "", text).strip()


def eleven_request(voice_id, text, model, settings, fmt, key):
    url = f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}/with-timestamps?output_format={fmt}"
    body = {"text": text, "model_id": model}
    if settings is not None:
        body["voice_settings"] = settings
    req = urllib.request.Request(url, data=json.dumps(body).encode(), method="POST",
                                 headers={"xi-api-key": key, "Content-Type": "application/json",
                                          "Accept": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=120) as r:
            return json.loads(r.read())
    except urllib.error.HTTPError as e:
        detail = e.read().decode(errors="replace")[:500]
        raise ElevenLabsError(f"HTTP {e.code}: {detail}") from None
    except urllib.error.URLError as e:
        raise ElevenLabsError(f"network error: {e}") from None


def eleven_words(resp, words):
    al = resp.get("alignment") or resp.get("normalized_alignment")
    if not al:
        return None
    chars = al["characters"]
    st = al["character_start_times_seconds"]
    en = al["character_end_times_seconds"]
    s = "".join(chars).lower().replace("’", "'")
    # blank out [audio tags] so words inside them are never matched
    s = re.sub(r"\[[^\]]*\]", lambda m: " " * len(m.group(0)), s)
    out, pos = [], 0
    for w in words:
        c = re.sub(r"^[^a-z0-9']+|[^a-z0-9']+$", "", w.lower().replace("’", "'"))
        i = s.find(c, pos) if c else -1
        if i < 0:
            return None
        j = i + len(c) - 1
        out.append({"text": w, "start": float(st[i]), "end": float(en[j])})
        pos = j + 1
    return out


def make_eleven(cfg, line, key):
    v = cfg["voices"][line["speaker"]]
    fmt = cfg["elevenlabs"].get("output_format", "mp3_44100_128")
    words = script_words(line["text"])
    errors = []
    for model in cfg["elevenlabs"]["models"]:
        tagged = model in ("eleven_v3", "eleven_v4")
        text = line.get("eleven_prompt", line["text"]) if tagged else strip_tags(line.get("eleven_prompt", line["text"]))
        s = dict(v.get("elevenlabs_settings", {}))
        if tagged:  # v3 only takes the stability presets 0.0 / 0.5 / 1.0
            s = {"stability": min((0.0, 0.5, 1.0), key=lambda p: abs(p - s.get("stability", 0.5))),
                 "similarity_boost": s.get("similarity_boost", 0.75)}
        for settings in (s, None):
            try:
                resp = eleven_request(v["elevenlabs_voice_id"], text, model, settings, fmt, key)
            except ElevenLabsError as e:
                errors.append(f"{model}: {e}")
                msg = str(e)
                if any(k in msg for k in ("quota", "credits", "401", "invalid_api_key", "payment", "402")):
                    raise ElevenLabsError("; ".join(errors))
                continue
            audio = decode_with_ffmpeg(base64.b64decode(resp["audio_base64"]))
            wt = eleven_words(resp, words)
            if wt is None:
                print(f"  ! {line['id']}: no usable alignment, estimating word timings from audio")
                wt = estimate_words(audio, words)
            return audio, wt, {"engine": "elevenlabs", "model": model, "voice_id": v["elevenlabs_voice_id"],
                               "voice_name": v.get("elevenlabs_voice_name", "")}
    raise ElevenLabsError("; ".join(errors))


# ------------------------------------------------------------------ Piper

_piper_cache = {}


def piper_voice(name):
    if name in _piper_cache:
        return _piper_cache[name]
    from piper import PiperVoice
    for d in PIPER_DIRS:
        p = d / f"{name}.onnx"
        if p.is_file():
            break
    else:
        d = PIPER_DIRS[0]
        d.mkdir(parents=True, exist_ok=True)
        print(f"  downloading Piper voice {name} ...")
        subprocess.run([sys.executable, "-m", "piper.download_voices", "--download-dir", str(d), name], check=True)
        p = d / f"{name}.onnx"
    voice = PiperVoice.load(str(p), include_alignments=True)
    _piper_cache[name] = voice
    return voice


PUNCT = set(",.;:!?…-—\"'()[]^$_ ")


def make_local(cfg, line):
    from piper.config import SynthesisConfig
    v = cfg["voices"][line["speaker"]]
    voice = piper_voice(v["local_piper_model"])
    sr = voice.config.sample_rate
    syn = SynthesisConfig(length_scale=v.get("local_length_scale", 1.0), noise_scale=0.6, noise_w_scale=0.75)
    words = script_words(line["text"])
    gap = int(v.get("local_sentence_gap", 0.2) * sr)

    pieces, groups, pos = [], [], 0
    for chunk in voice.synthesize(line["text"], syn_config=syn, include_alignments=True):
        a = chunk.audio_float_array
        if chunk.phoneme_alignments:
            cur, t = None, pos
            for al in chunk.phoneme_alignments:
                ph = al.phoneme
                if ph == " ":
                    if cur:
                        groups.append(cur)
                    cur = None
                elif ph not in PUNCT:
                    if cur is None:
                        cur = [t, t + al.num_samples]
                    else:
                        cur[1] = t + al.num_samples
                t += al.num_samples
            if cur:
                groups.append(cur)
        pieces.append(a)
        pieces.append(np.zeros(gap, dtype=np.float32))
        pos += len(a) + gap
    audio = np.concatenate(pieces)

    if len(groups) == len(words):
        wt = [{"text": w, "start": g[0] / sr, "end": g[1] / sr} for w, g in zip(words, groups)]
    else:
        print(f"  ! {line['id']}: {len(groups)} phoneme words vs {len(words)} script words, estimating")
        wt = None

    if "local_child_pitch_hz" in v:
        audio = child_voice(audio, sr, v["local_child_pitch_hz"], v.get("local_child_formant_shift", 1.15))

    audio = resample(audio, sr)
    if wt is None:
        wt = estimate_words(audio, words)
    return audio, wt, {"engine": "local", "model": f"piper:{v['local_piper_model']}"}


def child_voice(x, sr, pitch, formant):
    """Raise pitch and formants (Praat 'Change gender') for a kid-like voice."""
    import parselmouth
    from parselmouth.praat import call
    snd = parselmouth.Sound(x.astype(np.float64), sampling_frequency=sr)
    out = call(snd, "Change gender", 75, 600, formant, pitch, 1.25, 1.0)
    y = out.values[0].astype(np.float32)
    n = len(x)
    return np.pad(y, (0, max(0, n - len(y))))[:n]


def estimate_words(audio, words):
    """Fallback: spread words over the voiced region, weighted by length."""
    env = np.convolve(np.abs(audio), np.ones(480) / 480, mode="same")
    idx = np.where(env > 0.05 * env.max())[0]
    a, b = (idx[0] / SR, idx[-1] / SR) if len(idx) else (0, len(audio) / SR)
    wts = np.array([max(1, len(core(w))) + 1.5 for w in words], dtype=float)
    edges = a + (b - a) * np.concatenate([[0], np.cumsum(wts) / wts.sum()])
    return [{"text": w, "start": float(edges[i]), "end": float(edges[i + 1] - 0.02)} for i, w in enumerate(words)]


# ------------------------------------------------------------------- main

def out_name(line):
    return f"{line['id']}_{line['speaker']}"


def run(engine, only=None):
    cfg = json.loads(SCRIPT.read_text())
    load_env()
    key = os.environ.get("ELEVENLABS_API_KEY", "").strip()
    lines = [l for l in cfg["lines"] if not only or l["id"] in only]

    chosen = engine
    if engine in ("auto", "elevenlabs"):
        if not key:
            if engine == "elevenlabs":
                sys.exit("ELEVENLABS_API_KEY is not set (environment or .env). Nothing was changed.")
            print("No ELEVENLABS_API_KEY found -> using local Piper voices.")
            chosen = "local"
        else:
            chosen = "elevenlabs"

    tmp = Path(tempfile.mkdtemp(prefix="voices_"))
    manifest = {}
    try:
        results = []
        for line in lines:
            print(f"[{chosen}] {line['id']} ({line['speaker']}): {line['text']}")
            if chosen == "elevenlabs":
                try:
                    results.append((line, *make_eleven(cfg, line, key)))
                except ElevenLabsError as e:
                    if engine == "elevenlabs":
                        sys.exit(f"ElevenLabs failed on {line['id']}: {e}\nNothing was changed.")
                    print(f"ElevenLabs failed ({e}) -> switching ALL lines to local Piper voices.")
                    return run("local", only)
            else:
                results.append((line, *make_local(cfg, line)))

        for line, audio, wt, meta in results:
            audio, wt = trim(audio, wt)
            audio = normalize(audio)
            name = out_name(line)
            write_wav(tmp / f"{name}.wav", audio)
            dur = len(audio) / SR
            (tmp / f"{name}.words.json").write_text(json.dumps(
                {"id": line["id"], "speaker": line["speaker"], "text": line["text"], "duration": round(dur, 4),
                 **meta, "words": [dict(w, start=round(w["start"], 4), end=round(w["end"], 4)) for w in wt]},
                indent=1))
            manifest[line["id"]] = {"file": f"{name}.wav", "duration": round(dur, 3), **meta}
            print(f"   -> {name}.wav  {dur:.2f}s  ({meta['engine']})")

        VOICES.mkdir(exist_ok=True)
        old = json.loads((VOICES / "manifest.json").read_text()) if (VOICES / "manifest.json").exists() else {}
        for f in tmp.iterdir():
            shutil.move(str(f), VOICES / f.name)
        old.update(manifest)
        (VOICES / "manifest.json").write_text(json.dumps(old, indent=1))
    finally:
        shutil.rmtree(tmp, ignore_errors=True)
    return chosen


def verify():
    """Transcribe each voice file with Whisper and compare with the script (QA only)."""
    from faster_whisper import WhisperModel
    import difflib
    cfg = json.loads(SCRIPT.read_text())
    model = WhisperModel("base.en", device="cpu", compute_type="int8")
    for line in cfg["lines"]:
        with wave.open(str(VOICES / f"{out_name(line)}.wav")) as w:
            x = np.frombuffer(w.readframes(w.getnframes()), dtype="<i2").astype(np.float32) / 32768
        segs, _ = model.transcribe(resample(x, SR, 16000), word_timestamps=True)
        heard = " ".join(w.word.strip() for s in segs for w in s.words)
        a = [core(w) for w in line["text"].split()]
        b = [core(w) for w in heard.split()]
        ratio = difflib.SequenceMatcher(None, a, b).ratio()
        print(f"{line['id']}  match={ratio:.2f}  heard: {heard}")


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--engine", choices=["auto", "elevenlabs", "local"], default="auto")
    ap.add_argument("--only", nargs="*", help="line ids to (re)generate, e.g. line07")
    ap.add_argument("--verify", action="store_true", help="transcribe the voice files with Whisper and compare")
    args = ap.parse_args()
    if args.verify:
        verify()
    else:
        run(args.engine, args.only)

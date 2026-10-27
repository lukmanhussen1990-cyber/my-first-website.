#!/usr/bin/env python3
"""Make the voice lines in script.json: one audio file per line, plus word timings.

Engines, tried in this order with --engine auto (the default):
  elevenlabs  needs ELEVENLABS_API_KEY (environment, or a .env file in this folder or
              the repo root). Word times come straight from the API's character alignment.
  kokoro      local neural TTS: pip install kokoro-onnx, model files in $KOKORO_DIR
              (default /home/user/tts-models: kokoro-v1.0.onnx, voices-v1.0.bin)
  piper       local TTS: pip install piper-tts, voice .onnx files in $PIPER_DIR
  espeak      espeak-ng on the PATH
When an engine fails on any line (no key, an HTTP error, no credits, missing models)
the whole script goes to the next one, so all lines always share one voice and the
reel always gets a voice. Files are only written once every line is voiced. Local
engines get their word times from faster-whisper, matched onto the script's own words
and refined with the energy envelope, so the subtitles always spell the script exactly.

Writes assets/vo/<id>.wav (48 kHz mono, silence trimmed), assets/vo/<id>.words.json
(word, start, end in seconds from the start of the file) and assets/vo/manifest.json.

usage: python3 tools/voices.py [--engine auto|elevenlabs|kokoro|piper|espeak] [--only n1,mom]
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
from difflib import SequenceMatcher
from math import gcd

import numpy as np
import soundfile as sf
from scipy.signal import resample_poly

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
VO = os.path.join(ROOT, "assets", "vo")
SR = 48000
ENGINES = ["elevenlabs", "kokoro", "piper", "espeak"]


def letters(s):
    return re.sub(r"[^a-z0-9']", "", s.lower())


def resample(x, sr, to=SR):
    if sr == to:
        return x.astype(np.float32)
    g = gcd(to, sr)
    return resample_poly(x, to // g, sr // g).astype(np.float32)


def decode(path_or_bytes):
    """any audio file (or bytes) -> mono float32 at 48 kHz, via ffmpeg"""
    src = path_or_bytes
    tmp = None
    if isinstance(path_or_bytes, (bytes, bytearray)):
        tmp = tempfile.NamedTemporaryFile(suffix=".audio", delete=False)
        tmp.write(path_or_bytes)
        tmp.close()
        src = tmp.name
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", src, "-ac", "1", "-ar", str(SR), "-f", "f32le", "-"],
                         check=True, capture_output=True).stdout
    if tmp:
        os.unlink(tmp.name)
    return np.frombuffer(raw, dtype=np.float32).copy()


# ---------------------------------------------------------------------------
# engines: each returns (audio float32 @ 48 kHz, words or None)
# ---------------------------------------------------------------------------
def api_key():
    key = os.environ.get("ELEVENLABS_API_KEY", "").strip()
    if key:
        return key
    for d in (ROOT, os.path.dirname(ROOT)):
        p = os.path.join(d, ".env")
        if os.path.exists(p):
            for ln in open(p):
                m = re.match(r"\s*(?:export\s+)?ELEVENLABS_API_KEY\s*=\s*['\"]?([^'\"\s#]+)", ln)
                if m:
                    return m.group(1)
    return ""


def tts_elevenlabs(line, cfg, ctx):
    key = api_key()
    if not key:
        raise RuntimeError("no ELEVENLABS_API_KEY in the environment or a .env file")
    body = {"text": line["text"], "model_id": cfg.get("model_id", "eleven_multilingual_v2")}
    if cfg.get("voice_settings"):
        body["voice_settings"] = cfg["voice_settings"]
    # neighbouring lines of the same speaker keep the delivery flowing between files
    if ctx.get("prev"):
        body["previous_text"] = ctx["prev"]
    if ctx.get("next"):
        body["next_text"] = ctx["next"]
    url = f"https://api.elevenlabs.io/v1/text-to-speech/{cfg['voice_id']}/with-timestamps?output_format=mp3_44100_128"
    req = urllib.request.Request(url, data=json.dumps(body).encode(), method="POST",
                                 headers={"xi-api-key": key, "Content-Type": "application/json", "Accept": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=120) as r:
            res = json.load(r)
    except urllib.error.HTTPError as e:
        raise RuntimeError(f"ElevenLabs HTTP {e.code}: {e.read().decode(errors='replace')[:300]}")
    audio = decode(base64.b64decode(res["audio_base64"]))
    al = res.get("alignment") or res.get("normalized_alignment")
    words = None
    if al:
        # characters -> words: a word runs from its first letter to its last
        words, cur = [], None
        for ch, s, e in zip(al["characters"], al["character_start_times_seconds"], al["character_end_times_seconds"]):
            if ch.isspace():
                if cur:
                    words.append(cur)
                cur = None
            elif cur is None:
                cur = {"w": ch, "s": s, "e": e}
            else:
                cur["w"] += ch
                cur["e"] = e
        if cur:
            words.append(cur)
    return audio, words


def kokoro_model():
    if not hasattr(kokoro_model, "k"):
        from kokoro_onnx import Kokoro
        d = os.environ.get("KOKORO_DIR", "/home/user/tts-models")
        kokoro_model.k = Kokoro(os.path.join(d, "kokoro-v1.0.onnx"), os.path.join(d, "voices-v1.0.bin"))
    return kokoro_model.k


def tts_kokoro(line, cfg, ctx):
    s, sr = kokoro_model().create(line["text"], voice=cfg["voice"], speed=cfg.get("speed", 1.0), lang="en-us")
    return resample(np.asarray(s, dtype=np.float32), sr), None


def tts_piper(line, cfg, ctx):
    d = os.environ.get("PIPER_DIR", "/home/user/tts-models")
    model = os.path.join(d, cfg["model"])
    if not os.path.exists(model):
        raise RuntimeError(f"no piper voice at {model}")
    exe = shutil.which("piper")
    with tempfile.TemporaryDirectory() as td:
        out = os.path.join(td, "o.wav")
        cmd = [exe] if exe else [sys.executable, "-m", "piper"]
        subprocess.run(cmd + ["-m", model, "-f", out, "--length-scale", str(cfg.get("length_scale", 1.0))],
                       input=line["text"].encode(), check=True, capture_output=True)
        return decode(out), None


def tts_espeak(line, cfg, ctx):
    exe = shutil.which("espeak-ng") or shutil.which("espeak")
    if not exe:
        raise RuntimeError("espeak-ng is not installed")
    with tempfile.TemporaryDirectory() as td:
        out = os.path.join(td, "o.wav")
        subprocess.run([exe, "-v", cfg.get("voice", "en-us"), "-s", str(cfg.get("words_per_minute", 165)), "-w", out, line["text"]],
                       check=True, capture_output=True)
        return decode(out), None


TTS = {"elevenlabs": tts_elevenlabs, "kokoro": tts_kokoro, "piper": tts_piper, "espeak": tts_espeak}


# ---------------------------------------------------------------------------
# timing: silence trim, whisper words matched to the script, energy refinement
# ---------------------------------------------------------------------------
def envelope_db(x, hop=0.005, win=0.02):
    n = int(len(x) / SR / hop)
    db = np.empty(max(n, 1))
    for i in range(n):
        c = i * hop
        seg = x[max(0, int((c - win / 2) * SR)):int((c + win / 2) * SR)]
        db[i] = 20 * np.log10(np.sqrt(np.mean(seg ** 2)) + 1e-9) if len(seg) else -120
    return db, hop


def trim(x, words, pad=0.05):
    db, hop = envelope_db(x)
    on = np.where(db > db.max() - 42)[0]
    a = max(0.0, on[0] * hop - pad)
    b = min(len(x) / SR, (on[-1] + 1) * hop + pad)
    y = x[int(a * SR):int(b * SR)]
    if words:
        for w in words:
            w["s"] = max(0.0, w["s"] - a)
            w["e"] = max(w["s"], w["e"] - a)
    return y, words


def whisper_words(x, prompt=""):
    """recognised words with times; the prompt (the line's own text) steers the spelling"""
    from faster_whisper import WhisperModel
    if not hasattr(whisper_words, "m"):
        whisper_words.m = WhisperModel("small.en", device="cpu", compute_type="int8")
    segs, _ = whisper_words.m.transcribe(resample(x, SR, 16000), word_timestamps=True, beam_size=5, language="en",
                                         initial_prompt=prompt or None)
    return [{"w": w.word.strip(), "s": w.start, "e": w.end} for s in segs for w in s.words]


def match_script(script_words, heard):
    """give every script word a time from the recognised words (same order)"""
    a = [letters(w) for w in script_words]
    b = [letters(w["w"]) for w in heard]
    out = [None] * len(a)
    for blk in SequenceMatcher(None, a, b, autojunk=False).get_matching_blocks():
        for k in range(blk.size):
            out[blk.a + k] = (heard[blk.b + k]["s"], heard[blk.b + k]["e"])
    # whisper sometimes splits or merges words: spread the gaps evenly by letter count
    i = 0
    while i < len(a):
        if out[i] is not None:
            i += 1
            continue
        j = i
        while j < len(a) and out[j] is None:
            j += 1
        t0 = out[i - 1][1] if i > 0 else (heard[0]["s"] if heard else 0.0)
        t1 = out[j][0] if j < len(a) else (heard[-1]["e"] if heard else t0 + 0.3 * (j - i))
        tot = sum(max(1, len(a[k])) for k in range(i, j))
        acc = 0
        for k in range(i, j):
            s = t0 + (t1 - t0) * acc / tot
            acc += max(1, len(a[k]))
            out[k] = (s, t0 + (t1 - t0) * acc / tot)
        i = j
    return [{"w": w, "s": round(s, 3), "e": round(e, 3)} for w, (s, e) in zip(script_words, out)]


def silence_runs(sil, hop, min_len):
    runs, i, n = [], 0, len(sil)
    while i < n:
        if sil[i]:
            j = i
            while j < n and sil[j]:
                j += 1
            if (j - i) * hop >= min_len:
                runs.append((i * hop, j * hop))
            i = j
        else:
            i += 1
    return runs


def syllables(w):
    w = letters(w)
    n = len(re.findall(r"[aeiouy]+", w))
    if w.endswith("e") and n > 1 and not w.endswith("le"):
        n -= 1
    return max(1, n)


def anchor_to_pauses(x, words):
    """TTS voices pause only at punctuation, and the recogniser's word times drift
    across those pauses (it put "for" before the pause in "spoon... for three").
    So each real pause is pinned to a punctuation boundary of the script, and the
    words of each phrase between pauses keep the recogniser's times when they fit
    inside the phrase, or are spread by syllable count when they don't."""
    db, hop = envelope_db(x)
    sil = db < np.percentile(db, 90) - 30
    on = np.where(~sil)[0]
    t0, t1 = on[0] * hop, (on[-1] + 1) * hop
    pauses = silence_runs(sil, hop, 0.15)
    cands = [k for k in range(len(words) - 1) if re.search(r"[,.:;?!…]$", words[k]["w"])]
    anchors, ci = [], 0
    for a, b in pauses:
        best = None
        for j in range(ci, len(cands)):
            k = cands[j]
            d = abs((words[k]["e"] + words[k + 1]["s"]) / 2 - (a + b) / 2)
            if best is None or d < best[0]:
                best = (d, j)
        if best and best[0] < 1.0:
            anchors.append((cands[best[1]], a, b))
            ci = best[1] + 1
    out = [dict(w) for w in words]
    edges = [(-1, None, t0)] + anchors + [(len(words) - 1, t1, None)]
    for (k0, _, p0), (k1, p1, _) in zip(edges[:-1], edges[1:]):
        idx = list(range(k0 + 1, k1 + 1))
        ws = [words[m]["s"] for m in idx]
        fits = all(p0 - 0.15 <= s <= p1 for s in ws) and all(a < b for a, b in zip(ws, ws[1:]))
        if fits:
            starts = [p0] + [min(max(s, p0), p1) for s in ws[1:]]
        else:
            syl = [syllables(words[m]["w"]) for m in idx]
            acc, starts = 0, []
            for s in syl:
                starts.append(p0 + (p1 - p0) * acc / sum(syl))
                acc += s
        for n, m in enumerate(idx):
            out[m]["s"] = round(starts[n], 3)
            out[m]["e"] = round(starts[n + 1] if n + 1 < len(idx) else p1, 3)
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--engine", default="auto", choices=["auto"] + ENGINES)
    ap.add_argument("--only", default="", help="comma-separated line ids")
    args = ap.parse_args()
    script = json.load(open(os.path.join(ROOT, "script.json")))
    os.makedirs(VO, exist_ok=True)
    mpath = os.path.join(VO, "manifest.json")
    manifest = json.load(open(mpath)) if os.path.exists(mpath) else {"lines": {}}
    only = set(filter(None, args.only.split(",")))
    order = ENGINES if args.engine == "auto" else [args.engine]
    lines = script["lines"]
    todo = [l for l in lines if not only or l["id"] in only]
    done = None
    for eng in order:
        # one engine for the whole script, so every line has the same voice
        if any(eng not in script["voices"][l["speaker"]] for l in todo):
            continue
        try:
            done = [(line, *voice_line(eng, line, lines, script)) for line in todo]
            break
        except Exception as e:  # fall through to the next engine
            print(f"  {eng} failed: {e}", file=sys.stderr)
    if done is None:
        sys.exit("no engine could voice the script (" + ", ".join(order) + ")")
    for line, audio, words, used in done:
        sf.write(os.path.join(VO, line["id"] + ".wav"), audio, SR, subtype="PCM_16")
        json.dump(words, open(os.path.join(VO, line["id"] + ".words.json"), "w"), indent=1)
        cfg = script["voices"][line["speaker"]][used]
        manifest["lines"][line["id"]] = {"engine": used, "voice": cfg.get("name") or cfg.get("voice") or cfg.get("model"),
                                         "duration": round(len(audio) / SR, 3), "speech": [words[0]["s"], words[-1]["e"]]}
        print(f"{line['id']:4s} {used:10s} {len(audio) / SR:5.2f}s  " + " ".join(f"{w['w']}@{w['s']:.2f}" for w in words))
    json.dump(manifest, open(mpath, "w"), indent=1)


def voice_line(eng, line, lines, script):
    """one line with one engine -> (audio, words, engine); raises if the engine fails"""
    same = [l for l in lines if l["speaker"] == line["speaker"]]
    k = same.index(line)
    ctx = {"prev": same[k - 1]["text"] if k > 0 else "", "next": same[k + 1]["text"] if k + 1 < len(same) else ""}
    try:
        audio, words = TTS[eng](line, script["voices"][line["speaker"]][eng], ctx)
    except Exception as e:
        raise RuntimeError(f"{line['id']}: {e}") from e
    script_words = line["text"].split()
    if words:
        # API alignment: map onto the script's words (spelling stays the script's)
        words = match_script(script_words, words)
    audio, words = trim(audio, words)
    if not words:
        words = anchor_to_pauses(audio, match_script(script_words, whisper_words(audio, line["text"])))
    peak = np.abs(audio).max()
    if peak > 0:
        audio = audio * (0.89 / peak)
    return audio, words, eng


if __name__ == "__main__":
    main()

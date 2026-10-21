#!/usr/bin/env python3
"""Make the narrator voice lines + word timestamps from script.json.

Providers (tried in this order with --provider auto):
  elevenlabs  ElevenLabs API (needs ELEVENLABS_API_KEY in the environment or reel/.env).
              Uses the /with-timestamps endpoint, so word timings come straight from ElevenLabs.
  kokoro      Local neural TTS (kokoro-onnx). Word timings come from the audio (faster-whisper).
  espeak      Last-resort local TTS (espeak-ng). Word timings come from the audio.

Writes:
  voice/lineNN.wav       one file per script line (48 kHz mono)
  voice/lineNN.mp3       same, compressed (for sharing)
  voice/timings.json     provider + per-word start/end times (seconds, relative to each line)
"""
import argparse, base64, difflib, json, os, re, shutil, subprocess, sys, urllib.request, urllib.error
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
VOICE_DIR = ROOT / "voice"
CACHE = ROOT / ".cache"
KOKORO_URLS = {
    "kokoro-v1.0.onnx": "https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/kokoro-v1.0.onnx",
    "voices-v1.0.bin": "https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/voices-v1.0.bin",
}


def load_env_key():
    key = os.environ.get("ELEVENLABS_API_KEY", "").strip()
    if key:
        return key
    for env in (ROOT / ".env", ROOT.parent / ".env"):
        if env.exists():
            for line in env.read_text().splitlines():
                m = re.match(r"\s*(?:export\s+)?ELEVENLABS_API_KEY\s*=\s*['\"]?([^'\"\s]+)", line)
                if m:
                    return m.group(1)
    return ""


def script_words(text):
    """Words exactly as written in the script (punctuation kept on the word)."""
    return text.split()


def norm(w):
    return re.sub(r"[^a-z0-9']", "", w.lower().replace("’", "'"))


def to_wav48(src, dst):
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(src), "-ac", "1", "-ar", "48000",
                    "-c:a", "pcm_s16le", str(dst)], check=True)


def to_mp3(src, dst):
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(src), "-c:a", "libmp3lame",
                    "-b:a", "192k", str(dst)], check=True)


def trim_silence(wav):
    """Trim leading/trailing silence, keep 40 ms pads. Returns the seconds removed at the start."""
    import numpy as np, soundfile as sf
    x, sr = sf.read(str(wav))
    env = np.abs(x)
    thr = max(1e-3, env.max() * 0.02)
    idx = np.where(env > thr)[0]
    if len(idx) == 0:
        return 0.0
    a = max(0, idx[0] - int(0.04 * sr))
    b = min(len(x), idx[-1] + int(0.08 * sr))
    sf.write(str(wav), x[a:b], sr, subtype="PCM_16")
    return a / sr


# ---------------------------------------------------------------- ElevenLabs
def elevenlabs_line(cfg, line, prev_text, next_text, key, out_mp3):
    vid = cfg["voice"]["elevenlabs_voice_id"]
    url = f"https://api.elevenlabs.io/v1/text-to-speech/{vid}/with-timestamps?output_format=mp3_44100_128"
    body = {
        "text": line["text"],
        "model_id": cfg["voice"].get("elevenlabs_model_id", "eleven_multilingual_v2"),
        "voice_settings": {"stability": 0.45, "similarity_boost": 0.8, "style": 0.35,
                           "use_speaker_boost": True, "speed": 1.08},
    }
    if prev_text:
        body["previous_text"] = prev_text
    if next_text:
        body["next_text"] = next_text
    req = urllib.request.Request(url, data=json.dumps(body).encode(), method="POST",
                                 headers={"xi-api-key": key, "Content-Type": "application/json",
                                          "Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=120) as r:
        data = json.loads(r.read())
    out_mp3.write_bytes(base64.b64decode(data["audio_base64"]))
    al = data.get("alignment") or data.get("normalized_alignment")
    chars, st, en = al["characters"], al["character_start_times_seconds"], al["character_end_times_seconds"]
    # group characters into words, then map onto the script words in order
    words, cur, cs, ce = [], "", None, None
    for c, s, e in zip(chars, st, en):
        if c.isspace():
            if cur:
                words.append((cur, cs, ce))
            cur, cs, ce = "", None, None
        else:
            if not cur:
                cs = s
            cur += c
            ce = e
    if cur:
        words.append((cur, cs, ce))
    return words


# ---------------------------------------------------------------- local TTS
def ensure_kokoro():
    CACHE.mkdir(exist_ok=True)
    for name, url in KOKORO_URLS.items():
        p = CACHE / name
        if not p.exists():
            print(f"  downloading {name} ...")
            urllib.request.urlretrieve(url, p)
    return CACHE / "kokoro-v1.0.onnx", CACHE / "voices-v1.0.bin"


_kokoro = None


def kokoro_line(cfg, line, out_wav):
    global _kokoro
    import soundfile as sf
    from kokoro_onnx import Kokoro
    if _kokoro is None:
        m, v = ensure_kokoro()
        _kokoro = Kokoro(str(m), str(v))
    samples, sr = _kokoro.create(line["text"], voice=cfg["voice"].get("local_voice", "af_heart"),
                                 speed=float(cfg["voice"].get("local_speed", 1.1)), lang="en-us")
    tmp = out_wav.with_suffix(".raw.wav")
    sf.write(str(tmp), samples, sr)
    to_wav48(tmp, out_wav)
    tmp.unlink()


def espeak_line(cfg, line, out_wav):
    tmp = out_wav.with_suffix(".raw.wav")
    subprocess.run(["espeak-ng", "-v", "en-us", "-s", "170", "-w", str(tmp), line["text"]], check=True)
    to_wav48(tmp, out_wav)
    tmp.unlink()


_whisper = None


def whisper_words(wav, text):
    """Recognised words with timestamps from the audio itself."""
    global _whisper
    from faster_whisper import WhisperModel
    if _whisper is None:
        _whisper = WhisperModel("small.en", device="cpu", compute_type="int8",
                                download_root=str(CACHE / "whisper"))
    import numpy as np, soundfile as sf
    from scipy.signal import resample_poly
    x, sr = sf.read(str(wav), dtype="float32")
    if x.ndim > 1:
        x = x.mean(axis=1)
    audio = resample_poly(x, 16000, sr).astype(np.float32)
    segs, _ = _whisper.transcribe(audio, language="en", word_timestamps=True, initial_prompt=text,
                                  vad_filter=False, beam_size=5)
    out = []
    for s in segs:
        for w in s.words:
            out.append((w.word.strip(), w.start, w.end))
    return out


def map_to_script(script_ws, heard):
    """Give every script word a start/end, matched in order against the heard words.
    Spelling always comes from the script."""
    a = [norm(w) for w in script_ws]
    b = [norm(w) for w, _, _ in heard]
    times = [None] * len(a)
    sm = difflib.SequenceMatcher(a=a, b=b, autojunk=False)
    for blk in sm.get_opcodes():
        tag, i1, i2, j1, j2 = blk
        if tag == "equal":
            for k in range(i2 - i1):
                times[i1 + k] = (heard[j1 + k][1], heard[j1 + k][2])
        elif tag == "replace" and j2 > j1:
            # spread the heard span over the script span
            s0, e0 = heard[j1][1], heard[j2 - 1][2]
            n = i2 - i1
            for k in range(n):
                times[i1 + k] = (s0 + (e0 - s0) * k / n, s0 + (e0 - s0) * (k + 1) / n)
    # fill gaps by interpolation
    for i in range(len(times)):
        if times[i] is None:
            prev_e = next((times[j][1] for j in range(i - 1, -1, -1) if times[j]), 0.0)
            nxt = next(((j, times[j][0]) for j in range(i + 1, len(times)) if times[j]), None)
            if nxt is None:
                times[i] = (prev_e, prev_e + 0.3)
            else:
                j, ns = nxt
                span = (ns - prev_e) / (j - i + 1)
                times[i] = (prev_e + span * 0.5, prev_e + span * 1.0)
    # make monotonic, no overlaps
    words = []
    last = 0.0
    for w, (s, e) in zip(script_ws, times):
        s = max(s, last)
        e = max(e, s + 0.08)
        words.append({"text": w, "start": round(s, 3), "end": round(e, 3)})
        last = s + 0.02
    return words


def refine_with_energy(wav, words):
    """Whisper word times can drift ~0.2 s. Snap word starts that follow a pause onto the
    real speech onset measured from the audio, and end the previous word where the pause begins."""
    import numpy as np, soundfile as sf
    x, sr = sf.read(str(wav))
    hop = int(0.01 * sr)
    env = np.array([np.sqrt(np.mean(x[i:i + hop] ** 2)) for i in range(0, len(x) - hop, hop)])
    thr = max(0.006, np.percentile(env, 95) * 0.08)
    quiet = env < thr
    gaps, i = [], 0
    while i < len(quiet):
        if quiet[i]:
            j = i
            while j < len(quiet) and quiet[j]:
                j += 1
            if (j - i) >= 13 and i > 0 and j < len(quiet):
                gaps.append((i * 0.01, j * 0.01))
            i = j
        else:
            i += 1
    onset = next((k * 0.01 for k, q in enumerate(quiet) if not q), 0.0)
    words[0]["start"] = round(onset, 3)
    for gs, ge in gaps:
        # the word whose start is closest to the end of this pause
        k = min(range(len(words)), key=lambda n: abs(words[n]["start"] - ge))
        if k > 0 and abs(words[k]["start"] - ge) < 0.4:
            words[k]["start"] = round(ge, 3)
            words[k - 1]["end"] = round(min(words[k - 1]["end"], gs + 0.03), 3) if words[k - 1]["end"] > gs else words[k - 1]["end"]
    for k in range(len(words)):
        if k + 1 < len(words) and words[k]["end"] > words[k + 1]["start"]:
            words[k]["end"] = words[k + 1]["start"]
        if words[k]["end"] <= words[k]["start"]:
            words[k]["end"] = round(words[k]["start"] + 0.08, 3)
    return words


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--provider", default="auto", choices=["auto", "elevenlabs", "kokoro", "espeak"])
    args = ap.parse_args()
    cfg = json.loads((ROOT / "script.json").read_text())
    VOICE_DIR.mkdir(exist_ok=True)

    order = {"auto": ["elevenlabs", "kokoro", "espeak"]}.get(args.provider, [args.provider])
    key = load_env_key()
    lines = cfg["lines"]
    for provider in order:
        if provider == "elevenlabs" and not key:
            print("ElevenLabs: no ELEVENLABS_API_KEY found (env or .env) -> trying the next voice.")
            continue
        try:
            print(f"Voice provider: {provider}")
            result = []
            tmp = VOICE_DIR / f".tmp_{provider}"   # only replace the old voice once every line worked
            shutil.rmtree(tmp, ignore_errors=True); tmp.mkdir()
            for i, line in enumerate(lines):
                stem = tmp / f"line{line['id']:02d}"
                wav = stem.with_suffix(".wav")
                if provider == "elevenlabs":
                    mp3 = stem.with_suffix(".el.mp3")
                    raw = elevenlabs_line(cfg, line, lines[i - 1]["text"] if i else "",
                                          lines[i + 1]["text"] if i + 1 < len(lines) else "", key, mp3)
                    to_wav48(mp3, wav)
                    mp3.unlink()
                    cut = trim_silence(wav)
                    heard = [(w, s - cut, e - cut) for w, s, e in raw]
                elif provider == "kokoro":
                    kokoro_line(cfg, line, wav)
                    trim_silence(wav)
                    heard = whisper_words(wav, line["text"])
                else:
                    espeak_line(cfg, line, wav)
                    trim_silence(wav)
                    heard = whisper_words(wav, line["text"])
                import soundfile as sf
                dur = sf.info(str(wav)).duration
                words = map_to_script(script_words(line["text"]), heard)
                if provider != "elevenlabs":
                    words = refine_with_energy(wav, words)
                to_mp3(wav, stem.with_suffix(".mp3"))
                result.append({"id": line["id"], "file": f"voice/{wav.name}", "duration": round(dur, 3),
                               "words": words})
                print(f"  line {line['id']}: {dur:.2f}s  {line['text']}")
            for f in tmp.iterdir():
                shutil.move(str(f), str(VOICE_DIR / f.name))
            tmp.rmdir()
            voice_name = (cfg["voice"]["elevenlabs_voice_name"] if provider == "elevenlabs"
                          else cfg["voice"].get("local_voice") if provider == "kokoro" else "espeak-ng en-us")
            (VOICE_DIR / "timings.json").write_text(json.dumps(
                {"provider": provider, "voice": voice_name, "lines": result}, indent=1))
            print("Wrote voice/timings.json")
            return 0
        except urllib.error.HTTPError as e:
            print(f"{provider} failed: HTTP {e.code} {e.read()[:300]!r} -> trying the next voice.")
            shutil.rmtree(VOICE_DIR / f".tmp_{provider}", ignore_errors=True)
        except Exception as e:  # noqa: BLE001 - any failure falls through to the next provider
            print(f"{provider} failed: {e!r} -> trying the next voice.")
            shutil.rmtree(VOICE_DIR / f".tmp_{provider}", ignore_errors=True)
    print("No voice provider worked.")
    return 1


if __name__ == "__main__":
    sys.exit(main())

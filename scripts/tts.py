#!/usr/bin/env python3
"""Voiceover: edge-tts (en-US-AndrewMultilingualNeural, rate -8%, pitch -4Hz) per line,
word boundaries -> build/timings.json, assembled + polished -> build/voice.wav (48 kHz mono).

If assets/voice.wav exists (your own recording of the same script), it is used instead and
word timings are recovered with faster-whisper forced word timestamps.
"""
import asyncio, json, os, ssl, subprocess, sys, re
import numpy as np
import soundfile as sf

sys.path.insert(0, os.path.dirname(__file__))
from script_lines import LINES, LEAD_IN, tts_text

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BUILD = os.path.join(ROOT, "build")
TMP = os.path.join(BUILD, "tts")
SR = 48000
VOICE = os.environ.get("VOICE", "en-US-AndrewMultilingualNeural")
RATE = os.environ.get("RATE", "-8%")
PITCH = os.environ.get("PITCH", "-4Hz")


def norm(w):
    return re.sub(r"[^a-z0-9']", "", w.lower().replace("’", "'"))


def display_tokens(line):
    """Tokens as shown on screen, with highlight + caption-break flags."""
    toks = []
    brk = False
    for raw in line["text"].split(" "):
        if raw == "|":
            brk = True
            continue
        hl = raw.startswith("*") or raw.endswith("*") or "*" in raw
        clean = raw.replace("*", "")
        toks.append(dict(t=clean, hl=hl, brk=brk))
        brk = False
    return toks


async def synth(text, path):
    import edge_tts
    import edge_tts.communicate as ec
    ca = "/root/.ccr/ca-bundle.crt"
    if os.path.exists(ca):
        ec._SSL_CTX = ssl.create_default_context(cafile=ca)
    proxy = os.environ.get("HTTPS_PROXY")
    c = edge_tts.Communicate(text, VOICE, rate=RATE, pitch=PITCH, boundary="WordBoundary", proxy=proxy)
    words = []
    with open(path, "wb") as f:
        async for ch in c.stream():
            if ch["type"] == "audio":
                f.write(ch["data"])
            elif ch["type"] == "WordBoundary":
                words.append(dict(w=ch["text"], start=ch["offset"] / 1e7, end=(ch["offset"] + ch["duration"]) / 1e7))
    return words


def decode(path):
    wav = path.rsplit(".", 1)[0] + ".wav"
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", path, "-ac", "1", "-ar", str(SR), "-c:a", "pcm_f32le", wav], check=True)
    a, _ = sf.read(wav, dtype="float32")
    return a


def trim_bounds(a, words):
    """Start just before the first word, end after the decay of the last word."""
    s = max(0, int((words[0]["start"] - 0.05) * SR))
    e = int((words[-1]["end"] + 0.10) * SR)
    win = int(0.01 * SR)
    thr = 10 ** (-48 / 20)
    while e + win < len(a) and e < int((words[-1]["end"] + 0.45) * SR):
        if np.sqrt(np.mean(a[e:e + win] ** 2)) < thr:
            break
        e += win
    return s, min(e, len(a))


def align_tokens(tokens, words):
    """Map each on-screen token to a spoken word (sequential, tolerant)."""
    out = []
    wi = 0
    for tk in tokens:
        n = norm(tk["t"])
        hit = None
        for j in range(wi, min(wi + 4, len(words))):
            if norm(words[j]["w"]) == n or (n and norm(words[j]["w"]).startswith(n[:4])):
                hit = j
                break
        if hit is None and wi < len(words):
            hit = wi
        if hit is not None:
            wi = hit + 1
            out.append(dict(tk, start=words[hit]["start"], end=words[hit]["end"]))
        else:
            prev = out[-1] if out else dict(start=0, end=0.2)
            out.append(dict(tk, start=prev["end"], end=prev["end"] + 0.2))
    return out


def polish(x):
    """Gentle broadcast chain: HPF, warmth, de-harsh, compression, tiny room."""
    tmp_in = os.path.join(TMP, "_pol_in.wav")
    tmp_out = os.path.join(TMP, "_pol_out.wav")
    sf.write(tmp_in, x, SR, subtype="FLOAT")
    chain = ",".join([
        "highpass=f=70",
        "equalizer=f=140:t=q:w=1.0:g=2.0",     # chest warmth
        "equalizer=f=3200:t=q:w=1.2:g=1.5",    # presence
        "equalizer=f=7200:t=q:w=2.0:g=-2.5",   # tame mp3 fizz / sibilance
        "acompressor=threshold=-20dB:ratio=2.5:attack=8:release=120:makeup=2",
        "aecho=0.85:0.9:28|47:0.10|0.06",       # very small room so it doesn't sound 'boxed'
        "alimiter=limit=0.89",
    ])
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", tmp_in, "-af", chain, "-ar", str(SR), "-c:a", "pcm_f32le", tmp_out], check=True)
    y, _ = sf.read(tmp_out, dtype="float32")
    return y


def build_from_tts():
    os.makedirs(TMP, exist_ok=True)
    pieces, lines_out = [], []
    t = LEAD_IN
    pieces.append(np.zeros(int(LEAD_IN * SR), dtype=np.float32))
    for ln in LINES:
        text = tts_text(ln)
        mp3 = os.path.join(TMP, ln["id"] + ".mp3")
        cache = mp3 + ".json"
        key = dict(text=text, voice=VOICE, rate=RATE, pitch=PITCH)
        if os.path.exists(cache) and json.load(open(cache)).get("key") == key and os.path.exists(mp3):
            words = json.load(open(cache))["words"]
        else:
            for attempt in range(6):
                try:
                    words = asyncio.run(synth(text, mp3))
                    dur = len(decode(mp3)) / SR
                    expected = len([w for w in re.split(r"\s+", text) if norm(w)])
                    if len(words) < expected or dur < words[-1]["end"] + 0.05:
                        raise RuntimeError(f"truncated stream ({len(words)}/{expected} words, {dur:.2f}s audio)")
                    break
                except Exception as ex:  # service hiccups: retry with backoff
                    print(f"  retry {ln['id']} ({ex.__class__.__name__})")
                    import time
                    time.sleep(2 * 2 ** attempt)
            else:
                raise SystemExit(f"TTS failed for {ln['id']}")
            json.dump(dict(key=key, words=words), open(cache, "w"))
        a = decode(mp3)
        s, e = trim_bounds(a, words)
        seg = a[s:e]
        off = t - s / SR
        spoken = [dict(w=w["w"], start=round(w["start"] + off, 3), end=round(w["end"] + off, 3)) for w in words]
        toks = align_tokens(display_tokens(ln), spoken)
        lines_out.append(dict(id=ln["id"], card=ln.get("card", False), ref=ln.get("ref"), text=ln["text"],
                              start=round(t, 3), end=round(t + len(seg) / SR, 3),
                              words=spoken, tokens=toks))
        print(f"{ln['id']:>4} {t:6.2f}-{t + len(seg) / SR:6.2f}  {text}")
        pieces.append(seg)
        t += len(seg) / SR
        pieces.append(np.zeros(int(ln["gap"] * SR), dtype=np.float32))
        t += ln["gap"]
    voice = np.concatenate(pieces)
    return voice, lines_out


def build_from_user_voice(path):
    from faster_whisper import WhisperModel
    a, sr = sf.read(path, dtype="float32", always_2d=True)
    a = a.mean(1)
    if sr != SR:
        tmp = os.path.join(TMP, "_user48.wav")
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", path, "-ac", "1", "-ar", str(SR), "-c:a", "pcm_f32le", tmp], check=True)
        a, _ = sf.read(tmp, dtype="float32")
    a16 = subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-ac", "1", "-ar", "16000", "-f", "f32le", "-"], capture_output=True, check=True).stdout
    m = WhisperModel("small.en", device="cpu", compute_type="int8")
    segs, _ = m.transcribe(np.frombuffer(a16, dtype=np.float32), word_timestamps=True)
    heard = [dict(w=w.word.strip(), start=w.start, end=w.end) for s in segs for w in s.words]
    lines_out, hi = [], 0
    for ln in LINES:
        n = len(tts_text(ln).split())
        spoken = heard[hi:hi + n]
        hi += n
        if not spoken:
            break
        toks = align_tokens(display_tokens(ln), spoken)
        lines_out.append(dict(id=ln["id"], card=ln.get("card", False), ref=ln.get("ref"), text=ln["text"],
                              start=spoken[0]["start"], end=spoken[-1]["end"], words=spoken, tokens=toks))
    return a, lines_out


def main():
    os.makedirs(TMP, exist_ok=True)
    user = os.path.join(ROOT, "assets", "voice.wav")
    if os.path.exists(user):
        print("Using your recording:", user)
        voice, lines = build_from_user_voice(user)
    else:
        voice, lines = build_from_tts()
        voice = polish(voice)
    total = len(voice) / SR
    sf.write(os.path.join(BUILD, "voice.wav"), voice, SR, subtype="PCM_24")
    json.dump(dict(voice=VOICE, rate=RATE, pitch=PITCH, sr=SR, duration=round(total, 3), lines=lines),
              open(os.path.join(BUILD, "timings.json"), "w"), indent=1)
    nwords = sum(len(l["words"]) for l in lines)
    print(f"voice: {total:.2f}s, {nwords} words, {nwords / total:.2f} words/s overall")


if __name__ == "__main__":
    main()

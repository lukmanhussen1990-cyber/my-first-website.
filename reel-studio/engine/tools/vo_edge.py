#!/usr/bin/env python3
"""Per-scene Hindi voiceover with Microsoft Edge neural TTS (free, no API key).

For every scene in vo_script.json this writes:
  <out>/<ID>.wav   48 kHz mono, leading/trailing silence trimmed, pauses re-timed
  <out>/<ID>.json  word timings (seconds, relative to the clip start)

Pauses: Edge renders "..." as a ~1.2 s gap, which drags. The gap after each
word is re-timed by the punctuation that follows it in the script (see PAUSES),
only inside detected silence, so the speech itself is never cut or sped up.

Usage:
  python3 vo_edge.py vo_script.json OUT_DIR [--voice hi-IN-MadhurNeural]
         [--rate -8%] [--pitch -6Hz] [--only S01,S02] [--skip-optional]
"""
import argparse, asyncio, json, os, re, ssl, subprocess, sys, tempfile
import numpy as np
import soundfile as sf

SR = 48000
# target silence (s) after a word, keyed by the punctuation that follows it
PAUSES = {"...": 0.42, "…": 0.42, "?": 0.38, "।": 0.34, ".": 0.34, "!": 0.34, ",": 0.20, "—": 0.30}
EDGE_FORMAT = "audio-24khz-96kbitrate-mono-mp3"


def load_edge():
    """Import edge_tts with the proxy CA and the higher-bitrate output format."""
    import edge_tts
    import edge_tts.communicate as ec
    ca = os.environ.get("SSL_CERT_FILE") or "/root/.ccr/ca-bundle.crt"
    ec._SSL_CTX = ssl.create_default_context(cafile=ca if os.path.exists(ca) else None)
    # The package hard-codes the 48 kbps format in its speech.config message.
    # Patch the constant in the source of the bound method's module at runtime.
    src_path = ec.__file__
    src = open(src_path, encoding="utf-8").read()
    if EDGE_FORMAT not in src:
        patched = re.sub(r'"outputFormat":"[^"]+"', f'"outputFormat":"{EDGE_FORMAT}"', src)
        tmpdir = tempfile.mkdtemp(prefix="edge_tts_")
        pkg = os.path.join(tmpdir, "edge_tts")
        import shutil
        shutil.copytree(os.path.dirname(src_path), pkg)
        open(os.path.join(pkg, "communicate.py"), "w", encoding="utf-8").write(patched)
        for m in [k for k in sys.modules if k == "edge_tts" or k.startswith("edge_tts.")]:
            del sys.modules[m]
        sys.path.insert(0, tmpdir)
        import edge_tts
        import edge_tts.communicate as ec
        ec._SSL_CTX = ssl.create_default_context(cafile=ca if os.path.exists(ca) else None)
    return edge_tts


async def synth(edge_tts, text, voice, rate, pitch, mp3_path):
    c = edge_tts.Communicate(text, voice, rate=rate, pitch=pitch, boundary="WordBoundary")
    words = []
    with open(mp3_path, "wb") as f:
        async for ch in c.stream():
            if ch["type"] == "audio":
                f.write(ch["data"])
            elif ch["type"] == "WordBoundary":
                words.append({"w": ch["text"], "s": ch["offset"] / 1e7, "e": (ch["offset"] + ch["duration"]) / 1e7})
    return words


def decode(path):
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-ac", "1", "-ar", str(SR), "-f", "f32le", "-"],
                         capture_output=True, check=True).stdout
    return np.frombuffer(raw, dtype=np.float32).copy()


def script_tokens(text):
    """Split script text into words with the punctuation that follows each."""
    toks = []
    for m in re.finditer(r"([^\s.,?!।…—]+)([\s]*)((?:\.\.\.|…|[.,?!।—])*)", text):
        word, punct = m.group(1), m.group(3)
        if not word.strip():
            continue
        toks.append({"w": word, "p": punct})
    return toks


def frame_db(x, hop):
    n = len(x) // hop
    fr = x[: n * hop].reshape(n, hop)
    return 20 * np.log10(np.sqrt((fr ** 2).mean(1)) + 1e-9)


def retime(x, words, toks):
    """Re-time inter-word silences by punctuation. Returns new audio + new word times."""
    hop = int(SR * 0.005)
    db = frame_db(x, hop)
    floor = max(-60.0, db.max() - 48)
    silent = db < floor
    # align boundary words to script tokens in order (counts normally match)
    punct = [""] * len(words)
    j = 0
    for i, w in enumerate(words):
        # advance through script tokens to the one that matches this boundary word
        best = None
        for k in range(j, min(j + 4, len(toks))):
            if toks[k]["w"].strip("'\"") == w["w"].strip("'\"") or w["w"] in toks[k]["w"] or toks[k]["w"] in w["w"]:
                best = k
                break
        if best is None:
            best = min(j, len(toks) - 1)
        punct[i] = toks[best]["p"] if best < len(toks) else ""
        j = best + 1
    segments = []  # list of (src_start, src_end) sample ranges to keep, plus inserted silences
    out = []
    cursor = 0
    shift_points = []  # (src_time, delta) cumulative shift applied after src_time
    total_shift = 0.0
    for i in range(len(words) - 1):
        p = punct[i]
        target = None
        for key in ("...", "…", "?", "।", ".", "!", "—", ","):
            if key in p:
                target = PAUSES[key]
                break
        if target is None:
            continue
        # find the silent run between this word's end and the next word's start
        a = int(max(0, (words[i]["e"] - 0.08) * SR) // hop)
        b = int(min(len(x) / SR, words[i + 1]["s"] + 0.12) * SR // hop)
        best_run, run_start = (0, 0, 0), None
        for f in range(a, min(b, len(silent))):
            if silent[f] and run_start is None:
                run_start = f
            if (not silent[f] or f == min(b, len(silent)) - 1) and run_start is not None:
                end = f if not silent[f] else f + 1
                if end - run_start > best_run[0]:
                    best_run = (end - run_start, run_start, end)
                run_start = None
        length, rs, re_ = best_run
        if length * hop < 0.06 * SR:
            continue
        cur = length * hop / SR
        delta = target - cur
        # keep 40 ms either side of the silence untouched, edit the middle
        mid = (rs + re_) // 2 * hop
        if delta < 0:
            cut = int(-delta * SR)
            cut = min(cut, max(0, length * hop - int(0.08 * SR)))
            out.append(x[cursor: mid - cut // 2])
            cursor = mid + (cut - cut // 2)
            total_shift -= cut / SR
        else:
            out.append(x[cursor: mid])
            out.append(np.zeros(int(delta * SR), dtype=np.float32))
            cursor = mid
            total_shift += int(delta * SR) / SR
        shift_points.append((mid / SR, total_shift))
    out.append(x[cursor:])
    y = np.concatenate(out)

    def map_t(t):
        s = 0.0
        for st, sh in shift_points:
            if t >= st:
                s = sh
        return t + s

    new_words = [{"w": w["w"], "s": map_t(w["s"]), "e": map_t(w["e"]), "p": punct[i]} for i, w in enumerate(words)]
    return y, new_words


def trim(y, words, lead=0.04, tail=0.12):
    hop = int(SR * 0.005)
    db = frame_db(y, hop)
    floor = max(-60.0, db.max() - 48)
    voiced = np.nonzero(db > floor)[0]
    if len(voiced) == 0:
        return y, words
    s = max(0, voiced[0] * hop - int(lead * SR))
    e = min(len(y), (voiced[-1] + 1) * hop + int(tail * SR))
    off = s / SR
    y = y[s:e]
    words = [{**w, "s": max(0.0, w["s"] - off), "e": min(len(y) / SR, w["e"] - off)} for w in words]
    # fade edges to avoid clicks
    f = int(0.006 * SR)
    y[:f] *= np.linspace(0, 1, f)
    y[-f:] *= np.linspace(1, 0, f)
    return y, words


async def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("script")
    ap.add_argument("out")
    ap.add_argument("--voice", default="hi-IN-MadhurNeural")
    ap.add_argument("--rate", default="-8%")
    ap.add_argument("--pitch", default="-6Hz")
    ap.add_argument("--only", default="")
    ap.add_argument("--skip-optional", action="store_true")
    a = ap.parse_args()
    edge_tts = load_edge()
    js = json.load(open(a.script, encoding="utf-8"))
    os.makedirs(a.out, exist_ok=True)
    only = set(filter(None, a.only.split(",")))
    summary = []
    for sc in js["scenes"]:
        if only and sc["id"] not in only:
            continue
        if a.skip_optional and sc.get("optional"):
            continue
        mp3 = os.path.join(a.out, sc["id"] + ".raw.mp3")
        for attempt in range(4):
            try:
                words = await synth(edge_tts, sc["vo"], a.voice, a.rate, a.pitch, mp3)
                break
            except Exception as e:  # network hiccup: retry with backoff
                if attempt == 3:
                    raise
                await asyncio.sleep(2 ** (attempt + 1))
        x = decode(mp3)
        y, w2 = retime(x, words, script_tokens(sc["vo"]))
        y, w2 = trim(y, w2)
        sf.write(os.path.join(a.out, sc["id"] + ".wav"), y, SR, subtype="PCM_24")
        meta = {"id": sc["id"], "text": sc["vo"], "duration": len(y) / SR, "voice": a.voice,
                "rate": a.rate, "pitch": a.pitch, "words": w2}
        json.dump(meta, open(os.path.join(a.out, sc["id"] + ".json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
        summary.append((sc["id"], len(y) / SR, len(x) / SR))
        print(f"{sc['id']}: {len(x)/SR:5.2f}s raw -> {len(y)/SR:5.2f}s", flush=True)
    tot = sum(s[1] for s in summary)
    print(f"TOTAL speech {tot:.2f}s over {len(summary)} clips")


if __name__ == "__main__":
    asyncio.run(main())

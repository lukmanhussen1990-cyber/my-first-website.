#!/usr/bin/env python3
"""Assemble the voiceover from the per-line ElevenLabs files and build
build/timeline.json (scene cuts, word timings and caption chunks).

Every line was generated once and lives in voice/lines/NN_speaker.mp3.
This script never calls ElevenLabs. It:
  1. trims the silence at both ends of each line file,
  2. places the lines on one timeline with the planned pauses (script.json
     "pause" before each line, "tail" after the last), scaling the flexible
     pauses so the reel lands on "target_duration",
  3. writes voice/voiceover.wav (48 kHz mono, the lines untouched),
  4. gets word timings by transcribing each line locally with faster-whisper
     (cached in build/whisper_lines.json) and copies them onto the script
     words, so caption text is always spelled exactly like the script.

    python3 tools/assemble.py
"""
import difflib
import json
import os
import re
import subprocess
import sys

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
SR = 48000
WSR = 16000


def norm(word):
    w = word.lower().replace("’", "'")
    w = re.sub(r"[^a-z0-9']", "", w).replace("'", "")
    return w


def decode(path, sr, af=None):
    cmd = ["ffmpeg", "-v", "error", "-i", path, "-ac", "1", "-ar", str(sr)]
    if af:
        cmd += ["-af", af]
    raw = subprocess.run(cmd + ["-f", "f32le", "-"], capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.float32).copy()


def loudness(path):
    """Integrated loudness (LUFS) and true peak (dBFS) of one line file."""
    out = subprocess.run(["ffmpeg", "-v", "info", "-i", path, "-af", "ebur128=peak=true", "-f", "null", "-"],
                         capture_output=True, text=True).stderr
    return (float(re.findall(r"I:\s+(-?[0-9.]+) LUFS", out)[-1]),
            float(re.findall(r"Peak:\s+(-?[0-9.]+) dBFS", out)[-1]))


def level_chain(path, target):
    """Gain to bring a line to the target loudness; a lookahead limiter keeps
    the boosted peaks under -1 dBFS (only ever touches a few peaks)."""
    i, _ = loudness(path)
    g = float(np.clip(target - i, -8.0, 8.0))
    return round(g, 2), f"volume={g:.2f}dB,alimiter=limit=0.89:attack=3:release=60:level=0:latency=1"


def frame_db(a, sr, hop_s=0.005):
    hop = int(sr * hop_s)
    n = len(a) // hop
    fr = a[: n * hop].reshape(n, hop)
    return 20 * np.log10(np.sqrt((fr ** 2).mean(axis=1)) + 1e-9), hop_s


def speech_bounds(a, sr, thresh=-46.0):
    db, hs = frame_db(a, sr)
    on = np.where(db > thresh)[0]
    return on[0] * hs, (on[-1] + 1) * hs


def inner_gaps(a, sr, thresh=-40.0, min_gap=0.09):
    """Pauses inside one line (between sentences / at commas)."""
    db, hs = frame_db(a, sr)
    on = db > thresh
    gaps, i, n = [], 0, len(on)
    while i < n:
        if not on[i]:
            j = i
            while j < n and not on[j]:
                j += 1
            if i > 0 and j < n and (j - i) * hs >= min_gap:
                gaps.append((i * hs, j * hs))
            i = j
        else:
            i += 1
    return gaps


_MODEL = {}


def get_model(name="medium.en"):
    from faster_whisper import WhisperModel
    if name not in _MODEL:
        _MODEL[name] = WhisperModel(name, device="cpu", compute_type="int8")
    return _MODEL[name]


def whisper_words(seg16, prompt):
    pad = np.zeros(int(0.35 * WSR), np.float32)
    out, _ = get_model().transcribe(np.concatenate([pad, seg16, pad]), word_timestamps=True, beam_size=5,
                                    language="en", initial_prompt=prompt, vad_filter=False)
    return [{"w": x.word.strip(), "s": round(x.start - 0.35, 3), "e": round(x.end - 0.35, 3),
             "p": round(float(x.probability), 3)} for o in out for x in o.words]


def spread(words, s0, e0):
    lens = [max(2, len(norm(w["text"]))) for w in words]
    tot = float(sum(lens))
    t = s0
    for w, L in zip(words, lens):
        d = (e0 - s0) * L / tot
        w["s"], w["e"] = t, t + d
        t += d


def time_line_words(lw, heard, dur, gaps):
    """Word times inside one trimmed line (0 = first sound, dur = last)."""
    A = [norm(w["text"]) for w in lw]
    B = [norm(h["w"]) for h in heard]
    sm = difflib.SequenceMatcher(a=A, b=B, autojunk=False)
    matched = 0
    for tag, i1, i2, j1, j2 in sm.get_opcodes():
        if tag == "equal" or (tag == "replace" and i2 - i1 == j2 - j1):
            for k in range(i2 - i1):
                lw[i1 + k]["s"], lw[i1 + k]["e"] = heard[j1 + k]["s"], heard[j1 + k]["e"]
                lw[i1 + k]["heard"] = heard[j1 + k]["w"]
                matched += tag == "equal"
        elif tag == "replace":
            spread(lw[i1:i2], heard[j1]["s"], heard[j2 - 1]["e"])
    n = len(lw)
    for i, w in enumerate(lw):
        if "s" in w:
            continue
        j = i
        while j < n and "s" not in lw[j]:
            j += 1
        a = lw[i - 1]["e"] if i > 0 else 0.0
        b = lw[j]["s"] if j < n else dur
        spread(lw[i:j], a, max(b, a + 0.08 * (j - i)))
    # Phrases: the real pauses inside the line split it into phrases. Each
    # pause is pinned to the word boundary whisper puts nearest to it, then
    # whisper's word times are stretched onto each phrase's real start/end,
    # so a phrase starts exactly when the speech resumes.
    bounds, used = [], set()
    for g0, g1 in (g for g in gaps if g[1] - g[0] >= 0.12):
        m = (g0 + g1) / 2
        cands = [(abs((lw[k - 1]["e"] + lw[k]["s"]) / 2 - m), k) for k in range(1, n) if k not in used]
        cands = [c for c in cands if c[0] < 0.45]
        if cands:
            k = min(cands)[1]
            used.add(k)
            bounds.append((k, g0, g1))
    bounds.sort()
    bounds = [b for i, b in enumerate(bounds) if i == 0 or b[1] > bounds[i - 1][2]]
    phrases, k0, t0 = [], 0, 0.0
    for k, g0, g1 in bounds:
        phrases.append((k0, k, t0, g0))
        k0, t0 = k, g1
    phrases.append((k0, n, t0, dur))
    for i0, i1, ts, te in phrases:
        ws, we = lw[i0]["s"], lw[i1 - 1]["e"]
        if we - ws < 0.05:
            spread(lw[i0:i1], ts, te)
            continue
        for w in lw[i0:i1]:
            w["s"] = ts + (w["s"] - ws) * (te - ts) / (we - ws)
            w["e"] = ts + (w["e"] - ws) * (te - ts) / (we - ws)
    for a, b in zip(lw, lw[1:]):
        b["s"] = max(b["s"], a["s"] + 0.05)
        a["e"] = min(a["e"], max(b["s"], a["s"] + 0.05))
    for w in lw:
        w["s"] = min(max(w["s"], 0.0), dur - 0.05)
        w["e"] = min(max(w["e"], w["s"] + 0.05), dur)
    return matched


FUNCTION_WORDS = {"the", "a", "an", "in", "into", "to", "with", "my", "your", "his", "her", "of",
                  "and", "he", "you", "is", "that", "at", "who", "from", "on", "it", "i", "we"}


def chunk_line(words):
    """Caption chunks of 2-3 words (1 only when a sentence is one word):
    break at punctuation, never after a function word if avoidable, never
    across a sentence end."""
    n = len(words)
    INF = 1e9

    def cost(i, j):
        c = {1: 2.5, 2: 0.0, 3: 0.05}[j - i] + 0.3
        for k in range(i, j - 1):
            t = words[k]["text"]
            if re.search(r"[.!?]$", t):
                return INF
            if t.endswith(","):
                c += 1.2
        if j < n:
            last = words[j - 1]["text"]
            if re.search(r"[,.!?]$", last):
                pass
            elif norm(last) in FUNCTION_WORDS:
                c += 1.6
            else:
                c += 0.4
        return c

    best, back = [0.0] + [INF] * n, [0] * (n + 1)
    for j in range(1, n + 1):
        for size in (1, 2, 3):
            i = j - size
            if i >= 0 and best[i] + cost(i, j) < best[j]:
                best[j], back[j] = best[i] + cost(i, j), i
    out, j = [], n
    while j > 0:
        out.append(words[back[j]:j])
        j = back[j]
    return out[::-1]


def main():
    script = json.load(open(os.path.join(ROOT, "script.json")))
    lines = script["lines"]
    build = os.path.join(ROOT, "build")
    os.makedirs(build, exist_ok=True)
    cache_f = os.path.join(build, "whisper_lines.json")
    cache = json.load(open(cache_f)) if os.path.exists(cache_f) else {}

    # 1) even out the levels (the four voices came out up to 11 dB apart) and
    #    trim the silence at both ends of every line file
    segs = []
    for l in lines:
        path = os.path.join(ROOT, l["file"])
        raw = decode(path, SR)
        s, e = speech_bounds(raw, SR)
        s, e = max(0.0, s - 0.015), min(len(raw) / SR, e + 0.04)
        gain, chain = level_chain(path, -15.0 if l.get("loud") else -16.0)
        a = decode(path, SR, chain)
        l["gain_db"] = gain
        seg = a[int(s * SR):int(e * SR)].copy()
        f = int(0.004 * SR)
        seg[:f] *= np.linspace(0, 1, f)
        seg[-f:] *= np.linspace(1, 0, f)
        segs.append({"a": seg, "trim": (round(s, 3), round(e, 3)), "dur": len(seg) / SR})
    speech = sum(x["dur"] for x in segs)

    # 2) pauses, scaled so the whole reel lands on the target length
    flex = sum(l["pause"] for l in lines if not l.get("pause_fixed")) + script["tail"]
    fixed = sum(l["pause"] for l in lines if l.get("pause_fixed"))
    target = script.get("target_duration", speech + flex + fixed)
    k = min(1.6, max(0.75, (target - speech - fixed) / flex))
    t = 0.0
    for l, x in zip(lines, segs):
        t += l["pause"] * (1.0 if l.get("pause_fixed") else k)
        x["t0"] = round(t, 3)
        t += x["dur"]
    duration = round(t + script["tail"] * k, 3)
    print(f"speech {speech:.2f}s + pauses x{k:.2f} -> reel {duration:.2f}s")

    # 3) the voiceover track
    track = np.zeros(int(duration * SR) + SR // 10, np.float32)
    for x in segs:
        i = int(round(x["t0"] * SR))
        track[i:i + len(x["a"])] += x["a"]
    track = track[: int(duration * SR)]
    pcm = (np.clip(track, -1, 1) * 32767).astype(np.int16).tobytes()
    vo = os.path.join(ROOT, "voice", "voiceover.wav")
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "s16le", "-ar", str(SR), "-ac", "1", "-i", "-", vo],
                   input=pcm, check=True)

    # 4) word timings, one line at a time
    words = []
    for li, (l, x) in enumerate(zip(lines, segs)):
        key = f"{l['file']}|{x['trim'][0]}|{x['trim'][1]}"
        if key not in cache:
            a16 = decode(os.path.join(ROOT, l["file"]), WSR)
            cache[key] = whisper_words(a16[int(x["trim"][0] * WSR):int(x["trim"][1] * WSR)], l["text"])
            json.dump(cache, open(cache_f, "w"), indent=1)
        lw = [{"text": tok, "line": li, "loud": bool(l.get("loud"))} for tok in l["text"].split()]
        gaps = inner_gaps(x["a"], SR)
        m = time_line_words(lw, cache[key], x["dur"], gaps)
        for w in lw:
            w["s"] = round(w["s"] + x["t0"], 3)
            w["e"] = round(w["e"] + x["t0"], 3)
        heard = " ".join(h["w"] for h in cache[key])
        flag = "" if m == len(lw) else f"   (heard: {heard})"
        print(f"  {l['id']:2d} {x['t0']:6.2f}-{x['t0'] + x['dur']:6.2f} {l['speaker']:8s} {m}/{len(lw)} words  {l['text']}{flag}")
        words += lw

    # scenes: one per line; a scene starts just before its first word (or right
    # after the previous line for "lead": "gap") and runs until the next one
    scenes = []
    for li, (l, x) in enumerate(zip(lines, segs)):
        ws, we = x["t0"], x["t0"] + x["dur"]
        if li == 0:
            st = 0.0
        else:
            prev_end = segs[li - 1]["t0"] + segs[li - 1]["dur"]
            lead = l.get("lead", 0.10)
            st = prev_end + 0.12 if lead == "gap" else max(prev_end + 0.05, ws - lead)
        scenes.append({"id": l["id"], "speaker": l["speaker"], "text": l["text"], "ws": ws, "we": we, "start": st})
    for i, sc in enumerate(scenes):
        sc["end"] = scenes[i + 1]["start"] if i + 1 < len(scenes) else duration
        sc["dur"] = sc["end"] - sc["start"]
        for key in ("ws", "we", "start", "end", "dur"):
            sc[key] = round(sc[key], 3)

    captions = []
    for li in range(len(lines)):
        lw = [w for w in words if w["line"] == li]
        for ch in chunk_line(lw):
            captions.append({
                "text": " ".join(w["text"] for w in ch),
                "words": [{"t": w["text"], "s": w["s"], "e": w["e"]} for w in ch],
                "s": round(max(0.0, ch[0]["s"] - 0.03), 3),
                "e": ch[-1]["e"],
                "line": li,
                "speaker": lines[li]["speaker"],
                "loud": any(w["loud"] for w in ch),
            })
    for i, c in enumerate(captions):
        nxt = captions[i + 1]["s"] if i + 1 < len(captions) else duration
        c["hide"] = round(min(nxt, c["e"] + 0.6), 3)

    tl = {"duration": duration, "fps": 30, "source": "voice/voiceover.wav", "pause_scale": round(k, 3),
          "scenes": scenes, "captions": captions,
          "words": [{"t": w["text"], "s": w["s"], "e": w["e"], "line": w["line"], "heard": w.get("heard")} for w in words]}
    json.dump(tl, open(os.path.join(build, "timeline.json"), "w"), indent=1)
    print(f"{len(scenes)} scenes, {len(captions)} captions -> build/timeline.json, voice -> voice/voiceover.wav")
    for c in captions:
        print(f"    {c['s']:6.2f}-{c['e']:6.2f} {'LOUD ' if c['loud'] else '     '}{c['text']}")


if __name__ == "__main__":
    sys.exit(main())

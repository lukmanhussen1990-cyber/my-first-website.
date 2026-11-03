#!/usr/bin/env python3
"""Build scene/timeline.json (+ audio/voice_track.wav once the line files exist).

Each script line is its own audio file (audio/lines/Lxx.mp3). Lines are laid out
one after another with short pauses (1 s before/after "Silence."), and the pauses
are scaled so the reel lands at TARGET seconds (58-62 s allowed). Word/caption times
come from the ElevenLabs character alignment (Lxx.json) or, if a line was made
without timestamps, from tools/align_local.py output (Lxx_align.json). Without any
audio, timings are estimated so a silent preview can be rendered.
"""
import json
import re
import subprocess
import sys
import wave
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))
from voiceover import LINES  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
LD = ROOT / "audio" / "lines"
SR = 44100
FPS = 30
TARGET = 60.0
INTRO = 0.35
OUTRO = 2.6          # sooty boss blinking + fade after the last line
BASE_GAP = 0.18
# extra pause weight after each line (comic beats). "Silence." gets a fixed 1 s hold.
PAUSE_W = {"L01": 0.5, "L02": 0.6, "L03": 0.9, "L04": 0.5, "L05": 0.4, "L06": 0.3, "L07": 0.6,
           "L08": 0.4, "L09": 0.0, "L10": 0.6, "L11": 0.5, "L12": 0.5, "L13": 0.6, "L14": 0.8,
           "L15": 0.7, "L16": 0.8, "L17": 0.5, "L18": 0.4, "L19": 0.9, "L20": 0.6, "L21": 1.0,
           "L22": 0.6, "L23": 0.9, "L24": 0.6, "L25": 1.6, "L26": 0.7, "L27": 0.0}
FIXED = {"L08": 1.0, "L09": 1.0}   # 1-second pause around "Silence."
LOUD = {"L14", "L25"}              # BIG CAPS + screen shake
# hand-picked 2-3 word caption chunks for the fixed script ("|" = break)
BREAKS = {
    "L01": "It's your | first day | at your new job.", "L02": "New shirt. | New shoes. | New you.",
    "L03": "Last night, | you ate | extra spicy biryani.", "L04": "Your boss | walks in.",
    "L05": "Welcome | to the team!", "L06": "He hugs you. | Tight.", "L07": "Too tight.",
    "L08": "Then, | it happens.", "L09": "Silence.", "L10": "He stops. | He sniffs. | Once. | Twice.",
    "L11": "The whole office | stops typing.", "L12": "The printer | stops printing.",
    "L13": "The office plant | dies.", "L14": "YOU'RE FIRED!", "L15": "Security | walks you out.",
    "L16": "Your box | of things. | Your dignity. | Gone.", "L17": "You go home. | You change | your pants.",
    "L18": "Then you make | one phone call.", "L19": "Bro\u2026 | I need the tank.",
    "L20": "Nobody knows | where you got | a tank.", "L21": "Thirty minutes | later.",
    "L22": "Everyone | runs outside.", "L23": "The boss | comes out last. | With his coffee.",
    "L24": "Welcome | to the team.", "L25": "BOOM.", "L26": "Nobody | got hurt.",
    "L27": "But your boss\u2026 | never hugged | anyone again.",
}
FUNC = {"in", "your", "the", "a", "at", "with", "of", "to", "he", "you", "it", "but", "then", "new", "my", "his", "one", "no"}


def est_alignment(text):
    ch, st, en, t = [], [], [], 0.0
    for c in text:
        d = 0.056 if c.isalnum() else 0.3 if c in ".!?…" else 0.16 if c == "," else 0.05
        ch.append(c); st.append(t); en.append(t + d); t += d
    return {"characters": ch, "character_start_times_seconds": st, "character_end_times_seconds": en}, t + 0.15


def mp3_dur(p):
    out = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(p)],
                         capture_output=True, text=True).stdout
    return float(out.strip())


def load_line(lid, text):
    mp3 = LD / f"{lid}.mp3"
    for name in (f"{lid}.json", f"{lid}_align.json"):
        p = LD / name
        if mp3.exists() and p.exists():
            d = json.loads(p.read_text())
            al = d.get("alignment") or d.get("normalized_alignment")
            if al:
                return al, mp3_dur(mp3), True
    al, dur = est_alignment(text)
    return al, dur, False


def words_from(al, text):
    chars = al["characters"]; st = al["character_start_times_seconds"]; en = al["character_end_times_seconds"]
    joined = "".join(chars)
    out, pos = [], 0
    for w in text.split():
        j = joined.find(w, pos)
        if j < 0:
            j = pos
        idx = [k for k in range(j, min(len(chars), j + len(w))) if chars[k].isalnum() or chars[k] == "'"]
        if not idx:
            idx = [min(j, len(chars) - 1)]
        out.append({"w": w, "s": st[idx[0]], "e": en[idx[-1]]})
        pos = j + len(w)
    return out


def chunk(words):
    """2-3 words per caption, never across a sentence end."""
    sents, cur = [], []
    for w in words:
        cur.append(w)
        if re.search(r"[.!?…]$", w["w"]):
            sents.append(cur); cur = []
    if cur:
        sents.append(cur)
    res = []
    for s in sents:
        n = len(s)
        if n <= 3:
            res.append(s); continue
        best, bc = None, 1e9

        def parts(k):
            if k == 0:
                yield []; return
            for size in (2, 3):
                if size <= k:
                    for r in parts(k - size):
                        yield [size] + r
        for p in parts(n):
            c, i = 0.0, 0
            for size in p:
                last = re.sub(r"[^a-z']", "", s[i + size - 1]["w"].lower())
                if last in FUNC and i + size < n:
                    c += 3
                i += size
            c += 0.4 * len(p) - 0.01 * p[0]
            if c < bc:
                best, bc = p, c
        if best is None:  # n == 1 handled above; fallback
            best = [n]
        i = 0
        for size in best:
            res.append(s[i:i + size]); i += size
    return res


def main():
    lines = []
    real_all = True
    for lid, spk, text in LINES:
        al, dur, real = load_line(lid, text)
        real_all &= real
        ws = words_from(al, text)
        s0 = max(0.0, ws[0]["s"] - 0.05)
        e0 = min(dur, ws[-1]["e"] + 0.2)
        lines.append({"id": lid, "speaker": spk, "text": text, "words": ws, "cut_s": s0, "cut_e": e0, "real": real})

    speech = sum(l["cut_e"] - l["cut_s"] for l in lines)
    fixed = sum(FIXED.values())
    n_gaps = len(lines) - 1
    free = TARGET - INTRO - OUTRO - speech - fixed - BASE_GAP * n_gaps
    wsum = sum(PAUSE_W[l["id"]] for l in lines if l["id"] not in FIXED)
    k = max(0.0, free / wsum)
    if free < 0:
        print(f"WARNING: speech too long for {TARGET}s by {-free:.2f}s; pauses at minimum")
    cursor = INTRO
    for l in lines:
        shift = cursor - l["cut_s"]
        l["start"] = round(cursor, 3)
        l["end"] = round(cursor + l["cut_e"] - l["cut_s"], 3)
        for w in l["words"]:
            w["s"] = round(w["s"] + shift, 3); w["e"] = round(w["e"] + shift, 3)
        gap = FIXED.get(l["id"], BASE_GAP + k * PAUSE_W[l["id"]])
        cursor = l["end"] + gap
    total = round(lines[-1]["end"] + OUTRO, 3)

    caps = []
    for i, l in enumerate(lines):
        nxt = lines[i + 1]["start"] if i + 1 < len(lines) else total
        sizes = [len(p.split()) for p in BREAKS[l["id"]].split("|")]
        assert sum(sizes) == len(l["words"]), l["id"]
        ch, i0 = [], 0
        for n in sizes:
            ch.append(l["words"][i0:i0 + n]); i0 += n
        for j, c in enumerate(ch):
            s = c[0]["s"] - 0.04
            e = ch[j + 1][0]["s"] - 0.04 if j + 1 < len(ch) else min(c[-1]["e"] + 0.45, nxt - 0.06)
            text = re.sub(r"\.$", "", " ".join(w["w"] for w in c))
            loud = l["id"] in LOUD
            caps.append({"text": text.upper() if loud else text, "s": round(s, 3), "e": round(e, 3),
                         "loud": loud, "speaker": l["speaker"], "line": l["id"]})

    tl = {"fps": FPS, "duration": total, "mode": "elevenlabs" if real_all else "estimated",
          "pause_scale": round(k, 3), "lines": lines, "captions": caps}
    (ROOT / "scene" / "timeline.json").write_text(json.dumps(tl, indent=1))
    print(f"mode={tl['mode']} duration={total:.2f}s pause_scale={k:.2f} speech={speech:.2f}s")
    for l in lines:
        print(f"  {l['id']} {l['start']:6.2f}-{l['end']:6.2f} {l['speaker']:8s} {l['text']}")

    if real_all:
        n = int(SR * total)
        track = np.zeros(n + SR, np.float32)
        gains = {"NARRATOR": 1.0, "BOSS": 1.15, "YOU": 1.0}
        for l in lines:
            raw = subprocess.run(["ffmpeg", "-v", "error", "-i", str(LD / f"{l['id']}.mp3"), "-f", "s16le", "-ac", "1",
                                  "-ar", str(SR), "-"], check=True, capture_output=True).stdout
            x = np.frombuffer(raw, np.int16).astype(np.float32) / 32768
            x = x[int(l["cut_s"] * SR):int(l["cut_e"] * SR)].copy()
            rms = float(np.sqrt(np.mean(x[np.abs(x) > 0.01] ** 2)) + 1e-9)
            x *= (0.15 / rms) * gains[l["speaker"]]
            f = min(len(x) // 2, int(0.008 * SR)); r = np.linspace(0, 1, f, dtype=np.float32)
            x[:f] *= r; x[-f:] *= r[::-1]
            i = int(round(l["start"] * SR)); track[i:i + len(x)] += x
        track = track[:n]
        pk = float(np.max(np.abs(track)))
        if pk > 0.95:
            track *= 0.95 / pk
        with wave.open(str(ROOT / "audio" / "voice_track.wav"), "wb") as w:
            w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
            w.writeframes((np.clip(track, -1, 1) * 32767).astype(np.int16).tobytes())
        print("wrote audio/voice_track.wav")


if __name__ == "__main__":
    main()

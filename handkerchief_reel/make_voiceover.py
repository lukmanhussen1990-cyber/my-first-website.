"""Build the timed voiceover from the user's own recording (audio/voiceover_src.mp3).

1. Remove the generation glitches listed in script.json "source_cuts" (cuts are only made inside the
   digital silence between lines) -> audio/raw/user_take.wav
2. Word times of that take with speech-to-text (stt_words.py -> audio/raw/user_take.words.json)
3. Cut the take into the script lines at the real silences and set the pause before every line:
   the user's natural gap (evened out to 0.30-0.55 s), longer where script.json says "pause_before".
   A line with "audio": {"file": ...} is taken from that file instead (the missing "Welcome home.");
   with no file yet it is a silent placeholder of "placeholder_len" seconds.

Usage:  python3 make_voiceover.py
Writes  audio/voiceover.wav, audio/voiceover.mp3, audio/vo_lines.json, audio/voiceover.words.json
"""
import json
import os
import re
import subprocess
import sys

import numpy as np
import soundfile as sf

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "audio")
SR = 48000
SCRIPT = json.load(open(os.path.join(HERE, "script.json")))
LINES = SCRIPT["lines"]
LEAD_IN = 0.25
TAIL = 1.60
PRE = 0.035
POST = 0.09
GAP = tuple(SCRIPT["gaps"]["default"])
TAKE = os.path.join(HERE, SCRIPT["take"])


def load(path):
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-ac", "1", "-ar", str(SR),
                          "-f", "f32le", "-"], capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.float32).copy()


def level_db(a, hop=0.005, win=0.015):
    h, w = int(hop * SR), int(win * SR)
    n = (len(a) - w) // h + 1
    idx = np.arange(n)[:, None] * h + np.arange(w)[None, :]
    return 20 * np.log10(np.sqrt((a[idx] ** 2).mean(1)) + 1e-9), hop, win


def silences(a, thr_db=-55.0, min_len=0.10):
    d, hop, win = level_db(a)
    out, st = [], None
    for i, v in enumerate(d):
        if v < thr_db:
            if st is None:
                st = i
        else:
            if st is not None and (i - st) * hop >= min_len:
                out.append((st * hop, i * hop + win))
            st = None
    if st is not None:
        out.append((st * hop, len(a) / SR))
    return out


def speech_edges(a, thr_db=-55.0):
    d, hop, win = level_db(a)
    idx = np.where(d >= thr_db)[0]
    return idx[0] * hop, idx[-1] * hop + win


def norm(w):
    return re.sub(r"[^a-z0-9']", "", w.lower().replace("’", "'"))


def clean_take():
    a = load(os.path.join(HERE, "audio", "voiceover_src.mp3"))
    d, hop, win = level_db(a)
    keep = np.ones(len(a), bool)
    for c0, c1 in SCRIPT["source_cuts"]["cuts"]:
        i0, i1 = int(c0 * SR), min(len(a), int(c1 * SR))
        # a cut edge must sit in silence (never inside a word)
        for edge in (c0, min(c1, len(a) / SR - 0.01)):
            k = int(edge / hop)
            if k < len(d) and d[max(0, k - 2):k + 3].max() > -60:
                sys.exit(f"cut edge {edge:.2f}s is not in silence ({d[k]:.1f} dB)")
        keep[i0:i1] = False
    y = a[keep]
    os.makedirs(os.path.dirname(TAKE), exist_ok=True)
    sf.write(TAKE, y, SR, subtype="PCM_24")
    return y


def split_lines(a, words, texts):
    sil = silences(a)
    counts = [len(t.split()) for t in texts]
    assert sum(counts) == len(words), f"script has {sum(counts)} words, take has {len(words)}"
    for w, s in zip(words, " ".join(texts).split()):
        if norm(w["w"]) != norm(s):
            print(f"  note: STT heard '{w['w']}' for '{s}'")
    first = np.cumsum([0] + counts[:-1])
    last = np.cumsum(counts) - 1
    bounds = []
    for i in range(len(texts) - 1):
        we, nx = words[last[i]], words[first[i + 1]]
        guess = (we["e"] + nx["s"]) / 2
        lo, hi = we["s"], nx["e"]
        cand = [s for s in sil if s[1] > lo and s[0] < hi]
        if not cand:
            # lines spoken almost without a break: cut at the quietest 40 ms from the start of the last word
            # to the end of the next one (STT word edges are often off by 0.1-0.2 s, so search wide)
            d, hop, win = level_db(a)
            k0, k1 = int(we["s"] / hop), int(nx["e"] / hop) + 1
            n = max(1, int(0.04 / hop))
            sm = np.convolve(d[k0:k1], np.ones(n) / n, mode="valid")
            k = k0 + int(np.argmin(sm)) + n // 2
            print(f"  note: no clear silence between line {i + 1} and {i + 2}; cut at {k * hop:.3f}s ({d[k]:.0f} dB)")
            cand = [(k * hop, k * hop)]
        bounds.append(min(cand, key=lambda s: abs((s[0] + s[1]) / 2 - guess)))
    s0, e0 = speech_edges(a)
    spans = [(s0 if i == 0 else bounds[i - 1][1], e0 if i == len(texts) - 1 else bounds[i][0])
             for i in range(len(texts))]
    joined = [b[0] == b[1] for b in bounds] + [False]
    return spans, joined


def main():
    a = clean_take()
    wj = os.path.splitext(TAKE)[0] + ".words.json"
    if not os.path.exists(wj) or os.environ.get("RESTT"):
        subprocess.run([sys.executable, "-I", os.path.join(HERE, "stt_words.py"), TAKE], check=True,
                       env=dict(os.environ, WHISPER_MODEL="small.en", HINT="1"))
    words = []
    for w in json.load(open(wj)):
        # STT sometimes splits a word at its apostrophe ("Ma" + "'am...") -> glue it back
        if words and w["w"].startswith(("'", "’")):
            words[-1] = dict(words[-1], w=words[-1]["w"] + w["w"], e=w["e"])
        else:
            words.append(w)
    in_take = [l for l in LINES if "audio" not in l]
    texts = [l["text"] for l in in_take]
    spans, joined = split_lines(a, words, texts)
    counts = [len(t.split()) for t in texts]
    first = np.cumsum([0] + counts[:-1])

    # clips: one per line, except lines spoken without any break stay together in one clip
    clips = []
    ti = 0
    pending = None
    for l in LINES:
        if "audio" in l:
            f = l["audio"].get("file")
            n = len(l["text"].split())
            if f:
                c = load(os.path.join(HERE, f))
                s0, e0 = speech_edges(c)
                c = c[int(max(0, s0 - PRE) * SR):int((e0 + POST) * SR)].copy()
                L = e0 - s0
            else:
                L = l["audio"]["placeholder_len"]
                c = np.zeros(int((L + PRE + POST) * SR), np.float32)
            lw = [{"s": PRE + L * k / n, "e": PRE + L * (k + 1) / n - 0.04} for k in range(n)]
            clips.append({"lines": [(l, PRE, PRE + L, lw)], "audio": c, "speech": (PRE, PRE + L),
                          "nat": None, "placeholder": not f})
            continue
        st, en = spans[ti]
        lw = words[first[ti]:first[ti] + counts[ti]]
        if pending is None:
            pending = {"items": [], "st": st}
        pending["items"].append((l, st, en, lw))
        if not joined[ti]:
            g0, g1 = pending["st"], en
            i0, i1 = int(max(0, g0 - PRE) * SR), int(min(len(a) / SR, g1 + POST) * SR)
            c = a[i0:i1].copy()
            fi, fo = int(0.004 * SR), int(0.03 * SR)
            c[:fi] *= np.linspace(0, 1, fi)
            c[-fo:] *= np.linspace(1, 0, fo)
            cut0 = i0 / SR
            items = [(it[0], it[1] - cut0, it[2] - cut0,
                      [{"s": w["s"] - cut0, "e": w["e"] - cut0} for w in it[3]]) for it in pending["items"]]
            clips.append({"lines": items, "audio": c, "speech": (g0 - cut0, g1 - cut0), "nat": (g0, g1)})
            pending = None
        ti += 1

    out = [np.zeros(int(LEAD_IN * SR), np.float32)]
    t = LEAD_IN
    meta, all_words = [], []
    for i, c in enumerate(clips):
        if i > 0:
            prev = clips[i - 1]
            want = c["lines"][0][0].get("pause_before")
            if want is None:
                if c["nat"] and prev["nat"]:
                    want = float(np.clip(c["nat"][0] - prev["nat"][1], *GAP))
                else:
                    want = GAP[1]
            pad = want - (len(prev["audio"]) / SR - prev["speech"][1]) - c["speech"][0]
            n = max(0, int(round(pad * SR)))
            out.append(np.zeros(n, np.float32))
            t += n / SR
        for (l, ls, le, lw) in c["lines"]:
            s, e = t + ls, t + le
            m = {"i": len(meta) + 1, "text": l["text"], "start": round(s, 3), "end": round(e, 3)}
            if c.get("placeholder"):
                m["placeholder"] = True
            meta.append(m)
            for sw, w in zip(l["text"].split(), lw):
                ws = min(max(t + w["s"], s), e)
                we = min(max(t + w["e"], ws + 0.05), e)
                all_words.append({"w": sw, "s": round(ws, 3), "e": round(we, 3), "line": m["i"]})
        out.append(c["audio"].astype(np.float32))
        t += len(c["audio"]) / SR
    out.append(np.zeros(int(TAIL * SR), np.float32))
    y = np.concatenate(out)
    y *= 10 ** (-1.0 / 20) / max(1e-6, np.abs(y).max())
    wav = os.path.join(OUT, "voiceover.wav")
    sf.write(wav, y, SR, subtype="PCM_24")
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", wav, "-ac", "1", "-b:a", "192k",
                    os.path.join(OUT, "voiceover.mp3")], check=True)
    json.dump({"source": "user upload" + (", glitches cut" if SCRIPT["source_cuts"]["cuts"] else ""), "duration": round(len(y) / SR, 3), "lines": meta},
              open(os.path.join(OUT, "vo_lines.json"), "w"), indent=1)
    json.dump(all_words, open(os.path.join(OUT, "voiceover.words.json"), "w"), indent=0)
    for m in meta:
        print(f"{m['i']:2d} {m['start']:6.2f}-{m['end']:6.2f}  {m['text']}{'   (PLACEHOLDER)' if m.get('placeholder') else ''}")
    print(f"total {len(y) / SR:.2f}s")


if __name__ == "__main__":
    main()

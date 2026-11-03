#!/usr/bin/env python3
"""Build build/timeline.json from script.json + the voice manifest.

Real voice manifest: audio/lines.json  (one entry per line, written once by voice.py)
Fallback:            build/placeholder_lines.json (estimated timings, no audio)

Each manifest entry: {id, speaker, text, file, duration, words:[{word,start,end}]}
with word times relative to the start of that line's audio file.

Fitting the total to ~60 s (58-62 allowed) WITHOUT regenerating audio:
  too short -> extra hold time goes to the "stretch" beats (slow zooms)
  too long  -> 1) shrink pauses between lines (never the 1 s "Silence." beat)
               2) shorten long pauses inside a line (cut in the silence)
               3) last resort: speed the voice up slightly (atempo <= 1.12)
"""
import json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
TARGET = 60.0
LO, HI = 58.3, 61.7
PREROLL = 0.25
MIN_GAP = 0.15
MIN_TAIL = 1.4
PHRASE_SPLIT = 0.12   # word gaps longer than this are cut points inside a line
FPS = 30


def load(p):
    with open(p) as f:
        return json.load(f)


def est_word_dur(w):
    letters = len(re.sub(r"[^A-Za-z]", "", w))
    return 0.085 + 0.052 * letters


def placeholder(script):
    """Rough stand-in timings (~2.7 words/s) used before the real voice exists."""
    out = []
    for ln in script["lines"]:
        t = 0.08
        words = []
        for w in ln["text"].split():
            d = est_word_dur(w)
            words.append({"word": w, "start": round(t, 3), "end": round(t + d, 3)})
            t += d + 0.03
            if w[-1] in ".!?":
                t += 0.30
            elif w[-1] == ",":
                t += 0.14
        out.append({"id": ln["id"], "speaker": ln["speaker"], "text": ln["text"],
                    "file": None, "duration": round(words[-1]["end"] + 0.15, 3), "words": words})
    return out


def layout(script, manifest, atempo, gaps, cap):
    """Place every line; returns (lines, total). cap = max pause kept inside a line."""
    t = PREROLL
    lines = []
    for ln, m, gap in zip(script["lines"], manifest, gaps):
        W = m["words"]
        dur = float(m.get("duration") or (W[-1]["end"] + 0.15))
        # phrases: split where the original gap between words is long
        groups = [[0]]
        for k in range(1, len(W)):
            # only cut inside a line where a pause actually gets shortened (keeps every word tail intact)
            if W[k]["start"] - W[k - 1]["end"] > max(PHRASE_SPLIT, cap):
                groups.append([k])
            else:
                groups[-1].append(k)
        out_words = [None] * len(W)
        clips = []
        cur = t  # output time of first word start
        for gi, g in enumerate(groups):
            a, b = g[0], g[-1]
            base_src = W[a]["start"]
            for k in g:
                out_words[k] = {"w": W[k]["word"],
                                "s": round(cur + (W[k]["start"] - base_src) / atempo, 3),
                                "e": round(cur + (W[k]["end"] - base_src) / atempo, 3)}
            orig_before = W[a]["start"] - (W[a - 1]["end"] if a > 0 else 0.0)
            orig_after = (W[b + 1]["start"] - W[b]["end"]) if b + 1 < len(W) else (dur - W[b]["end"])
            new_after = min(orig_after, cap) if b + 1 < len(W) else orig_after
            padL = min(0.06, orig_before / 2 if a > 0 else W[a]["start"])
            padR = min(0.09, orig_after / 2, new_after / 2) if b + 1 < len(W) else min(0.2, orig_after)
            src_s = W[a]["start"] - padL
            src_e = W[b]["end"] + padR
            clips.append({"src_s": round(src_s, 4), "src_e": round(src_e, 4),
                          "at": round(cur - padL / atempo, 4)})
            end_out = cur + (W[b]["end"] - base_src) / atempo
            if b + 1 < len(W):
                cur = end_out + new_after / atempo
        s = out_words[0]["s"]
        e = out_words[-1]["e"]
        lines.append({"id": ln["id"], "speaker": ln["speaker"], "text": ln["text"],
                      "s": round(s, 3), "e": round(e, 3), "file": m.get("file"),
                      "clips": clips, "words": out_words})
        t = e + gap
    return lines, t


def fit(script, manifest):
    base = [float(l.get("gap", 0.35)) for l in script["lines"]]
    stretch = [float(l.get("stretch", 0)) for l in script["lines"]]
    fixed = [bool(l.get("fixed_gap")) for l in script["lines"]]
    n = len(base)
    atempo, cap = 1.0, 9.0
    gaps = list(base)
    lines, total = layout(script, manifest, atempo, gaps, cap)
    steps = []
    if total < TARGET:
        diff = TARGET - total
        ws = sum(stretch)
        gaps = [g + diff * s / ws for g, s in zip(base, stretch)]
        steps.append(f"stretched beats by {diff:.2f}s")
    elif total > HI:
        # 1) shrink inter-line pauses
        mins = [float(l.get("min_gap", MIN_GAP)) for l in script["lines"]]
        floor = [g if fx else (MIN_TAIL if i == n - 1 else min(g, mins[i])) for i, (g, fx) in enumerate(zip(base, fixed))]
        avail = sum(g - f for g, f in zip(base, floor))
        need = total - TARGET
        take = min(need, avail)
        if avail > 0:
            gaps = [g - take * (g - f) / avail for g, f in zip(base, floor)]
        steps.append(f"shrunk pauses by {take:.2f}s")
        lines, total = layout(script, manifest, atempo, gaps, cap)
        # 2) shorten long pauses inside lines
        if total > HI:
            for c in [0.4, 0.32, 0.26, 0.22, 0.18]:
                cap = c
                lines, total = layout(script, manifest, atempo, gaps, cap)
                if total <= TARGET + 0.5:
                    break
            steps.append(f"capped in-line pauses at {cap:.2f}s")
        # 3) speed up slightly
        if total > HI:
            for a in [1.02, 1.04, 1.06, 1.08, 1.10, 1.12]:
                atempo = a
                lines, total = layout(script, manifest, atempo, gaps, cap)
                if total <= TARGET + 0.8:
                    break
            steps.append(f"atempo {atempo:.2f}")
    lines, total = layout(script, manifest, atempo, gaps, cap)
    return lines, total, atempo, gaps, cap, steps


def captions(script, lines):
    caps = []
    for i, (ln, L) in enumerate(zip(script["lines"], lines)):
        words = L["words"]
        k = 0
        chunks = []
        for ch in ln["chunks"]:
            nw = len(ch.split())
            ws = words[k:k + nw]
            assert [w["w"] for w in ws] == ch.split(), (ln["id"], ch, [w["w"] for w in ws])
            chunks.append({"text": ch, "s": ws[0]["s"], "line": ln["id"], "speaker": ln["speaker"]})
            k += nw
        assert k == len(words), ln["id"]
        nxt = lines[i + 1]["s"] if i + 1 < len(lines) else L["e"] + 3
        for j, c in enumerate(chunks):
            if j + 1 < len(chunks):
                c["e"] = round(chunks[j + 1]["s"] - 0.03, 3)
            else:
                c["e"] = round(min(L["e"] + 0.35, nxt - 0.08), 3)
        for c in chunks:
            c["s"] = round(max(0.0, c["s"] - 0.03), 3)  # pop in a hair before the word
            caps.append(c)
    return caps


def main():
    script = load(os.path.join(HERE, "script.json"))
    real = os.path.join(HERE, "audio", "lines.json")
    if os.path.exists(real):
        manifest = load(real)
        source = "audio/lines.json"
    else:
        manifest = placeholder(script)
        os.makedirs(os.path.join(HERE, "build"), exist_ok=True)
        with open(os.path.join(HERE, "build", "placeholder_lines.json"), "w") as f:
            json.dump(manifest, f, indent=1)
        source = "placeholder"
    byid = {m["id"]: m for m in manifest}
    manifest = [byid[l["id"]] for l in script["lines"]]

    lines, total, atempo, gaps, cap, steps = fit(script, manifest)
    total = round(round(total * FPS) / FPS, 4)
    L = {l["id"]: l for l in lines}

    def word_s(lid, k):
        return L[lid]["words"][k]["s"]

    sfx = [
        {"name": "door_creak", "t": round(L["05"]["s"] + 0.05, 3), "gain_db": -16},
        {"name": "stomach_growl", "t": round(L["12"]["s"] - 0.05, 3), "gain_db": -12},
        {"name": "record_scratch", "t": round(L["17"]["s"] - 0.62, 3), "gain_db": -15},
        {"name": "pen_scribble", "t": round(word_s("22", 2), 3), "gain_db": -18},
        {"name": "door_slam", "t": round(L["24"]["s"] - 0.62, 3), "gain_db": -12},
    ]
    tl = {
        "fps": FPS,
        "duration": total,
        "frames": int(round(total * FPS)),
        "atempo": atempo,
        "inline_pause_cap": cap,
        "fit_steps": steps,
        "source": source,
        "lines": lines,
        "gaps": [round(g, 3) for g in gaps],
        "captions": captions(script, lines),
        "sfx": sfx,
    }
    with open(os.path.join(HERE, "build", "timeline.json"), "w") as f:
        json.dump(tl, f, indent=1)
    speech = sum(l["e"] - l["s"] for l in lines)
    print(f"timeline: source={source} duration={total:.2f}s speech={speech:.2f}s "
          f"atempo={atempo:.2f} steps={steps}")
    if not (LO <= total <= HI):
        print("WARNING: duration outside the 58-62 s window", file=sys.stderr)
        sys.exit(2)


if __name__ == "__main__":
    main()

"""Shared voiceover helpers: decoding, silence detection, pause capping, trimming,
script tokenising and the per-scene index the player reads."""
import glob, json, os, re, subprocess
import numpy as np

SR = 48000
HOP = int(SR * 0.005)  # 5 ms analysis hop


def decode(path, sr=SR):
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-ac", "1", "-ar", str(sr), "-f", "f32le", "-"],
                         capture_output=True, check=True).stdout
    return np.frombuffer(raw, dtype=np.float32).copy()


def frame_db(x, hop=HOP):
    n = max(1, len(x) // hop)
    fr = x[: n * hop].reshape(n, hop)
    return 20 * np.log10(np.sqrt((fr ** 2).mean(1)) + 1e-9)


def silent_mask(x, rel_db=42.0, floor_db=-58.0):
    db = frame_db(x)
    thr = max(floor_db, np.percentile(db, 99) - rel_db)
    m = db < thr
    # close tiny voiced blips (< 20 ms) inside silence and tiny gaps in speech (< 30 ms)
    return m


def runs(mask):
    """[(start_frame, end_frame)] of True runs."""
    out, s = [], None
    for i, v in enumerate(mask):
        if v and s is None:
            s = i
        elif not v and s is not None:
            out.append((s, i)); s = None
    if s is not None:
        out.append((s, len(mask)))
    return out


def cap_pauses(x, words, max_pause=0.40, keep=0.38, min_len=0.06):
    """Shorten every internal silence longer than max_pause down to `keep` seconds.
    Cuts from the middle of the silence; speech is never touched. Word times shift."""
    m = silent_mask(x)
    rr = [(a, b) for a, b in runs(m) if (b - a) * HOP / SR >= min_len]
    if not rr:
        return x, words
    first_voiced = np.argmax(~m) if (~m).any() else 0
    last_voiced = len(m) - np.argmax((~m)[::-1]) if (~m).any() else len(m)
    pieces, cursor, shifts, total = [], 0, [], 0.0
    for a, b in rr:
        if a <= first_voiced or b >= last_voiced:
            continue  # leading/trailing silence handled by trim()
        dur = (b - a) * HOP / SR
        if dur <= max_pause:
            continue
        cut = int((dur - keep) * SR)
        mid = (a + b) // 2 * HOP
        s0, s1 = mid - cut // 2, mid + (cut - cut // 2)
        pieces.append(x[cursor:s0]); cursor = s1
        total -= cut / SR
        shifts.append((s1 / SR, total, s0 / SR))
    pieces.append(x[cursor:])
    y = np.concatenate(pieces)

    def mp(t):
        sh = 0.0
        for after, tot, cut_start in shifts:
            if t >= after:
                sh = tot
            elif t > cut_start:  # inside a removed region -> clamp to the cut point
                return cut_start + sh
        return t + sh

    w2 = [{**w, "s": mp(w["s"]), "e": mp(w["e"])} for w in words]
    return y, w2


def trim(y, words, lead=0.04, tail=0.12):
    m = silent_mask(y)
    voiced = np.nonzero(~m)[0]
    if len(voiced) == 0:
        return y, words
    s = max(0, voiced[0] * HOP - int(lead * SR))
    e = min(len(y), (voiced[-1] + 1) * HOP + int(tail * SR))
    off = s / SR
    y = y[s:e].copy()
    d = len(y) / SR
    words = [{**w, "s": min(d, max(0.0, w["s"] - off)), "e": min(d, max(0.0, w["e"] - off))} for w in words]
    f = int(0.006 * SR)
    y[:f] *= np.linspace(0, 1, f)
    y[-f:] *= np.linspace(1, 0, f)
    return y, words


def script_tokens(text):
    """Words of a script line with the punctuation that follows each word."""
    toks = []
    for m in re.finditer(r"([^\s.,?!।…—]+)\s*((?:\.\.\.|…|[.,?!।—])*)", text):
        if m.group(1).strip():
            toks.append({"w": m.group(1), "p": m.group(2)})
    return toks


def norm(s):
    s = s.lower()
    s = s.replace("़", "").replace("ँ", "ं")
    s = re.sub(r"[\s.,?!।…—\"'’“”\-]", "", s)
    return s


def write_index(out_dir):
    idx = {}
    for f in sorted(glob.glob(os.path.join(out_dir, "S*.json"))):
        m = json.load(open(f, encoding="utf-8"))
        idx[m["id"]] = {"duration": m["duration"], "words": [{"w": w["w"], "s": round(w["s"], 3), "e": round(w["e"], 3)} for w in m["words"]]}
    json.dump(idx, open(os.path.join(out_dir, "index.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    return idx

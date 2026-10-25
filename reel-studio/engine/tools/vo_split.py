#!/usr/bin/env python3
"""Split long voiceover takes (e.g. ElevenLabs parts) into one clip per scene.

Each part file holds several consecutive scenes. The part is transcribed with
faster-whisper (word timestamps), the transcript is aligned to the script
words, and each scene boundary is cut in the middle of the silence between the
last word of one scene and the first word of the next. Long pauses are then
capped (speech is never sped up), edges trimmed, and word timings saved.

Usage:
  python3 vo_split.py vo_script.json OUT_DIR --part FILE:S01,S02,S03 --part FILE:S04,... \
         [--transcripts DIR] [--model large-v3-turbo] [--models-dir DIR] [--max-pause 0.40]
"""
import argparse, json, os, sys, subprocess
import numpy as np
import soundfile as sf

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from vo_common import SR, HOP, decode, silent_mask, runs, cap_pauses, trim, script_tokens, norm, write_index


def speech_chunks(x, min_sil=0.28, max_len=12.0):
    """Split a take at its pauses into chunks (start, end) in seconds, each <= max_len.
    Whisper drops words on long single passes; short chunks keep it accurate."""
    mask = silent_mask(x)
    sil = [(a * HOP / SR, b * HOP / SR) for a, b in runs(mask) if (b - a) * HOP / SR >= min_sil]
    total = len(x) / SR
    cuts = [0.0]
    pending = [(a + b) / 2 for a, b in sil if 0.3 < (a + b) / 2 < total - 0.3]
    last = 0.0
    for i, c in enumerate(pending):
        nxt = pending[i + 1] if i + 1 < len(pending) else total
        if nxt - last > max_len:
            cuts.append(c); last = c
    cuts.append(total)
    # merge very short chunks into their neighbour
    out = []
    for a, b in zip(cuts, cuts[1:]):
        if out and b - a < 1.0:
            out[-1] = (out[-1][0], b)
        else:
            out.append((a, b))
    return out


def transcribe(path, out_json, model, models_dir):
    if os.path.exists(out_json):
        return json.load(open(out_json, encoding="utf-8"))
    from faster_whisper import WhisperModel
    x48 = decode(path)
    x = decode(path, 16000)
    m = WhisperModel(model, device="cpu", compute_type="int8", download_root=models_dir)
    res = {"segments": []}
    for c0, c1 in speech_chunks(x48):
        chunk = x[int(c0 * 16000):int(c1 * 16000)]
        segs, info = m.transcribe(chunk, language="hi", word_timestamps=True, beam_size=5,
                                  condition_on_previous_text=False, vad_filter=False)
        for s in segs:
            res["segments"].append({"start": s.start + c0, "end": s.end + c0, "text": s.text,
                                    "words": [{"w": w.word, "s": w.start + c0, "e": w.end + c0} for w in (s.words or [])]})
    json.dump(res, open(out_json, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    return res


def bigrams(s):
    return {s[i:i + 2] for i in range(len(s) - 1)} or {s}


def sim(a, b):
    a, b = norm(a), norm(b)
    if not a or not b:
        return 0.0
    if a == b:
        return 1.0
    A, B = bigrams(a), bigrams(b)
    return 2 * len(A & B) / (len(A) + len(B))


def align(script, heard):
    """Needleman-Wunsch: returns list of heard-index (or None) per script token."""
    n, m = len(script), len(heard)
    GAP = -0.35
    S = np.zeros((n + 1, m + 1)); T = np.zeros((n + 1, m + 1), dtype=np.int8)
    S[1:, 0] = GAP * np.arange(1, n + 1); S[0, 1:] = GAP * np.arange(1, m + 1)
    T[1:, 0] = 1; T[0, 1:] = 2
    for i in range(1, n + 1):
        for j in range(1, m + 1):
            d = S[i - 1, j - 1] + (sim(script[i - 1]["w"], heard[j - 1]["w"]) * 2 - 0.8)
            u = S[i - 1, j] + GAP
            l = S[i, j - 1] + GAP
            best = max(d, u, l)
            S[i, j] = best
            T[i, j] = 0 if best == d else (1 if best == u else 2)
    i, j, out = n, m, [None] * n
    while i > 0 and j > 0:
        if T[i, j] == 0:
            if sim(script[i - 1]["w"], heard[j - 1]["w"]) >= 0.3:
                out[i - 1] = j - 1
            i, j = i - 1, j - 1
        elif T[i, j] == 1:
            i -= 1
        else:
            j -= 1
    return out


def fill_times(script, heard, amap, total):
    """Give every script token a start/end; unmatched ones interpolate by length."""
    n = len(script)
    st = [None] * n; en = [None] * n
    for i, j in enumerate(amap):
        if j is not None:
            st[i], en[i] = heard[j]["s"], heard[j]["e"]
    # interpolate gaps
    i = 0
    while i < n:
        if st[i] is not None:
            i += 1; continue
        k = i
        while k < n and st[k] is None:
            k += 1
        t0 = en[i - 1] if i > 0 else 0.0
        t1 = st[k] if k < n else total
        lens = [max(1, len(norm(script[q]["w"]))) for q in range(i, k)]
        tot = sum(lens); acc = 0
        for q, L in zip(range(i, k), lens):
            st[q] = t0 + (t1 - t0) * acc / tot
            acc += L
            en[q] = t0 + (t1 - t0) * acc / tot
        i = k
    return [{"w": script[q]["w"], "p": script[q]["p"], "s": float(st[q]), "e": float(en[q]), "sid": script[q]["sid"],
             "matched": amap[q] is not None} for q in range(n)]


def best_silence(mask, t0, t1):
    a, b = int(max(0, t0) * SR / HOP), int(t1 * SR / HOP)
    best = None
    for s, e in runs(mask[a:b]):
        if best is None or (e - s) > (best[1] - best[0]):
            best = (s + a, e + a)
    return best


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("script"); ap.add_argument("out")
    ap.add_argument("--part", action="append", required=True, help="FILE:S01,S02,...")
    ap.add_argument("--transcripts", default=None)
    ap.add_argument("--model", default="large-v3-turbo")
    ap.add_argument("--models-dir", default=None)
    ap.add_argument("--max-pause", type=float, default=0.40)
    ap.add_argument("--keep-pause", type=float, default=0.36)
    a = ap.parse_args()
    js = json.load(open(a.script, encoding="utf-8"))
    lines = {s["id"]: s["vo"] for s in js["scenes"]}
    os.makedirs(a.out, exist_ok=True)
    tdir = a.transcripts or os.path.join(a.out, "transcripts"); os.makedirs(tdir, exist_ok=True)
    report = []
    for spec in a.part:
        path, ids = spec.rsplit(":", 1)
        ids = ids.split(",")
        x = decode(path)
        total = len(x) / SR
        tr = transcribe(path, os.path.join(tdir, os.path.splitext(os.path.basename(path))[0] + ".json"), a.model, a.models_dir)
        heard = [w for s in tr["segments"] for w in s["words"] if norm(w["w"])]
        script = []
        for sid in ids:
            for t in script_tokens(lines[sid]):
                script.append({**t, "sid": sid})
        amap = align(script, heard)
        toks = fill_times(script, heard, amap, total)
        mask = silent_mask(x)
        # scene cut points
        cuts = [0.0]
        for k in range(len(ids) - 1):
            last = [t for t in toks if t["sid"] == ids[k]][-1]
            first = [t for t in toks if t["sid"] == ids[k + 1]][0]
            lo, hi = last["s"] + 0.12, max(last["s"] + 0.2, first["e"] - 0.08)
            sil = best_silence(mask, lo, hi)
            if sil and (sil[1] - sil[0]) * HOP / SR >= 0.05:
                cut = (sil[0] + sil[1]) / 2 * HOP / SR
            else:
                cut = (last["e"] + first["s"]) / 2
                report.append(f"  ! {ids[k]}|{ids[k+1]}: no clear silence, cut at {cut:.2f}s")
            cuts.append(cut)
        cuts.append(total)
        for k, sid in enumerate(ids):
            c0, c1 = cuts[k], cuts[k + 1]
            seg = x[int(c0 * SR):int(c1 * SR)].copy()
            words = [{"w": t["w"], "p": t["p"], "s": t["s"] - c0, "e": t["e"] - c0, "matched": t["matched"]} for t in toks if t["sid"] == sid]
            raw_d = len(seg) / SR
            seg, words = cap_pauses(seg, words, a.max_pause, a.keep_pause)
            seg, words = trim(seg, words)
            sf.write(os.path.join(a.out, f"{sid}.wav"), seg, SR, subtype="PCM_24")
            meta = {"id": sid, "text": lines[sid], "duration": len(seg) / SR, "source": os.path.basename(path),
                    "cut": [c0, c1], "words": words}
            json.dump(meta, open(os.path.join(a.out, f"{sid}.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
            matched = sum(1 for w in words if w["matched"])
            report.append(f"{sid}: {raw_d:5.2f}s -> {len(seg)/SR:5.2f}s  words matched {matched}/{len(words)}")
    idx = write_index(a.out)
    print("\n".join(report))
    print(f"TOTAL {sum(v['duration'] for v in idx.values()):.2f}s over {len(idx)} scenes")


if __name__ == "__main__":
    main()

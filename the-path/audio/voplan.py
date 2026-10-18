"""Edit planning for the VO take: which pauses change, and where every word lands.

The rules come from the brief (section 10) and brief/timeline.json "vo.edit_rules":
  * a segment's first word lands on its anchor frame (sound starts at frame * 800);
  * inside a segment only the take's own pauses (>= 80 ms between words) may change,
    never the speech;
  * a pause may shrink to 45 % of its natural length but not below what its
    punctuation needs (comma 0.12 s, ellipsis 0.30 s) and may grow to 160 %;
  * a segment ends before its limit: the brief's must-end-before time, or the next
    anchor minus a sentence gap (0.25 s after a full stop, 0.12 s after a comma);
  * a segment that is too long shrinks all its cuttable pauses by one common factor;
  * segment 6 moves its course words (math, music, chess) as close to the brief's
    times as those pause limits allow (least squares on a 2.5 ms grid);
  * changes under 10 ms are not made.
"""

from __future__ import annotations

import numpy as np

FPS = 60
SPF = 800  # samples per frame at 48 kHz

SHRINK_MIN = 0.45
GROW_MAX = 1.60
MIN_PAUSE = 0.08
MIN_CHANGE = 0.010  # pause changes smaller than this are not made
PUNCT_MIN = {",": 0.12, "...": 0.30, ".": 0.25, "": 0.08}
GAP_AFTER = {".": 0.25, ",": 0.12}


def punct(text: str) -> str:
    if text.endswith("..."):
        return "..."
    return text[-1] if text[-1] in ",." else ""


def anchor_frame(t: float) -> int:
    return int(round(t * FPS + 1e-9))


def segment_words(words, tl):
    """Split the measured words into the brief's segments (the transcript matches the script)."""
    out, i = [], 0
    for seg in tl["vo"]["segments"]:
        n = len(seg["text"].split())
        out.append(words[i:i + n])
        i += n
    assert i == len(words), "transcript does not match the script word count"
    return out


def inner_pauses(ws, min_len=MIN_PAUSE):
    """(index in segment, natural length, punctuation) of each cuttable pause inside a segment."""
    return [(j, w.pause_before, punct(ws[j - 1].text)) for j, w in enumerate(ws) if j and w.pause_before >= min_len]


def limits(p: float, c: str):
    return max(SHRINK_MIN * p, min(p, PUNCT_MIN[c])), GROW_MAX * p


def shrink_to(pauses, total_cut):
    """Common factor k in [SHRINK_MIN, 1] for all inner pauses (each clamped to its
    punctuation minimum) that removes total_cut seconds.  None if impossible."""
    def removed(k):
        return sum(p - max(k * p, limits(p, c)[0]) for _, p, c in pauses)
    if removed(SHRINK_MIN) + 1e-9 < total_cut:
        return None
    lo, hi = SHRINK_MIN, 1.0
    for _ in range(60):
        mid = (lo + hi) / 2
        lo, hi = (mid, hi) if removed(mid) > total_cut else (lo, mid)
    return lo


def end_limit(tl, n):
    segs = tl["vo"]["segments"]
    seg = segs[n - 1]
    lim = seg["must_end_before_t"]
    if n < len(segs):
        lim = min(lim, segs[n]["anchor_t"] - GAP_AFTER.get(punct(seg["text"]), 0.12))
    return lim


def anchor_t(tl, n):
    """The anchor as placed: frame-quantized (the sound starts at frame * 800)."""
    return anchor_frame(tl["vo"]["segments"][n - 1]["anchor_t"]) / FPS


def fit(ws, tl, n):
    natural = ws[-1].end - ws[0].onset
    window = end_limit(tl, n) - anchor_t(tl, n)
    pauses = inner_pauses(ws)
    need = natural - window
    k = 1.0 if need <= 0 else shrink_to(pauses, need)
    return {
        "n": n, "natural_s": round(natural, 3), "window_s": round(window, 3),
        "end_limit_t": round(end_limit(tl, n), 3), "over_s": round(max(need, 0.0), 3),
        "inner_pauses": [{"after": ws[j - 1].text, "len_s": round(p, 3), "punct": c} for j, p, c in pauses],
        "pause_factor": None if k is None else round(k, 3),
        "fits": "natural" if need <= 0 else ("pause trims" if k is not None else "NO"),
    }


def course_word_solve(ws, tl, grid=0.0025):
    """Segment 6: new lengths for its cuttable pauses that bring the course words as
    close as possible to the brief's times.  Returns ({word index: new pause}, report)."""
    targets = tl["vo"]["segments"][5]["inner_words"]
    key = {w.text.strip(",.").lower(): j for j, w in enumerate(ws)}
    idx = {name: key[name] for name in targets}
    base = ws[0].onset
    a = anchor_t(tl, 6)
    adj = {j: (p, *limits(p, c)) for j, p, c in inner_pauses(ws)}

    def onsets(delta):
        return {name: a + ws[j].onset - base + sum(d for jj, d in delta.items() if jj <= j) for name, j in idx.items()}

    keys = sorted(adj)
    grids = [np.arange(lo - p, hi - p + 1e-9, grid) for p, lo, hi in (adj[k] for k in keys)]
    best = None
    for combo in np.array(np.meshgrid(*grids, indexing="ij")).reshape(len(keys), -1).T:
        delta = dict(zip(keys, (float(v) for v in combo)))
        o = onsets(delta)
        err = sum((o[k] - targets[k]) ** 2 for k in targets) + 1e-4 * float(np.abs(combo).sum())
        if best is None or err < best[0]:
            best = (err, delta, o)
    _, delta, o = best
    report = {
        "targets": targets,
        "natural_onsets": {k: round(v, 3) for k, v in onsets({}).items()},
        "best_onsets": {k: round(v, 3) for k, v in o.items()},
        "best_error_ms": {k: round((o[k] - targets[k]) * 1000) for k in targets},
        "pause_changes_s": {ws[j - 1].text: round(d, 4) for j, d in delta.items() if abs(d) > 1e-6},
    }
    new = {j: adj[j][0] + d for j, d in delta.items() if abs(d) > 1e-6}
    return new, report


def plan(words, tl):
    """Per segment: anchor (frame, sample), new inner pause lengths and the predicted
    film time of every word onset.  Raises if a segment cannot fit."""
    out = []
    for n, ws in enumerate(segment_words(words, tl), start=1):
        f = fit(ws, tl, n)
        if f["fits"] == "NO":
            raise ValueError(f"segment {n} cannot fit its window with pause-only edits: {f}")
        new = {}
        if f["fits"] == "pause trims":
            k = f["pause_factor"]
            new = {j: max(k * p, limits(p, c)[0]) for j, p, c in inner_pauses(ws)}
        if n == 6:
            new, report = course_word_solve(ws, tl)
        else:
            report = None
        new = {j: v for j, v in new.items() if abs(v - ws[j].pause_before) >= MIN_CHANGE}
        a = anchor_t(tl, n)
        t, prev_take, onsets = a, ws[0].onset, []
        for j, w in enumerate(ws):
            if j:
                t += (w.onset - prev_take) - (w.pause_before - new.get(j, w.pause_before))
            prev_take = w.onset
            onsets.append(t)
        end = onsets[-1] + (ws[-1].end - ws[-1].onset)
        out.append({
            "n": n, "frame": anchor_frame(tl["vo"]["segments"][n - 1]["anchor_t"]),
            "anchor_t": a, "fit": f, "new_pauses": new, "course_words": report,
            "onsets": onsets, "end": end, "words": ws,
        })
    return out

"""Narration: synthesize script/script.json with Kokoro (local, Apache-2.0) and
write build/voice.wav + build/timings.json with per-word start/end times.

If build/voice_override.wav exists (your own recording) we skip synthesis and
estimate word timings at the scripted pacing instead (see README).
"""
import json, os, re, sys
import numpy as np
import soundfile as sf

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SCRIPT = json.load(open(os.path.join(ROOT, "script", "script.json")))
BUILD = os.path.join(ROOT, "build")
MODELS = os.path.join(ROOT, "models")
SR = 24000
PUNCT = set(",.?!;:—…\"“”'")


def caption_words(text):
    """Caption tokens with highlight flags; '*FIRE*' -> FIRE highlighted."""
    out = []
    for raw in text.split():
        hl = raw.startswith("*") or raw.startswith("…*")
        w = raw.replace("*", "")
        out.append({"text": w, "hl": hl})
    return out


def tts_text(text):
    t = text.replace("*", "").replace("…", " ").strip()
    # highlight words are written in caps for the captions; speak them normally
    t = re.sub(r"\b([A-Z]{2,})\b", lambda m: m.group(1).lower(), t)
    return re.sub(r"\s+", " ", t)


def strip_ph(p):
    return "".join(c for c in p if c not in PUNCT and c not in "ˈˌː ")


def align(groups, words, kok):
    """Map phoneme groups (with times) onto caption words.

    espeak sometimes fuses function words ("in the" -> one group), so we
    partition the word list into len(groups) contiguous blocks whose expected
    phoneme lengths best match each group, then split fused groups by length.
    """
    wl = [max(1, len(strip_ph(kok.tokenizer.phonemize(tts_text(w["text"]) or "a")))) for w in words]
    gl = [max(1, len(strip_ph(g["ph"]))) for g in groups]
    n, m = len(words), len(groups)
    INF = 1e9
    dp = [[INF] * (n + 1) for _ in range(m + 1)]
    bk = [[0] * (n + 1) for _ in range(m + 1)]
    dp[0][0] = 0
    for i in range(1, m + 1):
        for j in range(1, n + 1):
            for k in range(max(0, j - 4), j):
                if dp[i - 1][k] >= INF:
                    continue
                c = dp[i - 1][k] + abs(sum(wl[k:j]) - gl[i - 1]) + (j - k - 1) * 0.5
                if c < dp[i][j]:
                    dp[i][j], bk[i][j] = c, k
    if dp[m][n] >= INF:
        raise RuntimeError("alignment failed")
    blocks, j = [], n
    for i in range(m, 0, -1):
        k = bk[i][j]
        blocks.append((k, j))
        j = k
    blocks.reverse()
    out = []
    for g, (a, b) in zip(groups, blocks):
        tot = sum(wl[a:b])
        t = g["s"]
        for idx in range(a, b):
            d = (g["e"] - g["s"]) * wl[idx] / tot
            out.append({**words[idx], "s": round(t, 3), "e": round(t + d, 3)})
            t += d
    return out


def synth():
    from kokoro_onnx import Kokoro
    v = SCRIPT["voice"]
    kok = Kokoro(os.path.join(MODELS, "kokoro-timed.onnx"), os.path.join(MODELS, "voices-v1.0.bin"))
    assert kok.has_timings, "run tools/fetch_models.sh to build the timed model"
    audio = [np.zeros(int(v["lead_in"] * SR), np.float32)]
    t = v["lead_in"]
    lines = []
    for line in SCRIPT["lines"]:
        lw, lstart = [], t
        for si, seg in enumerate(line["segs"]):
            words = caption_words(seg["t"])
            a, sr, tm = kok.create_timed(tts_text(seg["t"]), v["voice"], speed=v["speed"],
                                         sentence_pause=0.2, clause_pause=0.12)
            assert sr == SR
            groups, cur = [], []
            for p in tm:
                if p.phoneme == " ":
                    if cur:
                        groups.append(cur)
                    cur = []
                else:
                    cur.append(p)
            if cur:
                groups.append(cur)
            groups = [{"ph": "".join(p.phoneme for p in g), "s": g[0].start, "e": g[-1].end}
                      for g in groups if strip_ph("".join(p.phoneme for p in g))]
            aligned = align(groups, words, kok)
            for w in aligned:
                lw.append({**w, "s": round(w["s"] + t, 3), "e": round(w["e"] + t, 3)})
            # 8 ms fades so segment joins never click
            f = int(0.008 * SR)
            a = a.astype(np.float32)
            a[:f] *= np.linspace(0, 1, f)
            a[-f:] *= np.linspace(1, 0, f)
            audio.append(a)
            t += len(a) / SR
            if si < len(line["segs"]) - 1:
                gap = seg.get("after", 0.25)
                audio.append(np.zeros(int(gap * SR), np.float32))
                t += gap
        lines.append({"id": line["id"], "start": round(lstart, 3), "end": round(t, 3),
                      "card": line.get("card"), "words": lw})
        audio.append(np.zeros(int(line["gap"] * SR), np.float32))
        t += line["gap"]
        print(f"{line['id']:4s} {lstart:6.2f}-{t:6.2f}  {' '.join(w['text'] for w in lw)}")
    return np.concatenate(audio), lines, t


def estimate(override):
    """Own recording supplied: estimate timings at 2.4 words/s from the script."""
    a, sr = sf.read(override, dtype="float32", always_2d=True)
    a = a.mean(axis=1)
    if sr != SR:
        from scipy.signal import resample_poly
        a = resample_poly(a, SR, sr).astype(np.float32)
    t = SCRIPT["voice"]["lead_in"]
    lines = []
    for line in SCRIPT["lines"]:
        lw, lstart = [], t
        for seg in line["segs"]:
            for w in caption_words(seg["t"]):
                d = 0.18 + 0.045 * len(w["text"])
                lw.append({**w, "s": round(t, 3), "e": round(t + d, 3)})
                t += d + 0.05
            t += seg.get("after", 0.0)
        lines.append({"id": line["id"], "start": round(lstart, 3), "end": round(t, 3),
                      "card": line.get("card"), "words": lw})
        t += line["gap"]
    scale = (len(a) / SR) / t
    for L in lines:  # stretch the estimate to the recording's real length
        L["start"] *= scale; L["end"] *= scale
        for w in L["words"]:
            w["s"] *= scale; w["e"] *= scale
    return a, lines, len(a) / SR


def refine_onsets(audio, lines):
    """Kokoro's duration model places the first word after a pause 40-140 ms later
    than its acoustic onset; snap those starts to the measured onset."""
    hop = SR // 200
    e = np.array([np.sqrt(np.mean(audio[i * hop:(i + 1) * hop] ** 2)) for i in range(len(audio) // hop)])
    edb = 20 * np.log10(e + 1e-6)
    ref = np.percentile(edb[edb > -60], 95)
    prev_end = 0.0
    for L in lines:
        for w in L["words"]:
            if w["s"] - prev_end > 0.12:
                k0, k1 = int((prev_end + 0.03) * 200), int(w["s"] * 200) + 1
                hot = np.nonzero(edb[k0:k1] > ref - 34)[0]
                if len(hot):
                    on = (k0 + hot[0]) / 200
                    if w["s"] - on > 0.02:
                        w["s"] = round(on - 0.01, 3)
            prev_end = w["e"]
        L["start"] = min(L["start"], L["words"][0]["s"])
    return lines


def main():
    os.makedirs(BUILD, exist_ok=True)
    if "--refine-only" in sys.argv:  # re-time an existing voice.wav without re-synthesizing
        T = json.load(open(os.path.join(BUILD, "timings.json")))
        a, _ = sf.read(os.path.join(BUILD, "voice.wav"), dtype="float32")
        T["lines"] = refine_onsets(a, T["lines"])
        json.dump(T, open(os.path.join(BUILD, "timings.json"), "w"), indent=1)
        print("refined word onsets in build/timings.json")
        return
    override = os.path.join(BUILD, "voice_override.wav")
    if os.path.exists(override):
        audio, lines, end = estimate(override)
        engine = "override (estimated timings)"
    else:
        audio, lines, end = synth()
        lines = refine_onsets(audio, lines)
        engine = "kokoro:" + SCRIPT["voice"]["voice"]
    sf.write(os.path.join(BUILD, "voice.wav"), audio, SR, subtype="PCM_16")
    out = {"engine": engine, "voice_end": round(end, 3),
           "outro": SCRIPT["outro"], "total": round(end + SCRIPT["outro"]["dur"], 3), "lines": lines}
    json.dump(out, open(os.path.join(BUILD, "timings.json"), "w"), indent=1)
    print(f"voice {end:.2f}s, total {out['total']:.2f}s -> build/timings.json")


if __name__ == "__main__":
    main()

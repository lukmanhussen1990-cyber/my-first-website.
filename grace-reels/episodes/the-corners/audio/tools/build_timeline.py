"""Build the voice timeline for The Corners.

Splits the user's voiceover into its spoken clips, finds every word's timing with an
offline speech model (sherpa-onnx zipformer), re-joins the clips with our own pauses,
and writes:
  public/voice.wav     48 kHz mono voice on the final timeline
  public/timeline.json words / pages / scenes / segments for Remotion and the audio mix

Usage: python -I build_timeline.py <episode_dir> <zipformer_model_dir>
"""
import json
import re
import subprocess
import sys
from difflib import SequenceMatcher

import numpy as np
import sherpa_onnx
import soundfile as sf

EP = sys.argv[1]
MD = sys.argv[2]
SRC = f"{EP}/audio/user_voice_god_rech_poor.mp3"
FPS = 30
OUT_SR = 48000

# Line (script sentence) that each clip belongs to; pauses between lines follow the brief.
SEG_LINE = [1, 1, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 8, 9, 9, 10, 11, 12, 13, 13, 14, 15, 16, 16, 16, 17, 17, 18, 18]
LINE_GAP = 0.35
GAP_AFTER_LINE = {2: 0.6, 10: 0.8, 11: 0.6, 13: 0.6, 17: 0.6}  # 11: short beat for Boaz's workers (S9)
INTRA_GAP = {0: 0.5, 18: 0.5}  # "If God is real… / why", "came… / Jesus"
PRE_PAD, POST_PAD = 0.05, 0.12
END_CARD = 3.0


def decode(path, sr):
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-ac", "1", "-ar", str(sr), "-f", "f32le", "-"],
                         check=True, capture_output=True).stdout
    return np.frombuffer(raw, dtype=np.float32).copy()


def norm(w):
    return re.sub(r"[^a-z]", "", w.lower().replace("’", "'"))


def parse_segment(text):
    """Returns display words with markers: [{text, keyword, page_break, scene}]."""
    words, page_break, scene = [], False, None
    for tok in text.split():
        if tok == "¶":
            page_break = True
            continue
        if tok.startswith("§"):
            scene = tok[1:]
            continue
        if tok.startswith("¶"):
            page_break, tok = True, tok[1:]
        kw = "*" in tok
        disp = tok.replace("*", "")
        if kw:  # keywords show in caps; keep surrounding punctuation as typed
            disp = re.sub(r"[A-Za-z’']+", lambda m: m.group(0).upper(), disp, count=1)
        words.append({"text": disp, "keyword": kw, "pageBreak": page_break, "scene": scene, "norm": norm(tok)})
        page_break, scene = False, None
    return words


def align(script_words, rec_words):
    """Map recognized (norm, t) words onto script words with an edit-distance alignment."""
    n, m = len(script_words), len(rec_words)
    INF = 1e9
    cost = np.full((n + 1, m + 1), INF)
    back = np.zeros((n + 1, m + 1), dtype=int)
    cost[0, :] = np.arange(m + 1)
    cost[:, 0] = np.arange(n + 1)
    for i in range(1, n + 1):
        for j in range(1, m + 1):
            sim = SequenceMatcher(None, script_words[i - 1]["norm"], rec_words[j - 1][0]).ratio()
            choices = [(cost[i - 1, j - 1] + (1 - sim) * 1.5, 0), (cost[i - 1, j] + 1, 1), (cost[i, j - 1] + 1, 2)]
            cost[i, j], back[i, j] = min(choices)
    i, j, match = n, m, {}
    while i > 0 and j > 0:
        b = back[i, j]
        if b == 0:
            match[i - 1] = j - 1
            i, j = i - 1, j - 1
        elif b == 1:
            i -= 1
        else:
            j -= 1
    return match


def main():
    segs_raw = json.load(open(f"{EP}/audio/voice_segments_raw.json"))
    script = json.load(open(f"{EP}/audio/tools/script_segments.json"))["segments"]
    assert len(segs_raw) == len(script) == len(SEG_LINE)

    a16 = decode(SRC, 16000)
    a48 = decode(SRC, OUT_SR)
    rec = sherpa_onnx.OfflineRecognizer.from_transducer(
        encoder=f"{MD}/encoder-epoch-99-avg-1.int8.onnx", decoder=f"{MD}/decoder-epoch-99-avg-1.int8.onnx",
        joiner=f"{MD}/joiner-epoch-99-avg-1.int8.onnx", tokens=f"{MD}/tokens.txt", num_threads=4)

    words, segments = [], []
    t_new = 0.0
    for si, (seg, sc) in enumerate(zip(segs_raw, script)):
        s0, s1 = seg["start"], seg["end"]
        # ---- recognize with token timestamps ----
        a, b = max(0.0, s0 - PRE_PAD), min(len(a16) / 16000, s1 + POST_PAD)
        st = rec.create_stream()
        st.accept_waveform(16000, a16[int(a * 16000):int(b * 16000)])
        rec.decode_stream(st)
        rec_words = []
        for tok, ts in zip(st.result.tokens, st.result.timestamps):
            if tok.startswith((" ", "▁")) or not rec_words:
                rec_words.append([norm(tok), a + ts])
            else:
                rec_words[-1][0] += norm(tok)
        sw = parse_segment(sc["text"])
        match = align(sw, rec_words)
        starts = [rec_words[match[k]][1] if k in match else None for k in range(len(sw))]
        starts[0] = s0 if starts[0] is None else max(s0, min(starts[0], s0 + 0.15))
        # fill unmatched words by interpolation
        for k in range(len(sw)):
            if starts[k] is None:
                prev = starts[k - 1]
                nxt = next((starts[q] for q in range(k + 1, len(sw)) if starts[q] is not None), s1)
                gaps = next((q for q in range(k + 1, len(sw)) if starts[q] is not None), len(sw)) - k + 1
                starts[k] = prev + (nxt - prev) / gaps
        starts = [min(max(x, s0), s1 - 0.05) for x in starts]
        for k in range(1, len(starts)):
            starts[k] = max(starts[k], starts[k - 1] + 0.06)

        # ---- new position on the final timeline ----
        if si > 0:
            prev_line, line = SEG_LINE[si - 1], SEG_LINE[si]
            if line != prev_line:
                gap = GAP_AFTER_LINE.get(prev_line, LINE_GAP)
            else:
                gap = INTRA_GAP.get(si - 1, min(max(s0 - segs_raw[si - 1]["end"], 0.28), 0.38))
            t_new = segments[-1]["end"] + gap
        shift = t_new - s0
        seg_new = {"index": si, "line": SEG_LINE[si], "start": round(t_new, 3), "end": round(s1 + shift, 3),
                   "srcStart": s0, "srcEnd": s1}
        segments.append(seg_new)
        for k, w in enumerate(sw):
            ws = starts[k] + shift
            we = (starts[k + 1] + shift - 0.02) if k + 1 < len(sw) else s1 + shift
            words.append({**w, "start": round(ws, 3), "end": round(max(we, ws + 0.08), 3), "segment": si, "line": SEG_LINE[si]})
        print(f"seg {si:2d} {t_new:6.2f}-{s1 + shift:6.2f}  matched {len(match)}/{len(sw)}")

    # ---- pages and scenes ----
    pages, scenes = [], []
    cur_scene = None
    for i, w in enumerate(words):
        w["i"] = i
        if w["pageBreak"] or not pages:
            pages.append({"id": len(pages), "wordStart": i, "start": w["start"]})
        w["page"] = pages[-1]["id"]
        if w["scene"]:
            first_in_seg = i == 0 or words[i - 1]["segment"] != w["segment"]
            if i == 0:
                t = 0.0
            elif first_in_seg:
                gap = w["start"] - words[i - 1]["end"]
                t = w["start"] - min(0.25, gap / 2)
            else:
                t = w["start"] - 0.12
            if scenes:
                scenes[-1]["end"] = round(t, 3)
            scenes.append({"id": w["scene"], "start": round(t, 3)})
        cur_scene = scenes[-1]["id"]
        w["scene"] = cur_scene
        del w["pageBreak"]
    for p in pages:
        last = max(i for i, w in enumerate(words) if w["page"] == p["id"])
        p["wordEnd"] = last
        p["end"] = words[last]["end"]
    voice_end = words[-1]["end"]
    s16 = round(voice_end + 0.45, 3)
    scenes[-1]["end"] = s16
    scenes.append({"id": "S16", "start": s16, "end": round(s16 + END_CARD, 3)})
    total = s16 + END_CARD
    frames = int(np.ceil(total * FPS))

    # ---- render the re-timed voice ----
    out = np.zeros(int((total + 0.5) * OUT_SR), dtype=np.float32)
    fade = int(0.008 * OUT_SR)
    for sg in segments:
        a = max(0.0, sg["srcStart"] - PRE_PAD)
        b = min(len(a48) / OUT_SR, sg["srcEnd"] + POST_PAD)
        clip = a48[int(a * OUT_SR):int(b * OUT_SR)].copy()
        clip[:fade] *= np.linspace(0, 1, fade)
        clip[-fade:] *= np.linspace(1, 0, fade)
        at = int((sg["start"] - (sg["srcStart"] - a)) * OUT_SR)
        out[at:at + len(clip)] += clip
    out = out[:int(frames / FPS * OUT_SR)]
    sf.write(f"{EP}/public/voice.wav", out, OUT_SR, subtype="PCM_24")

    tl = {"fps": FPS, "durationInFrames": frames, "duration": round(frames / FPS, 3), "voiceEnd": voice_end,
          "words": words, "pages": pages, "scenes": scenes, "segments": segments}
    json.dump(tl, open(f"{EP}/public/timeline.json", "w"), indent=1, ensure_ascii=False)
    print(f"\nTotal {total:.2f}s = {frames} frames; voice ends {voice_end:.2f}s")
    for s in scenes:
        print(f"  {s['id']:4s} {s['start']:6.2f} - {s['end']:6.2f}  ({s['end'] - s['start']:.2f}s)")


if __name__ == "__main__":
    main()

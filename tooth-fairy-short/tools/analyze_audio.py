#!/usr/bin/env python3
"""Analyse the voiceover and write assets/timing.json.

Produces:
  * speech segments (energy based, equivalent to ffmpeg silencedetect -35dB / 0.12s)
  * refined onsets (-45 dB below peak) used for picture cuts
  * word-level timings via PocketSphinx forced alignment (optional; pip install pocketsphinx)
  * a per-frame (30 fps) loudness envelope used for lip-sync

Usage: python3 tools/analyze_audio.py assets/voiceover.mp3 assets/timing.json
"""
import json, subprocess, sys, wave, tempfile, os
import numpy as np

FPS = 30
SCRIPT = [
    "this man lost a tooth", "he put it under his pillow", "in the morning", "there was money",
    "someone paid him", "that was bribery", "so he called the police", "the officer looked at the money",
    "then at him", "are you serious", "that's the tooth fairy", "she buys teeth", "that was smuggling",
    "so the police set a trap", "they caught her at midnight", "the tooth fairy went to jail",
    "but the man learned something", "teeth are money", "he sold all of them", "now he's rich", "he can't eat",
]

def load(path):
    tmp = tempfile.NamedTemporaryFile(suffix=".wav", delete=False).name
    subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-i", path, "-ar", "16000", "-ac", "1",
                    "-c:a", "pcm_s16le", tmp], check=True)
    w = wave.open(tmp, "rb"); sr = w.getframerate(); raw = w.readframes(w.getnframes()); w.close(); os.unlink(tmp)
    return sr, raw, np.frombuffer(raw, dtype=np.int16).astype(np.float32) / 32768.0

def rms_db(x, sr, centre, half):
    a = max(0, int((centre - half) * sr)); b = min(len(x), int((centre + half) * sr))
    if b <= a: return -120.0
    return float(20 * np.log10(np.sqrt(np.mean(x[a:b] ** 2)) + 1e-9))

def main(src, dst):
    sr, raw, x = load(src)
    dur = len(x) / sr
    hop = 0.005
    t = np.arange(0, dur - 0.02, hop)
    db = np.array([rms_db(x, sr, ti + 0.01, 0.01) for ti in t])
    peak = float(db.max())
    # segments: silence = below -35 dBFS for >= 0.12 s (same as silencedetect noise=-35dB:d=0.12)
    loud = db > -35.0
    segs, i = [], 0
    while i < len(t):
        if loud[i]:
            j = i
            while j < len(t):
                k = j
                while k < len(t) and not loud[k]: k += 1
                if k - j >= int(0.12 / hop) or k >= len(t):
                    break
                j = k + 1 if k < len(t) else k
                while j < len(t) and loud[j]: j += 1
            segs.append([round(float(t[i]), 3), round(float(t[min(j, len(t) - 1)]), 3)])
            i = j
        else:
            i += 1
    # refined onset: walk back while within 45 dB of peak
    for s in segs:
        k = int(s[0] / hop)
        while k > 0 and db[k - 1] - peak > -45: k -= 1
        s.append(round(float(t[k]) + 0.01, 3))
    words = []
    try:
        from pocketsphinx import Decoder
        dec = Decoder()
        if len(segs) == len(SCRIPT):
            for (a, b, _), text in zip(segs, SCRIPT):
                s0 = max(0.0, a - 0.1); s = int(s0 * sr) * 2; e = min(len(raw) // 2, int((b + 0.1) * sr)) * 2
                dec.set_align_text(text); dec.start_utt(); dec.process_raw(raw[s:e], full_utt=True); dec.end_utt()
                ws = [[sg.word.split("(")[0], round(s0 + sg.start_frame / 100, 2), round(s0 + (sg.end_frame + 1) / 100, 2)]
                      for sg in dec.seg() if sg.word not in ("<s>", "</s>", "<sil>", "(NULL)")]
                words.append({"text": text, "words": ws})
    except ImportError:
        print("pocketsphinx not installed: skipping word alignment", file=sys.stderr)
    # per-frame lip-sync envelope: dB relative to peak, 40 ms window centred on each frame
    n_frames = int(np.ceil(dur * FPS)) + FPS * 2
    env = [round(rms_db(x, sr, f / FPS, 0.02) - peak, 1) if f / FPS < dur else -90.0 for f in range(n_frames)]
    json.dump({"duration": round(dur, 3), "peak_db": round(peak, 1), "fps": FPS,
               "segments": [{"start": a, "end": b, "onset45": o} for a, b, o in segs],
               "lines": words, "env_db": env}, open(dst, "w"))
    print(f"duration {dur:.2f}s, {len(segs)} segments, {len(words)} aligned lines -> {dst}")
    for s in segs: print("  ", s)

if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])

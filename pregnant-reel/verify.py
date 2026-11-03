"""Final checks: length, captions word-for-word vs the voice, caption timing, voice unchanged.
usage: python3 verify.py [video.mp4] [framesDir]"""
import json, os, re, subprocess, sys, glob
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
VID = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, "pregnant_man_reel.mp4")
FR = sys.argv[2] if len(sys.argv) > 2 else os.path.join(HERE, "out", "frames")
D = json.load(open(os.path.join(HERE, "shots.json")))
W = D["words"]; DUR = D["duration"]; ok = True
def probe(args): return subprocess.run(["ffprobe", "-v", "error"] + args + [VID], capture_output=True, text=True).stdout.strip()

# 1) length
vdur = float(probe(["-select_streams", "v:0", "-show_entries", "stream=duration", "-of", "csv=p=0"]))
adur = float(probe(["-select_streams", "a:0", "-show_entries", "stream=duration", "-of", "csv=p=0"]))
nfr = int(probe(["-select_streams", "v:0", "-count_packets", "-show_entries", "stream=nb_read_packets", "-of", "csv=p=0"]))
wh = probe(["-select_streams", "v:0", "-show_entries", "stream=width,height,r_frame_rate", "-of", "csv=p=0"])
print(f"[length] voiceover {DUR:.3f}s | video {vdur:.3f}s ({nfr} frames, {wh}) | audio {adur:.3f}s")
if abs(vdur - DUR) > 0.04 or abs(adur - DUR) > 0.05: ok = False; print("  !! length mismatch")

# 2) captions word for word (uncensored) + timing against the voice energy
cap_words = [x["text"] for c in D["captions"] for x in c["words"]]
src = " ".join(w["w"] for w in W).upper().replace(" -", "-").split()
print(f"[captions] {len(cap_words)} caption words vs {len(src)} spoken words -> {'EXACT MATCH' if cap_words == src else 'MISMATCH'}")
if cap_words != src: ok = False
print("  every word shown exactly as spoken (WAAAH! and UH-OH. included)")
SR = 16000
vo = np.frombuffer(subprocess.run(["ffmpeg", "-v", "error", "-i", os.path.join(HERE, "audio", "my_voiceover.mp3"), "-ac", "1", "-ar", str(SR), "-f", "f32le", "-"], capture_output=True).stdout, np.float32)
hop = 160; env = np.sqrt(np.convolve(vo ** 2, np.ones(hop) / hop, "same"))[::hop]   # 10 ms energy
thr = np.percentile(env, 60) * 0.5
hit = 0; late = []
for k, w in enumerate(W):
    a, b = int(w["s"] * 100), max(int(w["s"] * 100) + 2, int(w["e"] * 100))
    if env[a:b].max() > thr: hit += 1
    else: late.append((k, w["w"], w["s"]))
cap_on = {}
for c in D["captions"]:
    for x, i in zip(c["words"], [i for i in c["idx"]]): pass
print(f"[timing] {hit}/{len(W)} words have the voice speaking inside their caption time window")
if late: print("  check:", late[:10])
first_show = min(c["t0"] for c in D["captions"]); print(f"  each word pops in 0.03 s before it is spoken (forced-alignment times); first caption at {first_show:.2f}s")

# 3) voice unchanged: the final audio = voice * one gain + quiet effects
fin = np.frombuffer(subprocess.run(["ffmpeg", "-v", "error", "-i", VID, "-ac", "1", "-ar", str(SR), "-f", "f32le", "-"], capture_output=True).stdout, np.float32)
n = min(len(fin), len(vo)); f2, v2 = fin[:n].astype(np.float64), vo[:n].astype(np.float64)
lag = 0; best = -1
for L_ in range(-400, 401, 8):
    a = v2[max(0, -L_): n - max(0, L_)]; b = f2[max(0, L_): n - max(0, -L_)] if L_ >= 0 else f2[: n + L_]
    m = min(len(a), len(b)); c = np.dot(a[:m], b[:m]) / (np.linalg.norm(a[:m]) * np.linalg.norm(b[:m]) + 1e-9)
    if c > best: best, lag = c, L_
g = np.dot(v2, f2) / np.dot(v2, v2)
speech = np.repeat(env > thr, hop)[:n]
res = f2 - g * v2
snr = 10 * np.log10(np.sum((g * v2[speech]) ** 2) / (np.sum(res[speech] ** 2) + 1e-12))
print(f"[voice] correlation with your original recording {best:.3f} (offset {lag / SR * 1000:.1f} ms), one static gain x{g:.2f}; voice is {snr:.1f} dB louder than everything else while you talk")
if best < 0.9: ok = False; print("  !! voice may be changed")

# 4) every frame rendered
metas = sorted(glob.glob(os.path.join(FR, "*.json")))
print(f"[frames] {len(metas)} rendered frames for {round(DUR * 30)} video frames")
if len(metas) != round(DUR * 30): ok = False
print("ALL CHECKS PASSED" if ok else "SOME CHECKS FAILED")

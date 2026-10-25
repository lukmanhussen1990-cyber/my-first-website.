#!/usr/bin/env python3
"""QC after a render: contact sheet every 2 s, blank-frame scan, caption-sync and KJV verse checks.
Writes out/qc_contact.jpg and prints a report."""
import glob, json, os, re, subprocess, sys
import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
B = os.path.join(ROOT, "build")
FPS = 30
T = json.load(open(os.path.join(B, "timings.json")))

# ---- KJV check (exact wording of the cards / pills against the King James text) ----
KJV = {
    "1 PETER 3:20": "Which sometime were disobedient, when once the longsuffering of God waited in the days of Noah, while the ark was a preparing, wherein few, that is, eight souls were saved by water.",
    "JOHN 10:9": "I am the door: by me if any man enter in, he shall be saved, and shall go in and out, and find pasture.",
    "2 PETER 2:5": "And spared not the old world, but saved Noah the eighth person, a preacher of righteousness, bringing in the flood upon the world of the ungodly;",
    "GENESIS 7:16": "And they that went in, went in male and female of all flesh, as God had commanded him: and the LORD shut him in.",
    "GENESIS 6:16": "A window shalt thou make to the ark, and in a cubit shalt thou finish it above; and the door of the ark shalt thou set in the side thereof; with lower, second, and third stories shalt thou make it.",
}
norm = lambda s: re.sub(r"[^a-z ]", "", s.lower().replace("…", " ")).split()
ok = True
for ln in T["lines"]:
    if not ln["card"]:
        continue
    ref = ln["ref"].split(" · ")[0]
    quote = " ".join(norm(ln["text"].replace("*", "")))
    full = " ".join(norm(KJV[ref]))
    hit = quote in full
    ok &= hit
    print(f"KJV {ref:13s} {'OK  ' if hit else 'FAIL'} “{ln['text'].replace('*', '')}”")
for phrase, ref in [("a preacher of righteousness", "2 PETER 2:5"), ("the lord shut him in", "GENESIS 7:16"), ("the door of the ark", "GENESIS 6:16")]:
    hit = phrase in " ".join(norm(KJV[ref]))
    ok &= hit
    print(f"KJV {ref:13s} {'OK  ' if hit else 'FAIL'} pill phrase “{phrase}”")

# ---- caption sync: on-screen reveal vs spoken word onset (frame-quantised) ----
offs = []
for ln in T["lines"]:
    if ln["card"]:
        continue
    for i, tk in enumerate(ln["tokens"]):
        reveal = max(0, tk["start"] - 0.07) if not (ln["id"] == "S1" and i == 0) else 0
        shown = np.ceil(reveal * FPS - 1e-9) / FPS
        offs.append((shown - tk["start"]) * 1000)
offs = np.array(offs)
print(f"caption sync: {len(offs)} words, reveal - onset: mean {offs.mean():.0f} ms, range [{offs.min():.0f}, {offs.max():.0f}] ms "
      f"({'OK' if np.abs(offs[1:]).max() <= 80 else 'CHECK'} vs ±80 ms; first word is pre-shown at frame 0 for the hook)")

# ---- frames: blank scan + contact sheet every 2 s ----
frames = sorted(glob.glob(os.path.join(B, "frames", "*.jpg")))
if frames:
    blank = []
    for f in frames[::3]:
        a = np.asarray(Image.open(f).convert("L").resize((108, 192)), dtype=np.float32)
        if a.std() < 4:
            blank.append(os.path.basename(f))
    print(f"frames: {len(frames)}, near-blank (std<4, sampled every 3rd): {len(blank)} {blank[:8]}")
    picks = [f for f in frames if (int(os.path.basename(f)[:5]) % (2 * FPS)) == 0]
    items = [{"f": f, "label": f"{int(os.path.basename(f)[:5]) / FPS:.0f}s"} for f in picks]
    idx = os.path.join(B, "qc_index.json")
    json.dump(items, open(idx, "w"))
    subprocess.run([sys.executable, os.path.join(ROOT, "scripts", "tile.py"), idx, os.path.join(ROOT, "out", "qc_contact.jpg"), "8", "220"], check=True)
    print("wrote out/qc_contact.jpg")
print("KJV:", "ALL OK" if ok else "MISMATCH")

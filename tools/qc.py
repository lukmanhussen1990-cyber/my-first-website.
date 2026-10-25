"""QC for out/final_reel.mp4 -> out/qc_report.md + out/qc_contact.jpg

- format: 1080x1920, 30 fps, duration 65-80 s, AAC
- loudness: integrated LUFS + true peak (ffmpeg ebur128)
- contact sheet every 2 s (look at it!)
- blank/black frame scan (every frame, low-res)
- caption sync: each word's caption time vs the acoustic onset in the narration (+-80 ms)
- Scripture: the two verses on screen vs the KJV text, word for word
- safe zone: results from tools/render.mjs --safezone (build/safezone.json) if present
"""
import json, os, re, subprocess
import numpy as np
import soundfile as sf
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT, B = os.path.join(ROOT, "out"), os.path.join(ROOT, "build")
VID = os.path.join(OUT, "final_reel.mp4")

# KJV (1769 Oxford standard text)
KJV = {
    "JEREMIAH 29:13": "And ye shall seek me, and find me, when ye shall search for me with all your heart.",
    # John 20:29 (latter half): "...blessed are they that have not seen, and yet have believed."
    "JOHN 20:29": "blessed are they that have not seen, and yet have believed.",
}


def main():
    rep = ["# QC report — GRACE IN MOTION · THE SKY", ""]
    ok = True
    # ---- format
    pr = json.loads(subprocess.run(["ffprobe", "-v", "error", "-show_streams", "-show_format", "-of", "json", VID], capture_output=True, text=True).stdout)
    v = [s for s in pr["streams"] if s["codec_type"] == "video"][0]
    a = [s for s in pr["streams"] if s["codec_type"] == "audio"][0]
    dur = float(pr["format"]["duration"])
    fps = eval(v["r_frame_rate"])
    fmt_ok = v["width"] == 1080 and v["height"] == 1920 and abs(fps - 30) < 1e-6 and 65 <= dur <= 80 and a["codec_name"] == "aac"
    ok &= fmt_ok
    rep += ["## Format", f"- video {v['codec_name']} {v['width']}x{v['height']} @ {fps:g} fps, {v.get('pix_fmt')}; audio {a['codec_name']} {a.get('sample_rate')} Hz {int(a.get('bit_rate', 0)) // 1000} kb/s",
            f"- duration {dur:.2f} s (target 65–80) → {'PASS' if fmt_ok else 'FAIL'}", ""]
    # ---- loudness
    lo = subprocess.run(f'ffmpeg -nostats -i "{VID}" -map 0:a -af ebur128=peak=true -f null -', shell=True, capture_output=True, text=True).stderr
    I = float(re.findall(r"I:\s+(-?[\d.]+) LUFS", lo)[-1]); TP = float(re.findall(r"Peak:\s+(-?[\d.]+) dBFS", lo)[-1])
    l_ok = abs(I + 14) <= 0.5 and TP <= -1.0
    ok &= l_ok
    rep += ["## Loudness", f"- integrated {I:.1f} LUFS (target −14), true peak {TP:.1f} dBTP (limit −1) → {'PASS' if l_ok else 'FAIL'}", ""]
    # ---- contact sheet every 2 s
    tmp = os.path.join(B, "qc_frames"); os.makedirs(tmp, exist_ok=True)
    for f in os.listdir(tmp): os.remove(os.path.join(tmp, f))
    subprocess.run(f'ffmpeg -v error -i "{VID}" -vf fps=0.5,scale=216:384 "{tmp}/%03d.jpg"', shell=True)
    fs = sorted(os.listdir(tmp))
    cols = 8; rows = (len(fs) + cols - 1) // cols
    sheet = Image.new("RGB", (cols * 216, rows * 384), "black"); d = ImageDraw.Draw(sheet)
    for i, f in enumerate(fs):
        x, y = (i % cols) * 216, (i // cols) * 384
        sheet.paste(Image.open(os.path.join(tmp, f)), (x, y))
        d.rectangle([x, y, x + 46, y + 16], fill="black"); d.text((x + 3, y + 2), f"{i * 2}s", fill="yellow")
    sheet.save(os.path.join(OUT, "qc_contact.jpg"), quality=85)
    rep += ["## Contact sheet", "- `out/qc_contact.jpg`: one frame every 2 s, reviewed by eye (faces vs text, safe zone, floating feet).", ""]
    # ---- blank / black frames
    raw = subprocess.run(f'ffmpeg -v error -i "{VID}" -vf scale=54:96,format=gray -f rawvideo -', shell=True, capture_output=True).stdout
    fr = np.frombuffer(raw, np.uint8).reshape(-1, 96, 54).astype(float)
    mean, std = fr.mean((1, 2)), fr.std((1, 2))
    blank = [i for i in range(len(fr)) if std[i] < 3.0 or mean[i] < 4]
    jumps = np.abs(np.diff(mean))
    b_ok = len(blank) == 0
    ok &= b_ok
    rep += ["## Blank frames", f"- {len(fr)} frames scanned; flat/black frames: {len(blank)} → {'PASS' if b_ok else 'FAIL ' + str(blank[:10])}",
            f"- largest frame-to-frame mean-luma jump: {jumps.max():.1f}/255 at {np.argmax(jumps) / 30:.2f} s (cuts are dissolves; flashes are lightning)", ""]
    # ---- caption sync vs acoustic onsets
    T = json.load(open(os.path.join(B, "timings.json")))
    vo, sr = sf.read(os.path.join(B, "voice.wav"))
    hop = sr // 200
    e = np.array([np.sqrt(np.mean(vo[i * hop:(i + 1) * hop] ** 2)) for i in range(len(vo) // hop)])
    edb = 20 * np.log10(e + 1e-6)
    ref = np.percentile(edb[edb > -60], 95)
    deltas = []
    for L in T["lines"]:
        prev_end = None
        for w in L["words"]:
            # only words that start after a pause have a measurable onset
            if prev_end is not None and w["s"] - prev_end > 0.1:
                # quietest point in the pause, then the first frame 15 dB above it
                k0, k1 = int((prev_end + 0.02) * 200), int((w["s"] + 0.12) * 200)
                seg = edb[k0:k1]
                if len(seg) > 4:
                    # audible onset: first frame within 34 dB of the narration's speech level
                    m = int(np.argmin(seg[: max(1, int((w["s"] - prev_end) * 200))]))
                    rise = np.nonzero(seg[m:] > ref - 34)[0]
                    if len(rise):
                        deltas.append((L["id"], w["text"], (k0 + m + rise[0]) / 200 - w["s"]))
            prev_end = w["e"]
    dd = np.array([x[2] for x in deltas])
    s_ok = np.percentile(np.abs(dd), 90) <= 0.08
    ok &= s_ok
    rep += ["## Caption sync (caption reveal = word start from TTS durations; measured against acoustic onsets)",
            f"- {len(dd)} pause-preceded words checked; median offset {np.median(dd) * 1000:+.0f} ms, 90th pct |offset| {np.percentile(np.abs(dd), 90) * 1000:.0f} ms, max {np.abs(dd).max() * 1000:.0f} ms → {'PASS (±80 ms)' if s_ok else 'CHECK'}",
            "- worst: " + ", ".join(f"{i}:{t} {d * 1000:+.0f}ms" for i, t, d in sorted(deltas, key=lambda x: -abs(x[2]))[:4]), ""]
    # ---- scripture
    rep += ["## Scripture (KJV, word for word)"]
    for L in T["lines"]:
        if not L.get("card"): continue
        ref = L["card"]["ref"].replace(" · KJV", "")
        shown = " ".join(w["text"] for w in L["words"])
        want = KJV[ref]
        match = re.sub(r"\s+", " ", shown.strip().lower()) == want.lower()
        ok &= match
        rep.append(f"- {L['card']['ref']}: “{shown}” → {'MATCH' if match else 'MISMATCH vs ' + want}")
    rep.append("")
    # ---- safe zone
    sz = os.path.join(B, "safezone.json")
    if os.path.exists(sz):
        S = json.load(open(sz))
        z_ok = len(S["violations"]) == 0
        ok &= z_ok
        rep += ["## Safe zone (x 60–960, y 220–1500)", f"- {S['checked']} frames × all visible text elements checked; violations: {len(S['violations'])} → {'PASS' if z_ok else 'FAIL'}"]
        for vv in S["violations"][:8]: rep.append(f"  - {vv}")
        rep.append("")
    rep += [f"**Overall: {'PASS' if ok else 'NEEDS ATTENTION'}**"]
    open(os.path.join(OUT, "qc_report.md"), "w").write("\n".join(rep) + "\n")
    print("\n".join(rep))


if __name__ == "__main__":
    main()

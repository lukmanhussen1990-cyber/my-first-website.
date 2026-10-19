"""Final QC: python qc.py <mp4> <frames_dir> <audio_dir> <out_dir>"""
import glob
import json
import math
import os
import re
import subprocess
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFont

import overlay as ov

mp4, frames, adir, out = sys.argv[1:5]
res = {}


def sh(cmd):
    return subprocess.run(cmd, shell=True, capture_output=True, text=True).stdout + \
        subprocess.run(cmd, shell=True, capture_output=True, text=True).stderr


# 1. container / streams
pr = json.loads(subprocess.run(["ffprobe", "-v", "error", "-show_streams", "-show_format", "-of", "json", mp4],
                               capture_output=True, text=True).stdout)
v = [s for s in pr["streams"] if s["codec_type"] == "video"][0]
a = [s for s in pr["streams"] if s["codec_type"] == "audio"][0]
nb = int(v.get("nb_frames", 0))
res["video"] = dict(codec=v["codec_name"], profile=v.get("profile"), w=v["width"], h=v["height"],
                    fps=v["r_frame_rate"], frames=nb, duration=float(v["duration"]),
                    bitrate_mbps=round(int(v["bit_rate"]) / 1e6, 2), pix_fmt=v["pix_fmt"])
res["audio"] = dict(codec=a["codec_name"], sr=int(a["sample_rate"]), channels=a["channels"],
                    duration=float(a["duration"]), bitrate_kbps=int(a.get("bit_rate", 0)) // 1000)
res["format_duration"] = float(pr["format"]["duration"])
res["size_mb"] = round(int(pr["format"]["size"]) / 1e6, 1)

# 2. loudness of the delivered (AAC) audio
e = sh(f'ffmpeg -hide_banner -nostats -i "{mp4}" -af ebur128=peak=true -f null - 2>&1')
I = float(re.findall(r"I:\s+(-?[\d.]+) LUFS", e)[-1])
TP = float(re.findall(r"Peak:\s+(-?[\d.]+) dBFS", e)[-1])
res["loudness"] = dict(integrated_lufs=I, true_peak_dbtp=TP)
mix_rep = json.load(open(os.path.join(adir, "mix_report.json")))
res["mix_report"] = mix_rep

# 3. subtitle sync: re-align words on the FINAL audio track, compare with highlight switch frames
sh(f'ffmpeg -hide_banner -loglevel error -y -i "{mp4}" -ac 1 -ar 48000 "{out}/final_audio.wav"')
sh(f'cd {os.path.dirname(os.path.abspath(__file__))} && ../../venv/bin/python align.py "{out}/final_audio.wav" '
   f'"{adir}/script_take2.txt" "{out}/align_final.json"')
fin = json.load(open(os.path.join(out, "align_final.json")))
words = json.load(open(os.path.join(adir, "align_edit.json")))
errs = []
for wf, wd in zip(fin, words):
    # the subtitle highlight for a word turns on at the first frame with t >= start - SUB_LEAD
    t_on = math.ceil((wd["start"] - ov.SUB_LEAD) * 30 - 1e-9) / 30.0
    errs.append(t_on - wf["start"])
errs = np.array(errs)
res["subtitle_sync"] = dict(n_words=len(errs), mean_ms=round(float(errs.mean() * 1000), 1),
                            max_abs_ms=round(float(np.abs(errs).max() * 1000), 1),
                            within_100ms=bool(np.abs(errs).max() <= 0.100))
res["voice_ends_s"] = max(w["end"] for w in fin)

# 4. safe zones from the per-frame text log
log, redo = [], []
for f in glob.glob(os.path.join(frames, "textlog_w*.json")):
    m = re.search(r"_(\d+)-(\d+)\.json$", f)
    if m:
        redo.append((int(m.group(1)), int(m.group(2)), json.load(open(f))))
    else:
        log += json.load(open(f))
ranges = {(a_, b_) for a_, b_, _ in redo}   # re-rendered frames replace the original log entries
log = [x for x in log if not any(a_ <= x[0] < b_ for a_, b_ in ranges)]
for _, _, entries in redo:
    log += entries
bad = ov.check_log([tuple(x) for x in log])
res["safe_zone"] = dict(text_boxes_checked=len(log), violations=len(bad), examples=bad[:8])

# 5. last second is a static hold
f1 = np.asarray(Image.open(os.path.join(frames, "f1320.png"))).astype(int)
f2 = np.asarray(Image.open(os.path.join(frames, "f1349.png"))).astype(int)
res["final_hold_maxdiff"] = int(np.abs(f1 - f2).max())

# 6. phone UI mock overlay on sample frames
font = ImageFont.truetype(ov.F_B, 30)
sheet = []
for fi in (15, 200, 330, 560, 780, 1000, 1170, 1340):
    im = Image.open(os.path.join(frames, f"f{fi:04d}.png")).convert("RGBA")
    ui = Image.new("RGBA", im.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(ui)
    d.rectangle([0, 0, 1080, 270], fill=(255, 0, 0, 45))
    d.rectangle([0, 1500, 1080, 1920], fill=(255, 0, 0, 45))
    d.rectangle([940, 960, 1080, 1500], fill=(255, 0, 0, 45))
    d.text((40, 90), "Reels", font=ImageFont.truetype(ov.F_XB, 48), fill=(255, 255, 255, 230))
    for k, y in enumerate((1080, 1230, 1380, 1530, 1680)):
        d.ellipse([975, y, 1045, y + 70], outline=(255, 255, 255, 230), width=5)
    d.ellipse([40, 1700, 110, 1770], fill=(200, 200, 200, 230))
    d.text((128, 1712), "@science.whatif  Follow", font=font, fill=(255, 255, 255, 230))
    d.text((40, 1790), "What If Mars Appeared in Earth's Sky? ...", font=font, fill=(255, 255, 255, 230))
    d.rectangle([0, 1900, 1080, 1906], fill=(255, 255, 255, 200))
    th = Image.alpha_composite(im, ui).convert("RGB").resize((270, 480), Image.LANCZOS)
    ImageDraw.Draw(th).text((6, 6), f"{fi / 30:.1f}s", fill=(255, 255, 0))
    sheet.append(th)
S = Image.new("RGB", (270 * 4, 480 * 2))
for i, th in enumerate(sheet):
    S.paste(th, ((i % 4) * 270, (i // 4) * 480))
S.save(os.path.join(out, "qc_phone_ui_mock.png"))
json.dump(res, open(os.path.join(out, "qc_report.json"), "w"), indent=1, default=str)
print(json.dumps(res, indent=1, default=str))

"""Assemble the final reel with ffmpeg: rendered frames + freeze frame, captions
(Special Elite, yellow, thick black outline, pop-in bounce, 2-3 words synced to the VO),
watermark, flash cuts + film grain on the flashback, loudness-normalised audio.

    python3 make_video.py <frames_dir> <audio.wav> <out.mp4> [--preview]
"""
import json
import os
import subprocess
import sys
from PIL import Image, ImageEnhance

FRAMES, AUDIO, OUT = sys.argv[1:4]
PREVIEW = '--preview' in sys.argv
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..'))
FONT = os.path.join(ROOT, 'assets', 'fonts', 'SpecialElite-Regular.ttf')
WATERMARK = '@Garden_reels'
ev = json.load(open(os.path.join(ROOT, 'assets', 'generated', 'events.json')))
FPS, END, FREEZE = ev['fps'], ev['end'], ev['freeze']
words = json.load(open(os.path.join(ROOT, 'assets', 'voiceover_words.json')))
W, H = 1080, 1920
work = os.path.join(os.path.dirname(os.path.abspath(OUT)), '_assembly')
os.makedirs(work, exist_ok=True)

# ---------------------------------------------------------------------------
# 1) frame list: rendered 1..FREEZE, then a freeze-frame punch zoom to END
# ---------------------------------------------------------------------------
seq = os.path.join(work, 'seq')
os.makedirs(seq, exist_ok=True)
last_ok = None
for f in range(1, FREEZE + 1):
    src = os.path.join(FRAMES, f'frame_{f:04d}.png')
    dst = os.path.join(seq, f'{f:04d}.png')
    if os.path.lexists(dst):
        os.remove(dst)
    if os.path.exists(src):
        os.symlink(src, dst)
        last_ok = src
    elif PREVIEW:
        if last_ok:
            os.symlink(last_ok, dst)
        else:
            Image.new('RGB', (W, H), (40, 40, 48)).save(dst)
    else:
        raise SystemExit(f'missing frame {src}')
base = Image.open(os.path.join(seq, f'{FREEZE:04d}.png')).convert('RGB')
for i, f in enumerate(range(FREEZE + 1, END + 1)):
    u = min(1.0, (i + 1) / 8.0)
    z = 1.0 + 0.06 * (1 - (1 - u) ** 3)               # ease-out punch zoom
    w2, h2 = int(W * z), int(H * z)
    im = base.resize((w2, h2), Image.LANCZOS).crop(((w2 - W) // 2, (h2 - H) // 2, (w2 - W) // 2 + W, (h2 - H) // 2 + H))
    if i < 2:                                          # freeze flash
        im = Image.blend(im, Image.new('RGB', (W, H), (255, 255, 255)), 0.45 if i == 0 else 0.2)
    im = ImageEnhance.Contrast(im).enhance(1.06)
    im.save(os.path.join(seq, f'{f:04d}.png'))

# ---------------------------------------------------------------------------
# 2) caption groups (2-3 words) from the voiceover word timings
# ---------------------------------------------------------------------------
GROUPS = [[0, 1], [2, 3], [4, 5, 6], [7, 8], [9, 10], [11, 12], [13, 14], [15, 16, 17], [18, 19, 20],
          [21], [22, 23], [24, 25], [26, 27, 28], [29], [30, 31], [32, 33, 34], [35, 36], [37, 38], [39, 40],
          [41, 42], [43, 44], [45, 46], [47, 48, 49], [50, 51], [52, 53, 54], [55, 56], [57, 58], [59, 60],
          [61, 62]]
assert sum(len(g) for g in GROUPS) == len(words), (sum(len(g) for g in GROUPS), len(words))
caps = []
for gi, g in enumerate(GROUPS):
    txt = ' '.join(words[i]['w'] for i in g).lower()
    txt = txt.replace(',', '').replace('.', '')
    t0 = words[g[0]]['s']
    t_end = words[g[-1]]['e']
    nxt = words[GROUPS[gi + 1][0]]['s'] if gi + 1 < len(GROUPS) else END / FPS
    t1 = nxt if nxt - t_end < 0.4 else t_end + 0.35
    if gi == len(GROUPS) - 1:
        t1 = END / FPS                                  # "big mistake" stays on the freeze frame
    caps.append((txt, max(0.0, t0 - 0.03), t1))
with open(os.path.join(work, 'captions.json'), 'w') as fh:
    json.dump(caps, fh, indent=1)


def esc(p):
    return p.replace('\\', '/').replace(':', '\\:').replace("'", "\\'")


FS = 86
filters = []
# flash cuts into the flashback / enemy shots + film grain in the flashback
for n0 in (339, 495):
    filters.append(f"drawbox=x=0:y=0:w=iw:h=ih:color=white@0.38:t=fill:enable='between(n,{n0},{n0 + 1})'")
filters.append("noise=alls=5:allf=t:enable='between(n,339,494)'")
for i, (txt, t0, t1) in enumerate(caps):
    tf = os.path.join(work, f'cap_{i:02d}.txt')
    with open(tf, 'w') as fh:
        fh.write(txt)
    u = f'(t-{t0:.3f})'
    bounce = (f"if(lt({u},0.07),0.55+{u}/0.07*0.62,"
              f"if(lt({u},0.14),1.17-({u}-0.07)/0.07*0.2,"
              f"if(lt({u},0.2),0.97+({u}-0.14)/0.06*0.03,1)))")
    filters.append(
        f"drawtext=fontfile='{esc(FONT)}':textfile='{esc(tf)}':fontcolor=0xFFE31A:"
        f"borderw=8:bordercolor=black:shadowx=4:shadowy=6:shadowcolor=black@0.55:"
        f"fontsize='{FS}*{bounce}':x=(w-text_w)/2:y=1170-text_h/2:"
        f"enable='between(t,{t0:.3f},{t1:.3f})'")
filters.append(
    f"drawtext=fontfile='{esc(FONT)}':text='{WATERMARK}':fontcolor=white@0.6:fontsize=40:"
    f"shadowx=2:shadowy=2:shadowcolor=black@0.45:x=w-text_w-34:y=h-text_h-56")
filters.append('format=yuv420p')
vf = ','.join(filters)
with open(os.path.join(work, 'filter.txt'), 'w') as fh:
    fh.write(vf)

# ---------------------------------------------------------------------------
# 3) loudness normalisation (2-pass) + encode
# ---------------------------------------------------------------------------
meas = subprocess.run(['ffmpeg', '-hide_banner', '-i', AUDIO, '-af',
                       'loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json', '-f', 'null', '-'],
                      capture_output=True, text=True).stderr
js = json.loads(meas[meas.rindex('{'):meas.rindex('}') + 1])
ln = (f"loudnorm=I=-14:TP=-1.5:LRA=11:measured_I={js['input_i']}:measured_TP={js['input_tp']}:"
      f"measured_LRA={js['input_lra']}:measured_thresh={js['input_thresh']}:offset={js['target_offset']}:linear=true")
cmd = ['ffmpeg', '-hide_banner', '-v', 'error', '-y', '-framerate', str(FPS), '-start_number', '1',
       '-i', os.path.join(seq, '%04d.png'), '-i', AUDIO,
       '-filter_script:v', os.path.join(work, 'filter.txt'), '-af', ln + ',aresample=48000',
       '-map', '0:v', '-map', '1:a', '-c:v', 'libx264', '-preset', 'slow' if not PREVIEW else 'veryfast',
       '-crf', '19', '-maxrate', '14M', '-bufsize', '28M', '-profile:v', 'high', '-level', '4.2',
       '-pix_fmt', 'yuv420p', '-r', str(FPS),
       '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-movflags', '+faststart', '-shortest', OUT]
subprocess.run(cmd, check=True)
print('wrote', OUT)

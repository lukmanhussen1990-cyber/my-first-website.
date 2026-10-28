"""Contact sheet: 2 frames from every scene of the reel next to frames from the reference videos.

usage: python3 contact_sheet.py <composited_frames_dir> <ref1.mp4> <ref2.mp4> <out.png> [step]
"""
import os
import sys
import glob
import subprocess
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
FONT = os.path.join(os.path.dirname(HERE), 'assets', 'fonts', 'Poppins-Bold.ttf')
SCENES = [(0.0, 4.0), (4.0, 8.36), (8.36, 11.72), (11.72, 14.38), (14.38, 17.68), (17.68, 21.26),
          (21.26, 25.79), (25.79, 28.68), (28.68, 32.8), (32.8, 34.6), (34.6, 38.56), (38.56, 42.39),
          (42.39, 44.38)]


def ref_frames(path, times, w):
    out = []
    for t in times:
        raw = subprocess.run(['ffmpeg', '-v', 'error', '-ss', str(t), '-i', path, '-frames:v', '1', '-f', 'image2pipe',
                              '-vcodec', 'png', '-'], capture_output=True).stdout
        from io import BytesIO
        im = Image.open(BytesIO(raw)).convert('RGB')
        out.append(im.resize((w, int(w * im.height / im.width))))
    return out


def main():
    fdir, r1, r2, out = sys.argv[1:5]
    step = int(sys.argv[5]) if len(sys.argv) > 5 else 1
    files = sorted(glob.glob(os.path.join(fdir, 'seq_*.png')))
    w = 216
    h = 384
    f = ImageFont.truetype(FONT, 14)
    tiles = []
    for k, (a, b) in enumerate(SCENES):
        for u in (0.3, 0.75):
            t = a + (b - a) * u
            idx = min(len(files) - 1, int(round(t * 30 / step)))
            im = Image.open(files[idx]).convert('RGB').resize((w, h))
            d = ImageDraw.Draw(im)
            d.rectangle((0, 0, 92, 18), fill=(0, 0, 0))
            d.text((3, 1), f'S{k + 1}  {t:.1f}s', font=f, fill=(255, 230, 0))
            tiles.append(im)
    refs = ref_frames(r1, [2.5, 9.5, 17.6, 33.0, 39.5], w) + ref_frames(r2, [10.6, 14.0, 21.0, 30.5, 37.5], w)
    cols = 13
    W = cols * w
    H = 2 * h + 30 + refs[0].height + 30
    sheet = Image.new('RGB', (W, H), (18, 18, 22))
    d = ImageDraw.Draw(sheet)
    d.text((6, 4), 'OUR REEL - 2 frames per scene', font=f, fill=(255, 255, 255))
    for i, im in enumerate(tiles):
        sheet.paste(im, ((i // 2) * w, 24 + (i % 2) * h))
    y0 = 24 + 2 * h + 6
    d.text((6, y0), 'REFERENCE (ref1 / ref2)', font=f, fill=(255, 255, 255))
    for i, im in enumerate(refs):
        sheet.paste(im, (i * w + (i // 5) * 40, y0 + 22))
    sheet.save(out)
    print('saved', out, sheet.size)


if __name__ == '__main__':
    main()

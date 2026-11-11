"""QA contact sheet: grab frames from the final MP4 at given times into a labelled grid."""
import subprocess, sys
from PIL import Image, ImageDraw
src, out = sys.argv[1], sys.argv[2]
times = [float(x) for x in sys.argv[3].split(',')]
cols = int(sys.argv[4]) if len(sys.argv) > 4 else 6
tw_, th_ = 270, 480
rows = (len(times) + cols - 1) // cols
sheet = Image.new('RGB', (cols * tw_, rows * th_), (20, 20, 20))
for i, t in enumerate(times):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-ss', f'{t:.3f}', '-i', src, '-frames:v', '1', '-vf', f'scale={tw_}:{th_}', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], capture_output=True).stdout
    im = Image.frombytes('RGB', (tw_, th_), raw)
    d = ImageDraw.Draw(im); d.rectangle([0, 0, 64, 18], fill=(0, 0, 0)); d.text((3, 3), f'{t:.2f}s', fill=(255, 255, 0))
    sheet.paste(im, ((i % cols) * tw_, (i // cols) * th_))
sheet.save(out)

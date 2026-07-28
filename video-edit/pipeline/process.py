"""Apply all text replacements and write the edited frame sequence."""
import cv2, glob, os, sys
import render as R
from traj import build

files = sorted(glob.glob('all/*.png'))
OUT = 'out'
os.makedirs(OUT, exist_ok=True)
traj, cuts = build()

edited = 0
for i, f in enumerate(files, 1):
    frame = cv2.imread(f)
    if i in traj:
        before = frame.copy()
        frame = R.apply_frame(frame, *traj[i])
        if (before != frame).any():
            edited += 1
    cv2.imwrite(f'{OUT}/{i:04d}.png', frame)
    if i % 50 == 0:
        print(i, flush=True)

print(f"frames: {len(files)}  edited: {edited}  "
      f"tracked range: {min(traj)}-{max(traj)}")

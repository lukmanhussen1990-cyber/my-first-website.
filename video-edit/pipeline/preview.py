"""Render frames with all replacements applied; show original vs edited."""
import cv2, numpy as np, glob, sys
import render as R
from traj import build

files = sorted(glob.glob('all/*.png'))
traj, cuts = build()

def edit(i):
    frame = cv2.imread(files[i - 1])
    if i not in traj:
        return frame
    return R.apply_frame(frame, *traj[i])

if __name__ == '__main__':
    frames = [int(x) for x in sys.argv[1].split(',')]
    rows = []
    for i in frames:
        a = cv2.imread(files[i - 1]); b = edit(i)
        pair = np.hstack([cv2.resize(a, (500, 281)), cv2.resize(b, (500, 281))])
        cv2.putText(pair, f"{i} orig", (8, 24), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 255), 2)
        cv2.putText(pair, "edited", (508, 24), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 0), 2)
        rows.append(pair)
    cv2.imwrite('preview.png', np.vstack(rows))
    print('preview.png', len(frames))

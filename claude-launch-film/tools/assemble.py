"""Merge all edit passes onto the reference frames (edits are spatially disjoint; each pass's
difference from the original is applied) and write the final frame sequence."""
import sys, os, glob
sys.path.insert(0, '/tmp/claude-0/-home-user-my-first-website-/4f2370d4-b0d4-589b-a9a6-5a27c4fb85e7/scratchpad/tools')
from common import *

PASSES = ['wm/out_s1', 'wm/out_s2', 'ui/out_dash', 'ui/out_side']

def main(outdir):
    os.makedirs(outdir, exist_ok=True)
    report = []
    for i in range(1, 1349):
        edits = [p for p in PASSES if os.path.exists(f'{S}/{p}/f{i:04d}.png')]
        dst = f'{outdir}/f{i:04d}.png'
        if not edits:
            if not os.path.exists(dst):
                os.symlink(f'{S}/png/f{i:04d}.png', dst)
            continue
        o = cv2.imread(f'{S}/png/f{i:04d}.png').astype(np.int16)
        acc = o.copy(); touched = np.zeros(o.shape[:2], np.int8)
        for p in edits:
            e = cv2.imread(f'{S}/{p}/f{i:04d}.png').astype(np.int16)
            d = e - o; m = np.abs(d).max(2) > 0
            touched += m.astype(np.int8)
            acc += d
        overlap = int((touched > 1).sum())
        if os.path.islink(dst) or os.path.exists(dst):
            os.remove(dst)
        cv2.imwrite(dst, np.clip(acc, 0, 255).astype(np.uint8))
        report.append((i, [os.path.basename(p) for p in edits], int((touched > 0).sum()), overlap))
    for r in report:
        if r[3] > 0: print('OVERLAP', r)
    print('edited frames', len(report), 'first', report[0][0] if report else None, 'last', report[-1][0] if report else None)

if __name__ == '__main__':
    main(sys.argv[1])

"""Render a shot's frames.

python3 render_shot.py NN [--start a] [--end b] [--frames 1,25,60] [--res WxH] [--samples n] [--test]

Final frames go to $SCRATCH/renders/shotNN/####.png (existing frames are skipped, so runs can resume).
--test writes to $SCRATCH/tests/shotNN/ instead and always re-renders.
"""
import argparse
import glob
import importlib.util
import os
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "lib"))

import bpy  # noqa: E402
import cokelib as C  # noqa: E402


def load_shot(shot_id):
    matches = glob.glob(os.path.join(HERE, "shots", f"shot{shot_id}_*.py"))
    if not matches:
        raise SystemExit(f"no shot module for {shot_id}")
    spec = importlib.util.spec_from_file_location(f"shot{shot_id}", matches[0])
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("shot")
    ap.add_argument("--start", type=int)
    ap.add_argument("--end", type=int)
    ap.add_argument("--frames")
    ap.add_argument("--step", type=int, default=1)
    ap.add_argument("--res")
    ap.add_argument("--samples", type=int)
    ap.add_argument("--test", action="store_true")
    a = ap.parse_args()
    shot_id = f"{int(a.shot):02d}"
    if a.res:
        os.environ["COKE_RES"] = a.res
    if a.samples:
        os.environ["COKE_SAMPLES"] = str(a.samples)
    mod = load_shot(shot_id)
    t0 = time.time()
    mod.build()
    sc = bpy.context.scene
    print(f"[{shot_id}] built in {time.time() - t0:.1f}s  res={sc.render.resolution_x}x{sc.render.resolution_y} "
          f"spp={sc.cycles.samples}", flush=True)
    n = mod.SHOT["frames"]
    if a.frames:
        frames = [int(v) for v in a.frames.split(",")]
    else:
        frames = list(range(a.start or 1, (a.end or n) + 1, a.step))
    out = os.path.join(C.SCRATCH, "tests" if a.test else "renders", f"shot{shot_id}")
    os.makedirs(out, exist_ok=True)
    times = []
    for f in frames:
        final = os.path.join(out, f"{f:04d}.png")
        if not a.test and os.path.exists(final):
            continue
        t = time.time()
        sc.frame_set(f)
        sc.render.filepath = os.path.join(out, f"{f:04d}_tmp")
        bpy.ops.render.render(write_still=True)
        os.replace(os.path.join(out, f"{f:04d}_tmp.png"), final)
        times.append(time.time() - t)
        print(f"[{shot_id}] frame {f}/{n} {times[-1]:.1f}s", flush=True)
    if times:
        print(f"[{shot_id}] done {len(times)} frames, avg {sum(times) / len(times):.1f}s", flush=True)
    sys.stdout.flush()
    os._exit(0)  # the bpy module can deadlock during interpreter shutdown


if __name__ == "__main__":
    try:
        main()
    except BaseException:
        import traceback

        traceback.print_exc()
        sys.stdout.flush()
        sys.stderr.flush()
        os._exit(1)

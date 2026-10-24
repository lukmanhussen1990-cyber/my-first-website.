"""Frame rendering: preview stills and the full video (parallel segments)."""
from __future__ import annotations

import multiprocessing as mp
import subprocess
import time
from pathlib import Path

from .ink import H, W
from .stage import Stage

FPS = 30
X264 = ["-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-pix_fmt", "yuv420p"]
_PLAN = None  # set before forking workers


def preview_time(sc):
    """A representative moment of a scene: most of its animations have landed."""
    return sc.start + 0.72 * (sc.end - sc.start)


def render_previews(cfg, plan, outdir: Path, times=None, scenes=None):
    from PIL import Image
    outdir.mkdir(parents=True, exist_ok=True)
    stage = Stage(plan)
    jobs = []
    for t in times or []:
        jobs.append((f"t{t:06.2f}", t))
    for n in scenes or ([] if times else getattr(cfg, "PREVIEW_SCENES", [1])):
        sc = plan.scenes[n - 1]
        t = preview_time(sc)
        if plan.finale and n == len(plan.scenes):
            t = min(t, plan.finale["t"] - 0.15)  # just before everything fades
        jobs.append((f"scene{n:02d}", t))
    paths = []
    for name, t in jobs:
        p = outdir / f"{name}.png"
        stage.frame(t).surface.write_to_png(str(p))
        paths.append(p)
        print(f"preview {name} @ {t:.2f}s -> {p}")
    # side-by-side sheet with reference frames (if the study frames exist)
    ref_dir = Path(__file__).resolve().parent.parent / "ref_frames"
    if ref_dir.exists() and paths:
        nums = getattr(cfg, "PREVIEW_REFERENCE_FRAMES", [13, 31, 38, 21])
        picks = [ref_dir / f"frame_{n:03d}.jpg" for n in nums][:len(paths)]
        picks = [p for p in picks if p.exists()]
        tw, th = 405, 720
        sheet = Image.new("RGB", (len(paths) * (tw + 12) + 12, 2 * th + 36), (40, 40, 40))
        for i, p in enumerate(paths):
            im = Image.open(p).convert("RGB").resize((tw, th), Image.LANCZOS)
            sheet.paste(im, (12 + i * (tw + 12), 12))
            if i < len(picks):
                r = Image.open(picks[i]).convert("RGB").resize((tw, th), Image.LANCZOS)
                sheet.paste(r, (12 + i * (tw + 12), th + 24))
        sheet.save(outdir / "compare_with_reference.png")
        print(f"comparison sheet -> {outdir / 'compare_with_reference.png'} (top: ours, bottom: reference)")
    return paths


def _render_segment(args):
    a, b, path = args
    stage = Stage(_PLAN)
    cmd = ["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "bgra", "-s", f"{W}x{H}", "-r", str(FPS),
           "-i", "-", *X264, "-threads", "2", str(path)]
    proc = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    for i in range(a, b):
        cv = stage.frame(i / FPS)
        cv.surface.flush()
        proc.stdin.write(bytes(cv.surface.get_data()))
    proc.stdin.close()
    if proc.wait() != 0:
        raise RuntimeError(f"ffmpeg failed for segment {path}")
    return b - a


def render_all(cfg, plan, build: Path, out: Path, workers=4):
    global _PLAN
    _PLAN = plan
    n = int(round(plan.duration * FPS))
    seg_dir = build / "segments"
    seg_dir.mkdir(parents=True, exist_ok=True)
    for f in seg_dir.glob("*.mp4"):
        f.unlink()
    k = max(1, workers)
    bounds = [round(i * n / k) for i in range(k + 1)]
    jobs = [(bounds[i], bounds[i + 1], seg_dir / f"seg{i:02d}.mp4") for i in range(k)]
    t0 = time.time()
    print(f"rendering {n} frames ({plan.duration:.2f}s @ {FPS}fps) on {k} workers ...", flush=True)
    with mp.get_context("fork").Pool(k) as pool:
        done = sum(pool.map(_render_segment, jobs))
    print(f"rendered {done} frames in {time.time() - t0:.0f}s", flush=True)
    lst = seg_dir / "list.txt"
    lst.write_text("".join(f"file '{j[2].name}'\n" for j in jobs))
    video = build / "video_only.mp4"
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", str(lst), "-c", "copy",
                    str(video)], check=True)
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(video), "-i", str(build / "mix.wav"), "-map", "0:v",
                    "-map", "1:a", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-ac", "2",
                    "-shortest", "-movflags", "+faststart", str(out)], check=True)
    print(f"done -> {out}")

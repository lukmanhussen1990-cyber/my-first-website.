#!/usr/bin/env python3
"""Record scenes/sceneNN.html to out/scenes/sceneNN.mp4 with Playwright (720x1280, 30 fps).

Each scene is opened in headless Chromium from a tiny local web server. Instead of a
real-time screen recording (which drops frames when the machine is busy), the page clock
is frozen and stepped exactly one frame at a time with window.__seek(t), and each frame
is piped into ffmpeg. The clip is cut to the exact scene length from audio/timings.json.

  python3 render.py            # every scene
  python3 render.py 3 7        # only scenes 3 and 7
  python3 render.py --snap 3@1.5 7@4   # still images -> out/snaps/
"""
import functools
import http.server
import json
import multiprocessing as mp
import subprocess
import sys
import threading
import time

from story import OUT, ROOT, load_plan

W, H = load_plan()["size"]
FPS = load_plan()["fps"]


class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


def start_server():
    srv = http.server.ThreadingHTTPServer(("127.0.0.1", 0), functools.partial(Quiet, directory=str(ROOT)))
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return srv.server_address[1]


def open_scene(p, port, n):
    browser = p.chromium.launch()
    page = browser.new_page(viewport={"width": W, "height": H}, device_scale_factor=1)
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.goto(f"http://127.0.0.1:{port}/scenes/scene{n:02d}.html?render=1")
    page.wait_for_function("window.__ready === true", timeout=60000)
    if errors:
        print(f"scene {n:02d} page errors: {errors}", flush=True)
    return browser, page


def record(job):
    n, dur, port = job
    from playwright.sync_api import sync_playwright
    out = OUT / "scenes" / f"scene{n:02d}.mp4"
    frames = round(dur * FPS)
    t0 = time.time()
    with sync_playwright() as p:
        browser, page = open_scene(p, port, n)
        ff = subprocess.Popen(
            ["ffmpeg", "-v", "error", "-y", "-f", "image2pipe", "-c:v", "png", "-framerate", str(FPS), "-i", "-",
             "-frames:v", str(frames), "-c:v", "libx264", "-preset", "slow", "-crf", "15", "-pix_fmt", "yuv420p",
             "-r", str(FPS), "-movflags", "+faststart", str(out)], stdin=subprocess.PIPE)
        for i in range(frames):
            page.evaluate("t => window.__seek(t)", i / FPS)
            ff.stdin.write(page.screenshot(type="png"))
        ff.stdin.close()
        ff.wait()
        browser.close()
    return f"out/scenes/scene{n:02d}.mp4  {frames} frames  ({time.time() - t0:.0f}s)"


def snap(port, items):
    from playwright.sync_api import sync_playwright
    (OUT / "snaps").mkdir(parents=True, exist_ok=True)
    with sync_playwright() as p:
        for item in items:
            n, t = item.split("@")
            n, t = int(n), float(t)
            browser, page = open_scene(p, port, n)
            page.evaluate("t => window.__seek(t)", t)
            path = OUT / "snaps" / f"scene{n:02d}_{t:05.2f}.png"
            page.screenshot(path=str(path))
            browser.close()
            print(path.relative_to(ROOT))


def main():
    args = sys.argv[1:]
    port = start_server()
    if args[:1] == ["--snap"]:
        return snap(port, args[1:])
    timings = json.loads((ROOT / "audio" / "timings.json").read_text())["scenes"]
    wanted = [int(a) for a in args] or [s["scene"] for s in timings]
    (OUT / "scenes").mkdir(parents=True, exist_ok=True)
    jobs = [(s["scene"], s["duration"], port) for s in timings if s["scene"] in wanted]
    jobs.sort(key=lambda j: -j[1])  # longest first
    with mp.get_context("spawn").Pool(min(4, mp.cpu_count(), len(jobs))) as pool:
        for line in pool.imap_unordered(record, jobs):
            print(line, flush=True)


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""render.py — record every scene (scenes/sceneNN.html) to an MP4 clip with Playwright.

  python3 render.py                    plan + render all scenes + cover.png
  python3 render.py 3 7                only scenes 3 and 7 (plan is always refreshed)
  python3 render.py --plan             only write out/timeline.json and the audio mix plan
  python3 render.py --stills 3 --at 0.5,2,4    PNG stills of scene 3 (for checking)

Timing: scene length = voice start + voice length + tail (0.8 s), never shorter than
the scene's "min" in scenes.json, rounded up to whole frames.

Recording is frame-accurate: for every frame the page clock is seeked to t = n/fps
(window.__reel.seek), a screenshot is taken and piped into ffmpeg. Each clip is
therefore exactly its planned length (no dropped frames, no trimming guesswork).
"""
import argparse
import asyncio
import base64
import functools
import http.server
import json
import math
import re
import subprocess
import sys
import threading
from pathlib import Path

ROOT = Path(__file__).resolve().parent
OUT = ROOT / "out"


# ------------------------------------------------------------------ planning
def load_plan():
    plan = json.loads((ROOT / "scenes.json").read_text(encoding="utf-8"))
    lines = [l.strip() for l in (ROOT / "script.txt").read_text(encoding="utf-8").splitlines()
             if l.strip() and not l.strip().startswith("#")]
    if len(lines) != len(plan["scenes"]):
        sys.exit(f"script.txt has {len(lines)} lines but scenes.json has {len(plan['scenes'])} scenes")
    return plan, lines


def media_duration(path):
    r = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0",
                        str(path)], capture_output=True, text=True, check=True)
    return float(r.stdout.strip())


def loudness(path):
    """Integrated loudness (LUFS) of an audio file, via ffmpeg's ebur128 (cached by mtime)."""
    cache_file = OUT / ".loudness.json"
    cache = json.loads(cache_file.read_text()) if cache_file.exists() else {}
    key, stamp = str(Path(path).relative_to(ROOT)), Path(path).stat().st_mtime
    if key in cache and cache[key][0] == stamp:
        return cache[key][1]
    r = subprocess.run(["ffmpeg", "-nostats", "-hide_banner", "-i", str(path), "-af", "ebur128=framelog=quiet",
                        "-f", "null", "-"], capture_output=True, text=True)
    m = re.findall(r"I:\s+(-?[\d.]+) LUFS", r.stderr)
    value = float(m[-1]) if m else None
    cache[key] = [stamp, value]
    OUT.mkdir(exist_ok=True)
    cache_file.write_text(json.dumps(cache, indent=1))
    return value


def make_timeline(plan, lines):
    fps = plan.get("fps", 30)
    default = plan.get("timing", {})
    whoosh = plan.get("audio", {}).get("whoosh_on_cut", True)
    duck = plan.get("audio", {}).get("sfx_duck_db", 0)              # SFX under the voice get quieter
    scenes, t = [], 0.0
    for i, sp in enumerate(plan["scenes"], 1):
        voice = ROOT / "audio" / "voice" / f"scene{i:02d}.mp3"
        vo_dur = media_duration(voice) if voice.exists() else 0.0
        vo_at = sp.get("vo_at", 0.3)
        tail = sp.get("tail", default.get("tail", 0.8))
        dur = max(vo_at + vo_dur + tail, sp.get("min", default.get("min", 5.0)))
        dur = math.ceil(round(dur * fps, 6)) / fps                     # whole frames
        beats = sp.get("beats", {})
        cues = [["whoosh", round(max(0.0, t - 0.18), 3)]] if whoosh else []
        for name, when, *gain in sp.get("sfx", []):
            times = beats.get(when) if isinstance(when, str) else when
            if times is None:
                sys.exit(f"scene {i}: sfx '{name}' refers to unknown beat '{when}'")
            for x in times if isinstance(times, list) else [times]:
                at = t + float(x)
                g = list(gain)
                if duck and vo_dur and t + vo_at - 0.05 <= at <= t + vo_at + vo_dur:
                    g = [round((g[0] if g else 0) + duck, 2)]
                cues.append([name, round(at, 3)] + g)
        scenes.append(dict(
            index=i, file=sp["file"], start=round(t, 4), duration=round(dur, 4), frames=round(dur * fps),
            vo_at=vo_at, vo_dur=round(vo_dur, 4), line=lines[i - 1], cues=cues,
            voice=str(voice.relative_to(ROOT)) if voice.exists() else None,
            voice_lufs=loudness(voice) if voice.exists() else None))
        t += dur
    return dict(title=plan.get("title", "reel"), fps=fps, width=plan.get("width", 720),
                height=plan.get("height", 1280), total=round(t, 4), scenes=scenes)


def write_mix_plan(plan, tl):
    """ffmpeg inputs + filter graph for build.sh: music bed, voice lines, SFX cues."""
    a = plan.get("audio", {})
    levels = a.get("levels_db", {})
    total = tl["total"]
    inputs, chains, mix = [], [], []

    def add(path):
        path = ROOT / path
        if not path.exists():
            print(f"  ! missing audio file {path.relative_to(ROOT)} (run sfx.py / voice.py before build.sh)")
        inputs.extend(["-i", str(path.relative_to(ROOT))])
        return len(inputs) // 2 - 1                   # ffmpeg input index (audio-only mix command)

    fmt = "aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo"
    music = a.get("music", "audio/music.wav")
    k = add(music)
    chains.append(f"[{k}:a]{fmt},atrim=0:{total:.3f},asetpts=PTS-STARTPTS,volume={a.get('music_db', -18)}dB,"
                  f"afade=t=in:d=1.0,afade=t=out:st={max(0, total - 2.2):.3f}:d=2.2[music]")
    mix.append("[music]")

    target = a.get("voice_lufs", -16)
    for s in tl["scenes"]:
        if not s["voice"]:
            continue
        k = add(s["voice"])
        gain = target - s["voice_lufs"] if s["voice_lufs"] is not None else 0.0
        d = int(round((s["start"] + s["vo_at"]) * 1000))
        chains.append(f"[{k}:a]{fmt},volume={gain:.2f}dB,adelay={d}|{d}[vo{s['index']}]")
        mix.append(f"[vo{s['index']}]")

    by_name = {}
    for s in tl["scenes"]:
        for c in s["cues"]:
            by_name.setdefault(c[0], []).append(c)
    for name, cues in by_name.items():
        k = add(f"audio/sfx/{name}.wav")
        outs = "".join(f"[{name}{j}]" for j in range(len(cues)))
        split = f",asplit={len(cues)}{outs}" if len(cues) > 1 else f"[{name}0]"
        chains.append(f"[{k}:a]{fmt},volume={levels.get(name, -10)}dB{split}")
        for j, c in enumerate(cues):
            d = int(round(c[1] * 1000))
            extra = f"volume={c[2]}dB," if len(c) > 2 else ""
            chains.append(f"[{name}{j}]{extra}adelay={d}|{d}[{name}{j}d]")
            mix.append(f"[{name}{j}d]")

    chains.append("".join(mix) + f"amix=inputs={len(mix)}:normalize=0:duration=longest:dropout_transition=0,"
                  f"atrim=0:{total:.3f}[mix]")
    (OUT / "mix_inputs.txt").write_text("\n".join(inputs) + "\n", encoding="utf-8")
    (OUT / "mix_filter.txt").write_text(";\n".join(chains) + "\n", encoding="utf-8")
    (OUT / "concat.txt").write_text("".join(f"file 'scenes/scene{s['index']:02d}.mp4'\n" for s in tl["scenes"]),
                                    encoding="utf-8")


def plan_all():
    plan, lines = load_plan()
    OUT.mkdir(exist_ok=True)
    tl = make_timeline(plan, lines)
    (OUT / "timeline.json").write_text(json.dumps(tl, ensure_ascii=False, indent=2), encoding="utf-8")
    write_mix_plan(plan, tl)
    print(f"plan: {len(tl['scenes'])} scenes, total {tl['total']:.2f}s")
    for s in tl["scenes"]:
        print(f"  {s['index']:02d}  {s['start']:6.2f}s  +{s['duration']:.2f}s  voice@{s['vo_at']:.2f} "
              f"({s['vo_dur']:.2f}s)  {s['line']}")
    return plan, tl


# ----------------------------------------------------------------- recording
class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


def serve():
    httpd = http.server.ThreadingHTTPServer(("127.0.0.1", 0), functools.partial(Quiet, directory=str(ROOT)))
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return f"http://127.0.0.1:{httpd.server_address[1]}"


async def open_scene(browser, base, file, w, h, scale=1):
    page = await browser.new_page(viewport={"width": w, "height": h}, device_scale_factor=scale)
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.on("console", lambda m: m.type == "error" and errors.append(m.text))
    await page.goto(f"{base}/scenes/{file}?render=1")
    try:
        await page.wait_for_function("window.__reel && window.__reel.ready === true", timeout=60000)
    except Exception:
        raise SystemExit(f"{file} never became ready: {errors}")
    if errors:
        print(f"  ! {file}: {errors}")
    return page


async def record(browser, base, s, tl, sem):
    async with sem:
        page = await open_scene(browser, base, s["file"], tl["width"], tl["height"])
        out = OUT / "scenes" / f"scene{s['index']:02d}.mp4"
        ff = subprocess.Popen(
            ["ffmpeg", "-y", "-loglevel", "error", "-f", "image2pipe", "-framerate", str(tl["fps"]),
             "-c:v", "png", "-i", "-", "-c:v", "libx264", "-preset", "medium", "-crf", "16", "-tune", "animation",
             "-pix_fmt", "yuv420p", "-r", str(tl["fps"]), "-movflags", "+faststart", str(out)],
            stdin=subprocess.PIPE)
        cdp = await page.context.new_cdp_session(page)
        for f in range(s["frames"]):
            await page.evaluate("t => window.__reel.seek(t)", f / tl["fps"])
            shot = await cdp.send("Page.captureScreenshot", {"format": "png", "optimizeForSpeed": True})
            await asyncio.to_thread(ff.stdin.write, base64.b64decode(shot["data"]))
        ff.stdin.close()
        await asyncio.to_thread(ff.wait)
        await page.close()
        if ff.returncode:
            raise SystemExit(f"ffmpeg failed for {out}")
        got = media_duration(out)
        print(f"  scene {s['index']:02d}: {s['frames']} frames → {out.relative_to(ROOT)} ({got:.2f}s)")


async def main_async(args, plan, tl):
    from playwright.async_api import async_playwright
    base = serve()
    async with async_playwright() as p:
        browser = await p.chromium.launch(args=["--force-color-profile=srgb", "--font-render-hinting=none",
                                                "--disable-lcd-text"])
        if args.stills:
            n = args.stills
            s = tl["scenes"][n - 1]
            page = await open_scene(browser, base, s["file"], tl["width"], tl["height"])
            (OUT / "stills").mkdir(parents=True, exist_ok=True)
            times = [float(x) for x in (args.at or "0.5").split(",")]
            for t in times:
                await page.evaluate("t => window.__reel.seek(t)", t)
                path = OUT / "stills" / f"scene{n:02d}_{t:05.2f}.png"
                await page.screenshot(path=str(path))
                print("  still", path.relative_to(ROOT))
            await browser.close()
            return

        (OUT / "scenes").mkdir(parents=True, exist_ok=True)
        todo = [s for s in tl["scenes"] if not args.scenes or s["index"] in args.scenes]
        sem = asyncio.Semaphore(args.jobs)
        await asyncio.gather(*(record(browser, base, s, tl, sem) for s in todo))

        cov = plan.get("cover", {"scene": 1, "at": 1.0})
        if not args.scenes or cov["scene"] in args.scenes:
            s = tl["scenes"][cov["scene"] - 1]
            page = await open_scene(browser, base, s["file"], tl["width"], tl["height"], scale=1.5)
            await page.evaluate("t => window.__reel.seek(t)", min(cov["at"], s["duration"] - 0.05))
            await page.screenshot(path=str(OUT / "cover.png"))
            print("  cover → out/cover.png (1080x1920)")
        await browser.close()


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("scenes", nargs="*", type=int, help="scene numbers to render (default: all)")
    ap.add_argument("--plan", action="store_true", help="only write the timeline + mix plan")
    ap.add_argument("--stills", type=int, help="write PNG stills of this scene instead of video")
    ap.add_argument("--at", help="comma separated times for --stills")
    ap.add_argument("--jobs", type=int, default=4, help="scenes recorded in parallel")
    args = ap.parse_args()
    plan, tl = plan_all()
    if args.plan:
        return
    asyncio.run(main_async(args, plan, tl))


if __name__ == "__main__":
    main()

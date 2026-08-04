import pathlib, subprocess, sys, time
import imageio_ffmpeg
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parents[1]
HERE = ROOT
FPS = 60
OUT = ROOT / "video" / (sys.argv[1] if len(sys.argv) > 1 else "al-ameen-academy-intro.mp4")
FFMPEG = imageio_ffmpeg.get_ffmpeg_exe()

with sync_playwright() as p:
    b = p.chromium.launch(
        executable_path="/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
        args=["--force-color-profile=srgb", "--disable-lcd-text", "--hide-scrollbars",
              "--disable-gpu-vsync", "--font-render-hinting=none"])
    pg = b.new_page(viewport={"width": 1920, "height": 1080}, device_scale_factor=1)
    pg.goto((HERE / "intro.html").as_uri() + "?capture=1")
    pg.wait_for_function("window.ready === true", timeout=60000)
    duration = pg.evaluate("window.DURATION")
    frames = int(round(duration * FPS))

    ff = subprocess.Popen([
        FFMPEG, "-y", "-hide_banner", "-loglevel", "error",
        "-f", "image2pipe", "-framerate", str(FPS), "-i", "-",
        "-i", str(ROOT / "tools" / "score.wav"),
        "-map", "0:v:0", "-map", "1:a:0",
        "-c:v", "libx264", "-preset", "slow", "-crf", "18",
        "-pix_fmt", "yuv420p", "-profile:v", "high", "-level", "4.2",
        "-x264-params", "keyint=120:min-keyint=60:ref=4:bframes=3",
        "-c:a", "aac", "-b:a", "192k", "-ar", "48000",
        "-movflags", "+faststart", "-shortest",
        "-metadata", "title=Al-Ameen Academy — Opening Titles",
        str(OUT)], stdin=subprocess.PIPE)

    t0 = time.time()
    for i in range(frames):
        pg.evaluate("t => window.render(t)", i / FPS)
        png = pg.screenshot(type="png", clip={"x": 0, "y": 0, "width": 1920, "height": 1080})
        ff.stdin.write(png)
        if i % 60 == 0:
            print(f"  frame {i}/{frames}  {time.time()-t0:5.1f}s", flush=True)
    ff.stdin.close()
    ff.wait()
    b.close()

print("done ->", OUT, OUT.stat().st_size // 1024, "KB")

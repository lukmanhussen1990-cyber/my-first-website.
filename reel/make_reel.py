#!/usr/bin/env python3
"""ONE script to rebuild the whole reel.

    python3 make_reel.py setup      # download Blender 4.5 LTS, MPFB2 and every free asset (once)
    python3 make_reel.py preview    # 1 low-quality frame per shot  -> render/preview_*.png + render/previews.jpg
    python3 make_reel.py render     # all frames (resumes where it stopped) -> render/frames/
    python3 make_reel.py finish     # audio mix + captions + encode -> final_reel.mp4
    python3 make_reel.py all        # render + finish

Options:  --scale 67   (render size in %; 67 = 720x1280, upscaled to 1080x1920 at the end)
          --samples 3  (EEVEE samples)    --jobs 2  (parallel Blender workers for `render`)
          --frames 1-150 (render only part)  --no-build (reuse the existing reel.blend)

Inputs you can change:
    audio/voiceover.mp3            the narration (captions are re-timed from it by `setup`/`transcribe`)
    audio/sfx/{gasp,siren,fart,music}.mp3   optional CC0 sounds that replace the built-in stand-ins
    animations/*.fbx               (optional) Mixamo clips - see README.md
"""
import os
import shutil
import subprocess
import sys

ROOT = os.path.dirname(os.path.abspath(__file__))
BLENDER_VER = "4.5.15"
BLENDER_DIR = os.path.join(ROOT, "tools", f"blender-{BLENDER_VER}-linux-x64")
BLENDER = os.path.join(BLENDER_DIR, "blender")
USER_RES = os.path.join(ROOT, "tools", "blender_user")
FPS = 30
TOTAL = 55.5


def sh(cmd, **kw):
    print("+", cmd if isinstance(cmd, str) else " ".join(cmd), flush=True)
    return subprocess.run(cmd, shell=isinstance(cmd, str), check=True, **kw)


def opt(name, default):
    if name in sys.argv:
        return sys.argv[sys.argv.index(name) + 1]
    return default


def blender(args, log=None):
    env = dict(os.environ, BLENDER_USER_RESOURCES=USER_RES)
    cmd = [BLENDER, "-b", "-P", os.path.join(ROOT, "scripts", "build.py"), "--"] + args
    if shutil.which("xvfb-run") and not os.environ.get("DISPLAY"):
        cmd = ["xvfb-run", "-a", "-s", "-screen 0 1280x1024x24"] + cmd
    out = open(log, "w") if log else None
    return subprocess.Popen(cmd, env=env, stdout=out or None, stderr=subprocess.STDOUT if out else None)


# ---------------------------------------------------------------------------
def setup():
    os.makedirs(os.path.join(ROOT, "tools"), exist_ok=True)
    if not os.path.exists(BLENDER):
        url = f"https://download.blender.org/release/Blender4.5/blender-{BLENDER_VER}-linux-x64.tar.xz"
        sh(f'curl -fSL "{url}" -o "{ROOT}/tools/blender.tar.xz" && tar xf "{ROOT}/tools/blender.tar.xz" -C "{ROOT}/tools" '
           f'&& rm "{ROOT}/tools/blender.tar.xz"')
    # headless OpenGL for EEVEE on machines without a GPU (Linux)
    if shutil.which("apt-get") and not os.path.exists("/usr/lib/x86_64-linux-gnu/libEGL_mesa.so.0"):
        sh("apt-get install -y -qq libegl1 libegl-mesa0 libgl1-mesa-dri libglx-mesa0 xvfb libxi6 libxxf86vm1 "
           "libxfixes3 libxrender1 libxkbcommon0 libsm6 >/dev/null")
    # MPFB2 (MakeHuman Plugin For Blender) as a Blender extension
    mpfb_src = os.path.join(ROOT, "tools", "mpfb2")
    if not os.path.exists(mpfb_src):
        sh(["git", "clone", "--depth", "1", "https://github.com/makehumancommunity/mpfb2.git", mpfb_src])
    ext_dir = os.path.join(USER_RES, "extensions", "user_default", "mpfb")
    if not os.path.exists(ext_dir):
        z = os.path.join(ROOT, "tools", "mpfb.zip")
        sh(f'cd "{mpfb_src}/src/mpfb" && zip -q -r "{z}" . -x "*__pycache__*"')
        sh(f'BLENDER_USER_RESOURCES="{USER_RES}" "{BLENDER}" -b --factory-startup --command extension install-file '
           f'-r user_default -e "{z}"')
    sh([sys.executable, os.path.join(ROOT, "scripts", "fetch_assets.py")])
    data_link = os.path.join(USER_RES, "extensions", ".user", "user_default", "mpfb", "data")
    os.makedirs(os.path.dirname(data_link), exist_ok=True)
    if not os.path.islink(data_link):
        if os.path.isdir(data_link):
            shutil.rmtree(data_link)
        os.symlink(os.path.join(ROOT, "assets", "makehuman", "data"), data_link)
    if not os.path.exists(os.path.join(ROOT, "audio", "voiceover_words.json")):
        transcribe()
    print("setup OK")


def transcribe():
    venv = os.path.join(ROOT, "tools", "venv")
    py = os.path.join(venv, "bin", "python")
    if not os.path.exists(py):
        sh(f'uv venv -q "{venv}" --python 3.12 && VIRTUAL_ENV="{venv}" uv pip install -q faster-whisper numpy')
    env = dict(os.environ, HF_HUB_DISABLE_XET="1")
    sh([py, "-I", os.path.join(ROOT, "scripts", "transcribe.py"), os.path.join(ROOT, "audio", "voiceover.mp3"),
        os.path.join(ROOT, "audio", "voiceover_words.json"), "small.en"], env=env)


def preview():
    scale = opt("--scale", "50")
    p = blender(["--mode", "preview", "--scale", scale, "--samples", opt("--samples", "6")])
    p.wait()
    pngs = sorted(f for f in os.listdir(os.path.join(ROOT, "render")) if f.startswith("preview_"))
    inputs = []
    for f in pngs:
        inputs += ["-i", os.path.join(ROOT, "render", f)]
    n = len(pngs)
    cols = 7
    filt = "".join(f"[{i}:v]scale=270:480,drawtext=fontfile={ROOT}/assets/fonts/Poppins-ExtraBold.ttf:"
                   f"text='{i + 1}':fontsize=34:fontcolor=white:borderw=3:x=10:y=8[v{i}];" for i in range(n))
    filt += "".join(f"[v{i}]" for i in range(n)) + f"xstack=inputs={n}:layout=" + "|".join(
        f"{(i % cols) * 270}_{(i // cols) * 480}" for i in range(n)) + ":fill=black"
    sh(["ffmpeg", "-v", "error", "-y"] + inputs + ["-filter_complex", filt, "-q:v", "3",
                                                   os.path.join(ROOT, "render", "previews.jpg")])
    print("previews ->", os.path.join(ROOT, "render", "previews.jpg"))


def build_blend():
    """(re)build reel.blend from the scripts"""
    p = blender(["--mode", "blend"], log=os.path.join(ROOT, "render", "build.log"))
    p.wait()


def render():
    """render every frame with N parallel Blender workers (each shot keeps only the characters it needs)"""
    scale = opt("--scale", "67")       # 720x1280 (the reference's own size), upscaled to 1080x1920 in finish
    samples = opt("--samples", "3")
    jobs = int(opt("--jobs", "2"))     # 2 fits in 16 GB RAM
    frames = opt("--frames", "1-99999")
    os.makedirs(os.path.join(ROOT, "render"), exist_ok=True)
    if "--no-build" not in sys.argv or not os.path.exists(os.path.join(ROOT, "reel.blend")):
        build_blend()
    fdir = os.path.join(ROOT, "render", "frames")
    os.makedirs(fdir, exist_ok=True)
    for f in os.listdir(fdir):  # empty placeholders left by an interrupted run
        if os.path.getsize(os.path.join(fdir, f)) == 0:
            os.remove(os.path.join(fdir, f))
    env = dict(os.environ, BLENDER_USER_RESOURCES=USER_RES)
    procs = []
    for j in range(jobs):
        cmd = [BLENDER, "-b", os.path.join(ROOT, "reel.blend"), "-P", os.path.join(ROOT, "scripts", "render_shots.py"),
               "--", "--out", fdir, "--scale", scale, "--samples", samples, "--frames", frames,
               "--worker", str(j), "--workers", str(jobs)]
        if shutil.which("xvfb-run") and not os.environ.get("DISPLAY"):
            cmd = ["xvfb-run", "-a", "-s", "-screen 0 1280x1024x24"] + cmd
        log = open(os.path.join(ROOT, "render", f"render_w{j}.log"), "w")
        procs.append(subprocess.Popen(cmd, env=env, stdout=log, stderr=subprocess.STDOUT))
    for p in procs:
        p.wait()
    n = len([f for f in os.listdir(fdir) if os.path.getsize(os.path.join(fdir, f)) > 0])
    print(f"rendered frames: {n}")


def finish():
    sh([sys.executable, os.path.join(ROOT, "scripts", "audio.py")])
    sh([sys.executable, os.path.join(ROOT, "scripts", "captions.py")])
    frames = os.path.join(ROOT, "render", "frames", "f_%04d.png")
    rendered = len([f for f in os.listdir(os.path.join(ROOT, "render", "frames")) if f.endswith(".png")])
    tail = TOTAL - rendered / FPS
    fonts = os.path.join(ROOT, "assets", "fonts")
    ass = os.path.join(ROOT, "audio", "captions.ass")
    vf = (f"scale=1080:1920:flags=lanczos,tpad=stop_mode=clone:stop_duration={tail:.3f},"
          f"ass='{ass}':fontsdir='{fonts}',format=yuv420p")
    sh(["ffmpeg", "-v", "error", "-stats", "-y", "-framerate", str(FPS), "-start_number", "1", "-i", frames,
        "-i", os.path.join(ROOT, "audio", "mix.wav"), "-vf", vf, "-r", str(FPS),
        "-c:v", "libx264", "-preset", "slow", "-crf", "18", "-profile:v", "high", "-c:a", "aac", "-b:a", "192k",
        "-ar", "48000", "-ac", "2", "-t", str(TOTAL), "-movflags", "+faststart", os.path.join(ROOT, "final_reel.mp4")])
    print("done ->", os.path.join(ROOT, "final_reel.mp4"))


if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else "all"
    {"setup": setup, "transcribe": transcribe, "preview": preview, "render": render, "finish": finish,
     "all": lambda: (render(), finish())}[cmd]()

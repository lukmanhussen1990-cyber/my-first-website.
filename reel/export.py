"""Mix voice + music + SFX, burn word-by-word subtitles and export the final reel.

Re-uses the rendered 3D video (build/render/video_nosubs.mp4) - no 3D re-render needed.

    python export.py [--voices auto|local|elevenlabs] [--video build/render/video_nosubs.mp4]

Steps: place each voice line at its anchor (timeline.json), time-stretching slightly only if it
would overlap the next line; regenerate the music so it stops dead 0.3 s before Grandpa speaks;
duck the music under the voice; loudness-normalize to -14 LUFS; build the subtitles from the
actual word timings; encode H.264/AAC 1080x1920 30 fps.
"""
import argparse
import json
import shutil
import subprocess
import sys
from pathlib import Path

import numpy as np
import soundfile as sf

REEL = Path(__file__).resolve().parent
sys.path.insert(0, str(REEL / "audio"))
sys.path.insert(0, str(REEL / "voice"))
import common as C  # noqa: E402
from dsp import SR, n_of, lufs, limiter, db, true_peak_db  # noqa: E402

BUILD = REEL / "build"
OUTDIR = REEL / "output"
PY = sys.executable


def run(cmd):
    print("  $", " ".join(str(c) for c in cmd))
    subprocess.run([str(c) for c in cmd], check=True)


def envelope_follow(x, attack=0.12, release=0.35):
    """Smooth 0..1 'voice active' envelope from a mono voice bus."""
    from scipy.ndimage import uniform_filter1d, maximum_filter1d
    a = np.abs(x)
    act = (uniform_filter1d(a, n_of(0.03)) > 10 ** (-45 / 20)).astype(float)
    act = maximum_filter1d(act, n_of(0.15))
    out = np.zeros_like(act); g = 0.0
    ka, kr = 1 - np.exp(-1 / (attack * SR)), 1 - np.exp(-1 / (release * SR))
    for i in range(0, len(act), 64):  # block-wise one-pole (fast enough, smooth)
        tgt = act[i]; k = ka if tgt > g else kr
        g = g + (tgt - g) * (1 - (1 - k) ** 64)
        out[i:i + 64] = g
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--voices", default="auto", choices=["auto", "local", "elevenlabs"])
    ap.add_argument("--video", default=str(BUILD / "render" / "video_nosubs.mp4"))
    ap.add_argument("--out", default=str(OUTDIR / "treasure_reel.mp4"))
    a = ap.parse_args()

    tl = C.load_timeline(); sc = C.load_script()
    dur = tl["duration"]; N = n_of(dur)
    engine = a.voices
    if engine == "auto":
        engine = "elevenlabs" if C.engine_complete("elevenlabs") else "local"
    if not C.engine_complete(engine):
        sys.exit(f"voices for engine '{engine}' are incomplete in voices/{engine}/")
    print(f"== export with '{engine}' voices ==")

    # ---------------------------------------------------------------- place voice lines
    anchors = tl["voice_anchors"]
    lines = []
    for line in sc["lines"]:
        x = C.read_audio(C.wav_path(engine, line["id"]))
        words = json.loads(C.words_path(engine, line["id"]).read_text())
        lines.append({"id": line["id"], "speaker": line["speaker"], "x": x, "words": words, "start": anchors[line["id"]], "tempo": 1.0})
    for i, ln in enumerate(lines):
        nxt = lines[i + 1]["start"] if i + 1 < len(lines) else dur - 0.4
        room = nxt - 0.12 - ln["start"]
        d = len(ln["x"]) / SR
        if d > room:
            tempo = min(1.12, d / room)
            y, how = C.time_stretch(ln["x"], tempo)
            ln["x"] = y; ln["tempo"] = tempo
            ln["words"] = [{**w, "start": w["start"] / tempo, "end": w["end"] / tempo} for w in ln["words"]]
            d = len(y) / SR
            print(f"  {ln['id']}: {d * tempo:.2f}s > slot {room:.2f}s -> sped up x{tempo:.3f} ({how})")
            if d > room and i + 1 < len(lines):
                shift = d - room
                lines[i + 1]["start"] += shift
                print(f"  {ln['id']}: still long, next line pushed {shift:.2f}s later")
        ln["end"] = ln["start"] + d
        print(f"  {ln['id']}: {ln['start']:6.2f} -> {ln['end']:6.2f}  (next anchor {nxt:.2f})")
    g1 = next(l for l in lines if l["speaker"] == "grandpa")
    if g1["end"] > dur - 0.2:
        print(f"  WARNING: grandpa line ends at {g1['end']:.2f}s, close to the end ({dur}s)")

    voice = np.zeros(N)
    for ln in lines:
        s = n_of(ln["start"]); e = min(N, s + len(ln["x"]))
        voice[s:e] += ln["x"][:e - s]

    # ---------------------------------------------------------------- music (hard stop before grandpa) + sfx
    stop = round(g1["start"] - 0.30, 3)
    meta = BUILD / "audio" / "music.json"
    have = json.loads(meta.read_text()).get("stop") if meta.exists() else None
    if not (BUILD / "audio" / "music.wav").exists() or have is None or abs(have - stop) > 0.02:
        run([PY, REEL / "audio" / "make_music.py", "--stop", stop, "--duration", dur])
        meta.write_text(json.dumps({"stop": stop}))
    if not (BUILD / "audio" / "sfx.wav").exists():
        run([PY, REEL / "audio" / "make_sfx.py"])
    music, _ = sf.read(BUILD / "audio" / "music.wav", dtype="float64")
    sfx, _ = sf.read(BUILD / "audio" / "sfx.wav", dtype="float64")
    music = music[:N]; sfx = sfx[:N]
    music = np.pad(music, ((0, N - len(music)), (0, 0))); sfx = np.pad(sfx, ((0, N - len(sfx)), (0, 0)))

    # ---------------------------------------------------------------- mix
    v_l = lufs(voice[voice != 0] if np.any(voice) else voice)
    voice *= 10 ** ((-16 - v_l) / 20)
    duck = envelope_follow(voice)
    m_gain = 10 ** ((-16 - 15 - lufs(music[:n_of(stop)])) / 20)
    s_gain = 10 ** ((-16 - 9 - lufs(sfx)) / 20)
    music = music * m_gain * (10 ** (-5 * duck / 20))[:, None]
    sfx = sfx * s_gain * (10 ** (-2 * duck / 20))[:, None]
    mix = np.stack([voice, voice], 1) + music + sfx
    for _ in range(3):  # settle loudness at -14 LUFS with true peak below -1 dBTP
        mix *= 10 ** ((-14 - lufs(mix)) / 20)
        mix = limiter(mix, -2.6)
    sf.write(BUILD / "mix.wav", mix.astype(np.float32), SR, subtype="FLOAT")
    print(f"  mix: {lufs(mix):.1f} LUFS, true peak {true_peak_db(mix):.1f} dBTP")

    # ---------------------------------------------------------------- subtitles from real word timings
    plan = {"engine": engine, "music_stop": stop, "lines": [
        {"id": l["id"], "speaker": l["speaker"], "start": round(l["start"], 3), "end": round(l["end"], 3), "tempo": l["tempo"],
         "words": [{"word": w["word"], "start": round(l["start"] + w["start"], 3), "end": round(l["start"] + w["end"], 3)} for w in l["words"]]}
        for l in lines]}
    (BUILD / "mix_plan.json").write_text(json.dumps(plan, indent=1))
    run([PY, REEL / "subs" / "make_subs.py"])

    # ---------------------------------------------------------------- encode
    video = Path(a.video)
    if not video.exists():
        sys.exit(f"missing rendered video {video} (run: xvfb-run -a node tools/render.mjs --video)")
    OUTDIR.mkdir(exist_ok=True)
    fontsdir = REEL / "assets" / "fonts"
    vf = f"ass={BUILD / 'subs.ass'}:fontsdir={fontsdir},format=yuv420p"
    run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-i", video, "-i", BUILD / "mix.wav",
         "-filter_complex", f"[0:v]{vf}[v]", "-map", "[v]", "-map", "1:a",
         "-c:v", "libx264", "-profile:v", "high", "-preset", "slow", "-crf", "17", "-r", "30", "-pix_fmt", "yuv420p",
         "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-ac", "2", "-t", f"{dur}", "-movflags", "+faststart", a.out])
    shutil.copy(BUILD / "subs.ass", OUTDIR / "subtitles.ass")
    (OUTDIR / "voice_timings.json").write_text(json.dumps(plan, indent=1))
    info = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "stream=codec_name,width,height,r_frame_rate,sample_rate,channels",
                           "-show_entries", "format=duration", "-of", "json", a.out], capture_output=True, text=True).stdout
    print(info)
    print(f"done -> {a.out}")


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""Local (offline) TTS for the reel using Piper voices from huggingface.

    .venv/bin/python voice/make_voices_local.py [--force] [--only n1,g1] [--no-align]

Writes voices/local/<id>.wav (48 kHz mono, trimmed w/ 30 ms pad, -20 LUFS)
then runs voice/align.py to produce voices/local/<id>.words.json.

Narrator : en_US-lessac-high, length_scale 0.9 (quick, clear, neutral US).
Grandpa  : en_US-ryan-high (a different, male speaker), slower, pitched down
           ~2.5 semitones with formant preservation (ffmpeg rubberband),
           gentle vibrato/tremble + warmth EQ -> sounds like a warm old man.
Settings live in script.json -> speakers.<name>.local.
Piper models are cached in build/models/piper (gitignored).
Fallback if Piper is unusable: an `espeak-ng` binary on PATH (much lower quality).
"""
from __future__ import annotations

import argparse
import shutil
import subprocess
import sys
import tempfile
import urllib.request
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))
import common as C  # noqa: E402

MODELS = C.BUILD / "models" / "piper"
HF = "https://huggingface.co/rhasspy/piper-voices/resolve/main/"
OUT = C.VOICES_DIR / "local"


def download(url: str, dst: Path) -> None:
    if dst.exists() and dst.stat().st_size > 0:
        return
    dst.parent.mkdir(parents=True, exist_ok=True)
    print(f"  downloading {url}")
    tmp = dst.with_suffix(dst.suffix + ".part")
    try:
        import requests  # honors REQUESTS_CA_BUNDLE / proxies
        with requests.get(url, stream=True, timeout=120) as r:
            r.raise_for_status()
            with open(tmp, "wb") as f:
                for chunk in r.iter_content(1 << 20):
                    f.write(chunk)
    except ImportError:
        urllib.request.urlretrieve(url, tmp)
    tmp.rename(dst)


def ensure_model(cfg: dict) -> Path:
    name = cfg["model"]
    onnx = MODELS / f"{name}.onnx"
    download(HF + cfg["hf_path"] + ".onnx", onnx)
    download(HF + cfg["hf_path"] + ".onnx.json", MODELS / f"{name}.onnx.json")
    return onnx


_VOICE_CACHE: dict = {}


def piper_tts(text: str, cfg: dict) -> np.ndarray:
    from piper import PiperVoice, SynthesisConfig
    try:  # make the stochastic VITS noise reproducible where supported
        import onnxruntime
        onnxruntime.set_seed(1234)
    except Exception:
        pass
    onnx = ensure_model(cfg)
    if onnx not in _VOICE_CACHE:
        _VOICE_CACHE[onnx] = PiperVoice.load(onnx, config_path=str(onnx) + ".json")
    voice = _VOICE_CACHE[onnx]
    syn = SynthesisConfig(length_scale=cfg.get("length_scale"),
                          noise_scale=cfg.get("noise_scale"),
                          noise_w_scale=cfg.get("noise_w_scale"),
                          normalize_audio=True)
    sr = voice.config.sample_rate
    gap = np.zeros(int(sr * float(cfg.get("sentence_silence", 0.2))))
    parts = []
    for i, chunk in enumerate(voice.synthesize(text, syn)):
        a = np.asarray(chunk.audio_float_array, dtype=np.float64).reshape(-1)
        if i:
            parts.append(gap)
        parts.append(a)
    if not parts:
        raise RuntimeError("piper produced no audio")
    return C.resample(np.concatenate(parts), sr, C.SR)


def espeak_tts(text: str, speaker: str) -> np.ndarray:
    exe = shutil.which("espeak-ng") or shutil.which("espeak")
    if not exe:
        raise RuntimeError("neither piper nor espeak-ng is available")
    voice, speed, pitch = ("en-us", 175, 50) if speaker == "narrator" else ("en-us+m3", 135, 30)
    with tempfile.TemporaryDirectory() as td:
        p = Path(td) / "e.wav"
        subprocess.run([exe, "-v", voice, "-s", str(speed), "-p", str(pitch), "-w", str(p), text],
                       check=True)
        return C.read_audio(p)


def old_man_fx(x: np.ndarray, semitones: float) -> np.ndarray:
    """Older, warmer voice: resample-shift pitch+formants down (a bigger, slower, deeper man),
    then a gentle tremble and warm EQ. (A formant-preserving rubberband chain combined with the
    tremble filters made the line unintelligible in tests, so it is not used.)"""
    ratio = 2 ** (semitones / 12.0)
    chain = [
        f"asetrate={C.SR}*{ratio:.6f}", f"aresample={C.SR}",
        "vibrato=f=5.5:d=0.035",                   # light pitch tremble
        "tremolo=f=5.5:d=0.06",                    # light amplitude tremble
        "highpass=f=70",
        "bass=g=2:f=180",                          # chesty warmth
        "equalizer=f=3200:t=o:w=1.4:g=-2",         # softer, less 'young' bite
    ]
    return C.ffmpeg_filter_array(x, ",".join(chain))


def synth_line(line: dict, spk: dict) -> np.ndarray:
    cfg = spk["local"]
    try:
        x = piper_tts(line["text"], cfg)
        how = f"piper {cfg['model']} ls={cfg.get('length_scale')}"
    except Exception as e:  # pragma: no cover - fallback path
        print(f"  !! piper failed ({e!r}); trying espeak-ng")
        x = espeak_tts(line["text"], line["speaker"])
        how = "espeak-ng"
    x, _ = C.trim_silence(x, C.SR, pad=0.05)
    if cfg.get("old_man_fx"):
        x = old_man_fx(x, float(cfg.get("pitch_semitones", 0.0)))
        how += f" +oldman({cfg.get('pitch_semitones')} st)"
    elif abs(float(cfg.get("pitch_semitones", 0.0))) > 1e-3:
        x = old_man_fx(x, float(cfg["pitch_semitones"]))
    y, _ = C.finish_line(x)
    print(f"  {line['id']}: {how} -> {len(y)/C.SR:.2f}s")
    return y


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--force", action="store_true", help="re-synthesize even if wav exists")
    ap.add_argument("--only", default="", help="comma separated line ids")
    ap.add_argument("--no-align", action="store_true", help="skip word alignment")
    a = ap.parse_args()

    sc = C.load_script()
    only = set(filter(None, a.only.split(",")))
    OUT.mkdir(parents=True, exist_ok=True)
    print("== local TTS (piper) ==")
    for line in sc["lines"]:
        if only and line["id"] not in only:
            continue
        dst = C.wav_path("local", line["id"])
        if dst.exists() and not a.force:
            print(f"  {line['id']}: exists, keeping (use --force to redo)")
            continue
        y = synth_line(line, sc["speakers"][line["speaker"]])
        C.write_wav(dst, y)
        wj = C.words_path("local", line["id"])
        if wj.exists():
            wj.unlink()  # stale timings

    if a.no_align:
        return 0
    cmd = [C.python_exe(), str(Path(__file__).resolve().parent / "align.py"), "--engine", "local"]
    if a.only:
        cmd += ["--only", a.only]
    if a.force:
        cmd += ["--force"]
    return subprocess.call(cmd)


if __name__ == "__main__":
    sys.exit(main())

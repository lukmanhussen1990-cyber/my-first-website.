"""Build stages: voice -> align -> audio -> preview/render.

Every stage reads a video's config module (e.g. spotlight_effect.py) and
writes into build/<video name>/. Stages are cached on a hash of the config
values they depend on.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import subprocess
import time
from pathlib import Path

import numpy as np
import soundfile as sf

ROOT = Path(__file__).resolve().parent.parent
MODELS = ROOT / "models"
MIX_SR = 48000


def _hash(*parts) -> str:
    return hashlib.sha1(json.dumps(parts, sort_keys=True, default=str).encode()).hexdigest()[:12]


def _log(msg):
    print(f"[{time.strftime('%H:%M:%S')}] {msg}", flush=True)


# ------------------------------------------------------------------ 1. voice
def build_dir(cfg) -> Path:
    d = ROOT / "build" / Path(cfg.OUTPUT).stem
    d.mkdir(parents=True, exist_ok=True)
    return d


def stage_voice(cfg, BUILD, force=False):
    from scipy.signal import resample_poly
    from .tts import G2P, Kokoro, SAMPLE_RATE, build_voiceover, loudness_normalize

    v = cfg.VOICE
    sentences = [s for s, _ in cfg.SCRIPT]
    pauses = [p for _, p in cfg.SCRIPT]
    key = _hash(cfg.SCRIPT, v, cfg.PRONUNCIATIONS)
    meta_path = BUILD / "voice.json"
    if not force and meta_path.exists() and json.loads(meta_path.read_text())["key"] == key:
        _log("voice: up to date")
        return json.loads(meta_path.read_text())
    _log(f"voice: Kokoro {v['name']} speed {v['speed']}")
    g2p = G2P(overrides=cfg.PRONUNCIATIONS)
    kokoro = Kokoro(MODELS / "kokoro" / "model.onnx", MODELS / "kokoro" / "voices")
    audio, info = build_voiceover(sentences, v["name"], v["speed"], pauses, g2p, kokoro,
                                  lead_in=v.get("lead_in", 0.3), tail=v.get("tail", 1.6))
    audio = resample_poly(audio, 2, 1).astype(np.float32)  # 24 kHz -> 48 kHz
    audio = loudness_normalize(audio, MIX_SR, v.get("lufs", -16.0))
    sf.write(BUILD / "voice.wav", audio, MIX_SR, subtype="PCM_16")
    meta = {"key": key, "duration": len(audio) / MIX_SR, "g2p_tagger": g2p.tagger, "sentences": info}
    meta_path.write_text(json.dumps(meta, indent=1, ensure_ascii=False))
    _log(f"voice: {meta['duration']:.2f}s -> {BUILD / 'voice.wav'}")
    return meta


# ------------------------------------------------------------------ 2. align
def script_words(voice_meta):
    """Model word timings, re-labelled with the script's own tokens (keeps punctuation)."""
    from .align import norm
    words = []
    for s in voice_meta["sentences"]:
        display = [tok for tok in s["text"].split() if norm(tok)]
        timed = s["words"]
        if [norm(t) for t in display] != [norm(w["text"]) for w in timed]:
            raise ValueError(f"cannot map TTS words onto the script for: {s['text']!r}")
        for k, (tok, w) in enumerate(zip(display, timed)):
            words.append({"text": tok, "sentence": s["index"], "index_in_sentence": k,
                          "start": w["start"], "end": w["end"]})
    return words


def stage_align(cfg, BUILD, voice_meta, force=False):
    from scipy.signal import resample_poly
    from .align import align, whisper_words

    out_path = BUILD / "words.json"
    key = _hash(voice_meta["key"], cfg.WHISPER)
    if not force and out_path.exists() and json.loads(out_path.read_text())["key"] == key:
        _log("align: up to date")
        return json.loads(out_path.read_text())
    audio, sr = sf.read(BUILD / "voice.wav", dtype="float32")
    audio16 = resample_poly(audio, 1, 3).astype(np.float32)
    model = cfg.WHISPER.get("model", "base")
    local = MODELS / f"whisper-{model}-ct2"
    _log(f"align: faster-whisper '{model}' word timestamps")
    heard = whisper_words(audio16, str(local) if local.exists() else model)
    spans = [(s["start"], s["end"]) for s in voice_meta["sentences"]]
    final, report = align(script_words(voice_meta), heard, spans, timing=cfg.WHISPER.get("timing", "model"),
                          max_drift=cfg.WHISPER.get("max_drift", 0.12))
    data = {"key": key, "report": report, "heard": heard, "words": final}
    out_path.write_text(json.dumps(data, indent=1, ensure_ascii=False))
    dr = report["whisper_vs_model_start_drift_s"]
    _log(f"align: whisper heard {report['heard_by_whisper']}/{report['words']} script words "
         f"(missing: {report['not_heard'] or 'none'}); whisper-vs-model start drift median {dr['median']}s, "
         f"max {dr['max']}s; timing source = {report['timing_source']}")
    return data


# ------------------------------------------------------------------ 0. voice test
def stage_voicetest(cfg, BUILD, voices=("am_michael", "am_adam", "am_fenrir", "bm_george")):
    """Two script lines in each candidate voice, compared with the reference narrator."""
    from scipy.signal import resample_poly
    from .tts import G2P, Kokoro, SAMPLE_RATE, build_voiceover, loudness_normalize
    out = BUILD / "voice_tests"
    out.mkdir(exist_ok=True)
    g2p = G2P(overrides=cfg.PRONUNCIATIONS)
    kokoro = Kokoro(MODELS / "kokoro" / "model.onnx", MODELS / "kokoro" / "voices")
    lines = [s for s, _ in cfg.SCRIPT[:2]]
    files = {}
    for v in voices:
        audio, _ = build_voiceover(lines, v, cfg.VOICE["speed"], [0.35], g2p, kokoro, lead_in=0.2, tail=0.3)
        files[v] = out / f"test_{v}.wav"
        sf.write(files[v], loudness_normalize(audio, SAMPLE_RATE, -16), SAMPLE_RATE)
    try:
        import librosa
    except ImportError:
        _log(f"voicetest: wrote {out} (install librosa to also get the pitch/timbre comparison)")
        return
    from faster_whisper import WhisperModel

    def feats(y, sr):
        y16 = librosa.resample(y.astype(np.float32), orig_sr=sr, target_sr=16000)
        f0, vf, _ = librosa.pyin(y16, fmin=60, fmax=300, sr=16000, frame_length=1024)
        f0 = f0[vf & ~np.isnan(f0)]
        cen = librosa.feature.spectral_centroid(y=y16, sr=16000)[0]
        rms = librosa.feature.rms(y=y16)[0]
        return float(np.median(f0)), float(np.std(12 * np.log2(f0 / np.median(f0)))), \
            float(np.median(cen[rms > 0.02 * rms.max()])), y16

    ref_path = ROOT / "reference.mp4"
    ref = None
    if ref_path.exists():
        raw = subprocess.run(["ffmpeg", "-v", "error", "-i", str(ref_path), "-t", "20", "-ac", "1", "-ar", "16000",
                              "-f", "f32le", "-"], capture_output=True).stdout
        ref = feats(np.frombuffer(raw, np.float32), 16000)
        print(f"{'reference':12s} F0 {ref[0]:5.1f} Hz | pitch variability {ref[1]:.2f} st | brightness {ref[2]:4.0f} Hz")
    local = MODELS / f"whisper-{cfg.WHISPER.get('model', 'base')}-ct2"
    wm = WhisperModel(str(local) if local.exists() else cfg.WHISPER.get("model", "base"), device="cpu",
                      compute_type="int8")
    best = None
    for v, f in files.items():
        y, sr = sf.read(f)
        f0, var, cen, y16 = feats(y, sr)
        segs, _ = wm.transcribe(y16, language="en", word_timestamps=True)
        conf = float(np.mean([w.probability for s_ in segs for w in s_.words]))
        dist = (abs(12 * np.log2(f0 / ref[0])) / 3 + abs(var - ref[1]) + abs(np.log2(cen / ref[2])) * 4) if ref else 0
        print(f"{v:12s} F0 {f0:5.1f} Hz | pitch variability {var:.2f} st | brightness {cen:4.0f} Hz | "
              f"whisper confidence {conf:.3f} | distance to reference {dist:.2f}")
        if best is None or dist - conf < best[0]:
            best = (dist - conf, v)
    _log(f"voicetest: closest to the reference narrator: {best[1]}  (files in {out})")


# ------------------------------------------------------------------ main
def main(cfg):
    ap = argparse.ArgumentParser(description="Build the reel")
    ap.add_argument("stage", nargs="?", default="all",
                    choices=["voicetest", "voice", "align", "audio", "preview", "render", "all"])
    ap.add_argument("--force", action="store_true", help="ignore caches")
    ap.add_argument("--at", type=float, nargs="*", help="preview: times in seconds")
    ap.add_argument("--scenes", type=int, nargs="*", help="preview: scene numbers (1-based)")
    ap.add_argument("--workers", type=int, default=4)
    args = ap.parse_args()

    BUILD = build_dir(cfg)
    if args.stage == "voicetest":
        return stage_voicetest(cfg, BUILD)
    voice = stage_voice(cfg, BUILD, args.force)
    if args.stage == "voice":
        return
    words = stage_align(cfg, BUILD, voice, args.force)
    if args.stage == "align":
        return
    from .render import render_all, render_previews
    from .stage import compile_plan
    plan = compile_plan(cfg, voice, words)
    if args.stage in ("audio", "all", "render"):
        from .audio import stage_audio
        stage_audio(cfg, plan, BUILD)
    if args.stage == "preview":
        render_previews(cfg, plan, BUILD / "previews", times=args.at, scenes=args.scenes)
    if args.stage in ("render", "all"):
        render_all(cfg, plan, BUILD, ROOT / cfg.OUTPUT, workers=args.workers)
